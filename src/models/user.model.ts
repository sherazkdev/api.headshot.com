import mongoose, { Schema } from "mongoose";

export const PREMIUM_STATUSES = ["free", "active", "cancelled", "expired"] as const;
export const ACCOUNT_STATUSES = ["active", "suspended", "deleted"] as const;
export const LOGIN_PROVIDERS = ["email", "google", "apple", "facebook"] as const;

export type UserDoc = {
  uid: string;
  name: string;
  email: string;
  photoUrl?: string;
  loginProvider: (typeof LOGIN_PROVIDERS)[number];
  emailVerified: boolean;
  credits: number;
  passCredits: number;
  passExpiresAt?: Date | null;
  activePassId?: string | null;
  adRewardClaimed: boolean;
  isPremium: boolean;
  premiumPlanId?: string | null;
  premiumPlanName?: string | null;
  premiumStatus: (typeof PREMIUM_STATUSES)[number];
  premiumStartedAt?: Date | null;
  premiumExpiresAt?: Date | null;
  purchaseId?: string | null;
  accountStatus: (typeof ACCOUNT_STATUSES)[number];
  welcomeBonusGranted: boolean;
  fcmToken?: string | null;
  fcmPlatform?: string | null;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date | null;
};

const schema = new Schema<UserDoc>(
  {
    uid: { type: String, required: true, unique: true, index: true },
    name: { type: String, default: "" },
    email: { type: String, default: "", index: true },
    photoUrl: String,
    loginProvider: { type: String, enum: LOGIN_PROVIDERS, default: "email" },
    emailVerified: { type: Boolean, default: false },
    credits: { type: Number, default: 0 },
    passCredits: { type: Number, default: 0 },
    passExpiresAt: { type: Date, default: null },
    activePassId: { type: String, default: null },
    adRewardClaimed: { type: Boolean, default: false },
    isPremium: { type: Boolean, default: false },
    premiumPlanId: { type: String, default: null },
    premiumPlanName: { type: String, default: null },
    premiumStatus: { type: String, enum: PREMIUM_STATUSES, default: "free" },
    premiumStartedAt: { type: Date, default: null },
    premiumExpiresAt: { type: Date, default: null },
    purchaseId: { type: String, default: null },
    accountStatus: { type: String, enum: ACCOUNT_STATUSES, default: "active", index: true },
    welcomeBonusGranted: { type: Boolean, default: false },
    fcmToken: { type: String, default: null },
    fcmPlatform: { type: String, default: null },
    lastLoginAt: { type: Date, default: null },
  },
  { timestamps: true },
);

schema.index({ email: 1, accountStatus: 1 });
schema.index({ isPremium: 1, premiumStatus: 1 });

export const UserModel = mongoose.model<UserDoc>("User", schema);
