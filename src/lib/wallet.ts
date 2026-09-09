import type { UserDoc } from "../models/index.js";

export function asDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "object" && "toDate" in (value as object) && typeof (value as { toDate: () => Date }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate();
  }
  if (typeof value === "number" || typeof value === "string") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

export function passIsActive(user: Pick<UserDoc, "passExpiresAt" | "passCredits">): boolean {
  const exp = asDate(user.passExpiresAt);
  return Boolean(exp && exp.getTime() > Date.now() && Number(user.passCredits ?? 0) > 0);
}

export function spendableCredits(user: Pick<UserDoc, "credits" | "passCredits" | "passExpiresAt">): number {
  return (passIsActive(user) ? Number(user.passCredits ?? 0) : 0) + Number(user.credits ?? 0);
}

export function usesLeft(user: Pick<UserDoc, "credits" | "passCredits" | "passExpiresAt">): number {
  return Math.floor(spendableCredits(user) / 50);
}

export function walletView(user: UserDoc) {
  const active = passIsActive(user);
  const credits = Number(user.credits ?? 0);
  const passCredits = Number(user.passCredits ?? 0);
  const exp = asDate(user.passExpiresAt);
  if (!active && (passCredits > 0 || user.isPremium)) {
    return {
      credits,
      passCredits: 0,
      passExpiresAt: null,
      activePassId: null,
      isPremium: false,
      premiumStatus: user.premiumStatus === "cancelled" ? "cancelled" : "expired",
      spendableCredits: credits,
      usesLeft: Math.floor(credits / 50),
      adRewardClaimed: Boolean(user.adRewardClaimed),
    };
  }
  return {
    credits,
    passCredits,
    passExpiresAt: exp?.toISOString() ?? null,
    activePassId: user.activePassId ?? null,
    isPremium: Boolean(user.isPremium),
    premiumStatus: user.premiumStatus,
    spendableCredits: spendableCredits(user),
    usesLeft: usesLeft(user),
    adRewardClaimed: Boolean(user.adRewardClaimed),
  };
}

export function publicUser(user: UserDoc & { toObject?: () => Record<string, unknown> }) {
  const raw = typeof user.toObject === "function" ? user.toObject() : { ...(user as object) };
  const obj = { ...raw } as Record<string, unknown>;
  delete obj.save;
  delete obj.toObject;
  return { ...obj, ...walletView(user) };
}
