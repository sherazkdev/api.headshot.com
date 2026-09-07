import { CREDIT_GRANTS, PASS_DURATION_MS, PLAY_LIST_PRICES, type ProductId } from "../../config/credits.js";
import { errors } from "../../lib/errors.js";
import { walletView } from "../../lib/wallet.js";
import { verifyPlaySubscription } from "../../lib/play-billing.js";
import { isDuplicateKeyError } from "../../lib/mongo-dup.js";
import { PurchaseModel, UserModel } from "../../models/index.js";
import type { AppConfig } from "../../config/index.js";
import { pageMeta } from "../../lib/zod.js";

const PLAN_NAME: Record<string, string> = {
  sub_weekly: "Weekly",
  sub_monthly: "Monthly",
  sub_yearly: "Yearly",
};

export class SubscriptionsService {
  constructor(private readonly config: AppConfig) {}

  async verify(
    uid: string,
    input: {
      platform: "android" | "ios";
      productId: ProductId;
      purchaseToken?: string;
      transactionId?: string;
      packageName?: string;
    },
  ) {
    if (!(input.productId in CREDIT_GRANTS) || !input.productId.startsWith("sub_")) {
      throw errors.validation("Unknown productId");
    }
    if (input.platform === "ios") {
      throw errors.badRequest("iOS App Store verification is not enabled yet");
    }
    const purchaseId = input.purchaseToken ?? input.transactionId;
    if (!purchaseId) throw errors.validation("purchaseToken or transactionId is required");

    const existing = await PurchaseModel.findOne({ purchaseId });
    if (existing) {
      const user = await this.requireUser(uid);
      return this.verifyPayload(user, input.productId);
    }

    const play = await verifyPlaySubscription(this.config, {
      packageName: input.packageName,
      purchaseToken: input.purchaseToken,
      productId: input.productId,
    });
    if (!play.active) throw errors.validation("Subscription is not active on Google Play");

    const user = await this.applyPass(uid, input.productId as "sub_weekly" | "sub_monthly" | "sub_yearly", "stack", play.expiryMs);
    try {
      await PurchaseModel.create({
        purchaseId,
        uid,
        productId: input.productId,
        creditsAdded: CREDIT_GRANTS[input.productId],
        amount: play.amount,
        currency: play.currency,
        platform: "play_store",
        status: "completed",
      });
    } catch (err) {
      if (!isDuplicateKeyError(err)) throw err;
    }
    user.purchaseId = purchaseId;
    await user.save();
    return this.verifyPayload(user, input.productId);
  }

  async sync(uid: string) {
    const user = await this.requireUser(uid);
    if (user.passExpiresAt && user.passExpiresAt < new Date()) {
      user.passCredits = 0;
      user.activePassId = null;
      user.isPremium = false;
      user.premiumStatus = user.premiumStatus === "cancelled" ? "cancelled" : "expired";
      await user.save();
    }
    return walletView(user);
  }

  async restore(uid: string, tokens: string[]) {
    if (!tokens.length) return this.sync(uid);
    for (const token of tokens) {
      const purchase = await PurchaseModel.findOne({ purchaseId: token, uid });
      if (purchase) continue;
      try {
        await this.verify(uid, { platform: "android", productId: "sub_monthly", purchaseToken: token });
      } catch {
        /* skip invalid tokens */
      }
    }
    return this.sync(uid);
  }

  async listPurchases(uid: string | undefined, page: number, perPage: number) {
    const q = uid ? { uid } : {};
    const [items, total] = await Promise.all([
      PurchaseModel.find(q)
        .sort({ createdAt: -1 })
        .skip((page - 1) * perPage)
        .limit(perPage),
      PurchaseModel.countDocuments(q),
    ]);
    return { items, meta: pageMeta(page, perPage, total) };
  }

  packs() {
    return [
      { productId: "sub_weekly", credits: CREDIT_GRANTS.sub_weekly, days: 7, ...PLAY_LIST_PRICES.sub_weekly },
      { productId: "sub_monthly", credits: CREDIT_GRANTS.sub_monthly, days: 30, ...PLAY_LIST_PRICES.sub_monthly },
      { productId: "sub_yearly", credits: CREDIT_GRANTS.sub_yearly, days: 365, ...PLAY_LIST_PRICES.sub_yearly },
    ];
  }

  async applyPass(
    uid: string,
    productId: "sub_weekly" | "sub_monthly" | "sub_yearly",
    mode: "stack" | "renew",
    expiryMs?: number | null,
  ) {
    const credits = CREDIT_GRANTS[productId];
    const duration = PASS_DURATION_MS[productId];
    const user = await this.requireUser(uid);
    const now = new Date();
    const active = Boolean(user.passExpiresAt && user.passExpiresAt > now);
    const expires = expiryMs && Number.isFinite(expiryMs) ? new Date(expiryMs) : new Date(Date.now() + duration);
    if (mode === "renew" || !active) {
      user.passCredits = credits;
    } else {
      user.passCredits += credits;
    }
    user.activePassId = productId;
    user.passExpiresAt = expires;
    user.isPremium = true;
    user.premiumStatus = "active";
    user.premiumPlanId = productId;
    user.premiumPlanName = PLAN_NAME[productId] ?? productId;
    user.premiumStartedAt = now;
    user.premiumExpiresAt = expires;
    await user.save();
    return user;
  }

  async expireOrCancel(uid: string, status: "expired" | "cancelled" | "revoked") {
    const user = await UserModel.findOne({ uid });
    if (!user) return null;
    if (status === "cancelled") {
      user.premiumStatus = "cancelled";
      await user.save();
      return user;
    }
    user.passCredits = 0;
    user.activePassId = null;
    user.isPremium = false;
    user.premiumStatus = "expired";
    await user.save();
    return user;
  }

  private verifyPayload(user: { activePassId?: string | null; passCredits: number; passExpiresAt?: Date | null; isPremium: boolean }, productId: string) {
    return {
      planId: user.activePassId ?? productId,
      passCredits: user.passCredits,
      passExpiresAt: user.passExpiresAt?.toISOString() ?? null,
      isPremium: user.isPremium,
    };
  }

  private async requireUser(uid: string) {
    const user = await UserModel.findOne({ uid });
    if (!user) throw errors.notFound("User not found");
    if (user.accountStatus === "deleted") throw errors.forbidden("Account deleted");
    return user;
  }
}
