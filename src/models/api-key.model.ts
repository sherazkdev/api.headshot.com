import mongoose, { Schema } from "mongoose";

export const API_KEY_ROLES = ["admin", "read_only", "developer"] as const;
export const API_KEY_STATUSES = ["active", "idle", "never_used", "revoked"] as const;

export type ApiKeyDoc = {
  name: string;
  ownerEmail: string;
  ownerName: string;
  prefix: string;
  hash: string;
  role: (typeof API_KEY_ROLES)[number];
  status: (typeof API_KEY_STATUSES)[number];
  requestCount: number;
  lastUsedAt?: Date | null;
  revokedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

const schema = new Schema<ApiKeyDoc>(
  {
    name: { type: String, required: true },
    ownerEmail: { type: String, required: true, index: true },
    ownerName: { type: String, required: true },
    prefix: { type: String, required: true, unique: true },
    hash: { type: String, required: true, unique: true, index: true },
    role: { type: String, enum: API_KEY_ROLES, default: "developer" },
    status: { type: String, enum: API_KEY_STATUSES, default: "never_used", index: true },
    requestCount: { type: Number, default: 0 },
    lastUsedAt: { type: Date, default: null },
    revokedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

schema.index({ status: 1, lastUsedAt: -1 });

export const ApiKeyModel = mongoose.model<ApiKeyDoc>("ApiKey", schema);
