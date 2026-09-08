import { CREDIT_COSTS, CREDIT_GRANTS, type CreditReason } from "../../config/credits.js";
import { errors } from "../../lib/errors.js";
import { spendableCredits, walletView } from "../../lib/wallet.js";
import { finishIdempotency, rejectIfDuplicate, reuseOrBegin } from "../../lib/idempotency.js";
import {
  CreditLedgerModel,
  IdempotencyModel,
  PurchaseModel,
  UserModel,
  WebhookEventModel,
  type UserDoc,
} from "../../models/index.js";
import { MemoryCache } from "../../cache/index.js";
import type { AppConfig } from "../../config/index.js";

export type ConsumeResult = {
  deducted: number;
  fromPassCredits: number;
  fromBonusCredits: number;
  remainingSpendable: number;
};

type UserRecord = UserDoc & { __v?: number; save: () => Promise<unknown> };

export class CreditsService {
  constructor(
    private readonly cache: MemoryCache,
    private readonly config: AppConfig,
  ) {}

  async getWallet(uid: string) {
    const user = await this.expirePassIfNeeded(await this.requireUser(uid));
    return walletView(user);
  }

  async canProceed(uid: string, amount: number) {
    const user = await this.expirePassIfNeeded(await this.requireUser(uid));
    const spendable = spendableCredits(user);
    return { allowed: spendable >= amount, spendableCredits: spendable };
  }

  async consume(
    uid: string,
    amount: number,
    reason: CreditReason,
    referenceId?: string,
    idempotencyKey?: string,
    opts?: { reuseIdempotency?: boolean },
  ): Promise<ConsumeResult> {
    const expected = CREDIT_COSTS[reason];
    if (amount !== expected) throw errors.validation("Amount does not match allowed cost", { expected, amount });
    if (amount > 100) throw errors.validation("Max single deduction is 100");

    if (referenceId) {
      const prior = await CreditLedgerModel.findOne({ uid, reason, referenceId, direction: "debit" });
      if (prior) {
        return {
          deducted: prior.amount,
          fromPassCredits: prior.fromPassCredits,
          fromBonusCredits: prior.fromBonusCredits,
          remainingSpendable: prior.remainingSpendable,
        };
      }
    }

    if (opts?.reuseIdempotency) {
      const reused = await reuseOrBegin<ConsumeResult>(
        uid,
        `credits.consume.${reason}`,
        idempotencyKey,
        this.config.IDEMPOTENCY_TTL_HOURS,
      );
      if ("hit" in reused && reused.hit) return reused.hit;
    } else if (idempotencyKey) {
      const existing = await IdempotencyModel.findOne({
        key: idempotencyKey,
        uid,
        route: "credits.consume",
      });
      if (existing) throw errors.conflict("Idempotency key already used");
      const can = await this.canProceed(uid, amount);
      if (!can.allowed) throw errors.insufficientCredits(amount, can.spendableCredits);
      await rejectIfDuplicate(uid, "credits.consume", idempotencyKey, this.config.IDEMPOTENCY_TTL_HOURS);
    } else {
      const can = await this.canProceed(uid, amount);
      if (!can.allowed) throw errors.insufficientCredits(amount, can.spendableCredits);
    }

    let lastError: unknown;
    for (let attempt = 0; attempt < 6; attempt += 1) {
      try {
        const result = await this.debitOnce(uid, amount, reason, referenceId);
        await finishIdempotency(uid, opts?.reuseIdempotency ? `credits.consume.${reason}` : "credits.consume", idempotencyKey, result);
        return result;
      } catch (err) {
        lastError = err;
        if (err instanceof Error && err.message === "WALLET_RACE") continue;
        throw err;
      }
    }
    throw lastError instanceof Error ? lastError : errors.conflict("Wallet busy, retry");
  }

  async grant(uid: string, amount: number, reason: string, toPass = false) {
    const user = await this.requireUser(uid);
    if (toPass) user.passCredits += amount;
    else user.credits += amount;
    await user.save();
    const remainingSpendable = spendableCredits(user);
    await CreditLedgerModel.create({
      uid,
      amount,
      direction: "credit",
      reason,
      fromPassCredits: toPass ? amount : 0,
      fromBonusCredits: toPass ? 0 : amount,
      remainingSpendable,
    });
    this.bust(uid);
    return walletView(user);
  }

  async claimAdReward(uid: string, ssvTransactionId?: string) {
    const user = await this.requireUser(uid);
    if (user.adRewardClaimed) return walletView(user);
    if (!ssvTransactionId) throw errors.badRequest("ssvTransactionId is required until AdMob SSV is processed");
    const event = await WebhookEventModel.findOne({
      eventId: ssvTransactionId,
      source: "admob_ssv",
    });
    if (!event) throw errors.notFound("SSV transaction not found");
    return this.grantAdRewardOnce(uid, ssvTransactionId);
  }

  async grantAdRewardOnce(uid: string, transactionId: string) {
    const updated = await UserModel.findOneAndUpdate(
      { uid, adRewardClaimed: false, accountStatus: "active" },
      { $inc: { credits: CREDIT_GRANTS.rewarded_ad }, $set: { adRewardClaimed: true } },
      { new: true },
    );
    if (!updated) {
      const current = await this.requireUser(uid);
      if (current.adRewardClaimed) return walletView(current);
      throw errors.conflict("Ad reward already claimed");
    }
    await CreditLedgerModel.create({
      uid,
      amount: CREDIT_GRANTS.rewarded_ad,
      direction: "credit",
      reason: "rewarded_ad",
      referenceId: transactionId,
      fromPassCredits: 0,
      fromBonusCredits: CREDIT_GRANTS.rewarded_ad,
      remainingSpendable: spendableCredits(updated),
    });
    try {
      await PurchaseModel.create({
        purchaseId: `ad_reward_${transactionId}`,
        uid,
        productId: "rewarded_ad",
        creditsAdded: CREDIT_GRANTS.rewarded_ad,
        amount: 0,
        currency: "USD",
        platform: "rewarded_ad",
        status: "completed",
      });
    } catch {
      /* purchase already recorded */
    }
    this.bust(uid);
    return walletView(updated);
  }

  private async debitOnce(uid: string, amount: number, reason: CreditReason, referenceId?: string): Promise<ConsumeResult> {
    const user = await this.expirePassIfNeeded(await this.requireUser(uid));
    const expMs = user.passExpiresAt ? new Date(user.passExpiresAt as Date).getTime() : 0;
    const passActive = Number.isFinite(expMs) && expMs > Date.now();
    const available = spendableCredits(user);
    if (available < amount) throw errors.insufficientCredits(amount, available);

    let fromPass = 0;
    let fromBonus = 0;
    let remaining = amount;
    if (passActive && user.passCredits > 0) {
      fromPass = Math.min(user.passCredits, remaining);
      remaining -= fromPass;
    }
    if (remaining > 0) fromBonus = remaining;

    const updated = await UserModel.findOneAndUpdate(
      {
        uid,
        __v: (user as UserRecord).__v ?? 0,
        credits: { $gte: fromBonus },
        passCredits: { $gte: fromPass },
        accountStatus: "active",
      },
      {
        $inc: { credits: -fromBonus, passCredits: -fromPass, __v: 1 },
        $set: {
          activePassId: passActive ? user.activePassId : null,
          isPremium: passActive ? user.isPremium : false,
          premiumStatus: passActive ? user.premiumStatus : user.premiumStatus === "cancelled" ? "cancelled" : "expired",
        },
      },
      { new: true },
    );
    if (!updated) throw new Error("WALLET_RACE");

    const remainingSpendable = spendableCredits(updated);
    await CreditLedgerModel.create({
      uid,
      amount,
      direction: "debit",
      reason,
      referenceId,
      fromPassCredits: fromPass,
      fromBonusCredits: fromBonus,
      remainingSpendable,
    });
    this.bust(uid);
    return {
      deducted: amount,
      fromPassCredits: fromPass,
      fromBonusCredits: fromBonus,
      remainingSpendable,
    };
  }

  async expirePassIfNeeded(user: UserRecord) {
    const exp = user.passExpiresAt;
    const expired = Boolean(exp && new Date(exp as Date).getTime() <= Date.now());
    if (expired) {
      if (user.passCredits || user.isPremium || user.activePassId) {
        user.passCredits = 0;
        user.activePassId = null;
        user.isPremium = false;
        if (user.premiumStatus === "active") user.premiumStatus = "expired";
        await user.save();
        this.bust(user.uid);
      }
    }
    return user;
  }

  private bust(uid: string) {
    this.cache.del(`wallet:${uid}`);
    this.cache.del(`user:${uid}`);
  }

  private async requireUser(uid: string) {
    const user = await UserModel.findOne({ uid });
    if (!user) throw errors.notFound("User not found");
    if (user.accountStatus === "deleted") throw errors.forbidden("Account deleted");
    if (user.accountStatus === "suspended") throw errors.forbidden("Account suspended");
    return user as typeof user & UserRecord;
  }
}
