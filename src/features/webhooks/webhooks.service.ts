import { CREDIT_GRANTS, PLAY_LIST_PRICES } from "../../config/credits.js";
import { isDuplicateKeyError } from "../../lib/mongo-dup.js";
import { WebhookEventModel, UserModel, PurchaseModel } from "../../models/index.js";
import { pageMeta } from "../../lib/zod.js";
import { CreditsService } from "../credits/credits.service.js";
import { SubscriptionsService } from "../subscriptions/subscriptions.service.js";
import type { AppConfig } from "../../config/index.js";
import { errors } from "../../lib/errors.js";
import { verifyPlaySubscription } from "../../lib/play-billing.js";

const PLAY_TYPES: Record<number, string> = {
  1: "SUBSCRIPTION_RECOVERED",
  2: "SUBSCRIPTION_RENEWED",
  3: "SUBSCRIPTION_CANCELED",
  4: "SUBSCRIPTION_PURCHASED",
  12: "SUBSCRIPTION_REVOKED",
  13: "SUBSCRIPTION_EXPIRED",
};

export class WebhooksService {
  constructor(
    private readonly credits: CreditsService,
    private readonly subscriptions: SubscriptionsService,
    private readonly config: AppConfig,
  ) {}

  async googlePlay(payload: Record<string, unknown>) {
    const decoded = decodePlayPayload(payload);
    const eventType = decoded.eventType;
    const eventId = decoded.eventId;
    const existing = await WebhookEventModel.findOne({ eventId });
    if (existing) return existing;

    const matchPlay = this.config.GOOGLE_PLAY_VERIFY_ENABLED;
    const user = decoded.purchaseToken
      ? await UserModel.findOne({ purchaseId: decoded.purchaseToken })
      : null;

    let signatureValid = false;
    let status: "processed" | "failed" | "ignored" = "processed";

    if (user && decoded.productId?.startsWith("sub_")) {
      const productId = decoded.productId as "sub_weekly" | "sub_monthly" | "sub_yearly";
      const grant = async (amount: number, currency: string, expiryMs?: number | null) => {
        await this.subscriptions.applyPass(user.uid, productId, eventType === "SUBSCRIPTION_RENEWED" ? "renew" : "stack", expiryMs);
        try {
          await PurchaseModel.create({
            purchaseId: `${decoded.purchaseToken}:${eventType}:${eventId}`,
            uid: user.uid,
            productId,
            creditsAdded: CREDIT_GRANTS[productId],
            amount,
            currency,
            platform: "play_store",
            status: "completed",
          });
        } catch (err) {
          if (!isDuplicateKeyError(err)) throw err;
        }
      };

      if (eventType === "SUBSCRIPTION_CANCELED") {
        await this.subscriptions.expireOrCancel(user.uid, "cancelled");
      } else if (eventType === "SUBSCRIPTION_EXPIRED" || eventType === "SUBSCRIPTION_REVOKED") {
        await this.subscriptions.expireOrCancel(user.uid, "expired");
      } else if (eventType === "SUBSCRIPTION_RENEWED" || eventType === "SUBSCRIPTION_PURCHASED" || eventType === "SUBSCRIPTION_RECOVERED") {
        if (!matchPlay) {
          const catalog = PLAY_LIST_PRICES[productId];
          await grant(catalog.amount, catalog.currency);
          signatureValid = false;
        } else if (decoded.purchaseToken) {
          try {
            const play = await verifyPlaySubscription(this.config, {
              purchaseToken: decoded.purchaseToken,
              productId,
            });
            signatureValid = play.verified;
            if (!play.active) throw errors.validation("Subscription is not active on Google Play");
            await grant(play.amount, play.currency, play.expiryMs);
          } catch {
            status = "failed";
            signatureValid = false;
          }
        }
      }
    }

    return WebhookEventModel.create({
      eventId,
      source: "google_play",
      eventType,
      reference: decoded.purchaseToken,
      signatureValid,
      status,
      attempts: 1,
      payload,
      receivedAt: new Date(),
      processedAt: new Date(),
    });
  }

  async appStore(payload: Record<string, unknown>) {
    const eventId = String(payload.notificationUUID ?? payload.eventId ?? crypto.randomUUID());
    return WebhookEventModel.create({
      eventId,
      source: "app_store",
      eventType: String(payload.notificationType ?? "APP_STORE"),
      signatureValid: false,
      status: this.config.isProd ? "ignored" : "processed",
      attempts: 1,
      payload,
      receivedAt: new Date(),
      processedAt: new Date(),
    });
  }

  async admobSsv(query: Record<string, unknown>) {
    const uid = String(query.user_id ?? query.custom_data ?? "");
    const eventId = String(query.transaction_id ?? "");
    if (this.config.isProd && this.config.ADMOB_SSV_VERIFIER_ENABLED) {
      if (!query.signature || !query.key_id || !query.transaction_id) {
        throw errors.unauthorized("Invalid AdMob SSV signature");
      }
    }
    if (!eventId) throw errors.badRequest("transaction_id is required");
    const existing = await WebhookEventModel.findOne({ eventId, source: "admob_ssv" });
    if (existing) return existing;
    if (uid) {
      await this.credits.grantAdRewardOnce(uid, eventId);
    }
    const payload = sanitizePayload(query);
    try {
      return await WebhookEventModel.create({
        eventId,
        source: "admob_ssv",
        eventType: "REWARD_GRANTED",
        reference: uid,
        signatureValid: !this.config.isProd || Boolean(query.signature),
        status: "processed",
        attempts: 1,
        payload,
        receivedAt: new Date(),
        processedAt: new Date(),
      });
    } catch (err) {
      if (isDuplicateKeyError(err)) {
        const again = await WebhookEventModel.findOne({ eventId, source: "admob_ssv" });
        if (again) return again;
      }
      throw err;
    }
  }

  async adminList(page: number, perPage: number) {
    const [items, total] = await Promise.all([
      WebhookEventModel.find()
        .sort({ createdAt: -1 })
        .skip((page - 1) * perPage)
        .limit(perPage),
      WebhookEventModel.countDocuments(),
    ]);
    return { items, meta: pageMeta(page, perPage, total) };
  }
}

function sanitizePayload(input: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input ?? {})) {
    if (value === undefined) continue;
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean" || value === null) {
      out[key] = value;
    } else {
      out[key] = String(value);
    }
  }
  return out;
}

function decodePlayPayload(payload: Record<string, unknown>): {
  eventId: string;
  eventType: string;
  purchaseToken?: string;
  productId?: string;
} {
  const message = payload.message as { data?: string } | undefined;
  if (message?.data) {
    try {
      const inner = JSON.parse(Buffer.from(message.data, "base64").toString("utf8")) as {
        eventTimeMillis?: string;
        subscriptionNotification?: {
          notificationType?: number;
          purchaseToken?: string;
          subscriptionId?: string;
        };
      };
      const note = inner.subscriptionNotification;
      const typeNum = note?.notificationType ?? 2;
      return {
        eventId: String(payload.eventId ?? inner.eventTimeMillis ?? crypto.randomUUID()),
        eventType: PLAY_TYPES[typeNum] ?? String(payload.eventType ?? "SUBSCRIPTION_RENEWED"),
        purchaseToken: note?.purchaseToken,
        productId: note?.subscriptionId,
      };
    } catch {
      /* fall through */
    }
  }
  return {
    eventId: String(payload.eventId ?? crypto.randomUUID()),
    eventType: String(payload.eventType ?? payload.notificationType ?? "SUBSCRIPTION_RENEWED"),
    purchaseToken: payload.purchaseToken ? String(payload.purchaseToken) : undefined,
    productId: payload.productId ? String(payload.productId) : undefined,
  };
}
