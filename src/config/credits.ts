export const CREDIT_COSTS = {
  headshot_generation: 50,
  branding_analyze: 50,
  profile_review: 50,
  branding_improve: 100,
} as const;

export const CREDIT_GRANTS = {
  rewarded_ad: 50,
  welcome_bonus: 0,
  sub_weekly: 500,
  sub_monthly: 3000,
  sub_yearly: 13000,
} as const;

/** Catalog USD list prices shown if Google Play omits recurringPrice. Play API amount wins when present. */
export const PLAY_LIST_PRICES: Record<"sub_weekly" | "sub_monthly" | "sub_yearly", { amount: number; currency: string }> = {
  sub_weekly: { amount: 4.99, currency: "USD" },
  sub_monthly: { amount: 9.99, currency: "USD" },
  sub_yearly: { amount: 49.99, currency: "USD" },
};

export const PASS_DURATION_MS = {
  sub_weekly: 7 * 24 * 60 * 60 * 1000,
  sub_monthly: 30 * 24 * 60 * 60 * 1000,
  sub_yearly: 365 * 24 * 60 * 60 * 1000,
} as const;

export type CreditReason = keyof typeof CREDIT_COSTS;
export type ProductId = keyof typeof CREDIT_GRANTS;

export const GENERATIONS_PER_DAY_ALERT = 50;
export const IDEMPOTENCY_HEADER = "idempotency-key";
export const API_KEY_HEADER = "x-api-key";
export const API_KEY_PREFIX_LIVE = "x-api-key_live_";
export const API_KEY_PREFIX_TEST = "x-api-key_test_";
