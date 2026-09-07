import type { UserDoc } from "../models/index.js";

export function passIsActive(user: Pick<UserDoc, "passExpiresAt" | "passCredits">): boolean {
  return Boolean(user.passExpiresAt && user.passExpiresAt.getTime() > Date.now() && user.passCredits > 0);
}

export function spendableCredits(user: Pick<UserDoc, "credits" | "passCredits" | "passExpiresAt">): number {
  return (passIsActive(user) ? user.passCredits : 0) + user.credits;
}

export function usesLeft(user: Pick<UserDoc, "credits" | "passCredits" | "passExpiresAt">): number {
  return Math.floor(spendableCredits(user) / 50);
}

export function walletView(user: UserDoc) {
  const active = passIsActive(user);
  if (!active && (user.passCredits > 0 || user.isPremium)) {
    return {
      credits: user.credits,
      passCredits: 0,
      passExpiresAt: null,
      activePassId: null,
      isPremium: false,
      premiumStatus: user.premiumStatus === "cancelled" ? "cancelled" : "expired",
      spendableCredits: user.credits,
      usesLeft: Math.floor(user.credits / 50),
      adRewardClaimed: user.adRewardClaimed,
    };
  }
  return {
    credits: user.credits,
    passCredits: user.passCredits,
    passExpiresAt: user.passExpiresAt?.toISOString() ?? null,
    activePassId: user.activePassId ?? null,
    isPremium: user.isPremium,
    premiumStatus: user.premiumStatus,
    spendableCredits: spendableCredits(user),
    usesLeft: usesLeft(user),
    adRewardClaimed: user.adRewardClaimed,
  };
}
