import mongoose, { Schema } from "mongoose";

export type PurchaseDoc = {
  purchaseId: string;
  uid: string;
  productId: string;
  creditsAdded: number;
  amount: number;
  currency: string;
  platform: "play_store" | "app_store" | "rewarded_ad" | "bonus";
  status: "completed" | "failed" | "pending";
  createdAt: Date;
  updatedAt: Date;
};

const schema = new Schema<PurchaseDoc>(
  {
    purchaseId: { type: String, required: true, unique: true },
    uid: { type: String, required: true, index: true },
    productId: { type: String, required: true, index: true },
    creditsAdded: { type: Number, required: true },
    amount: { type: Number, default: 0 },
    currency: { type: String, default: "USD" },
    platform: {
      type: String,
      enum: ["play_store", "app_store", "rewarded_ad", "bonus"],
      required: true,
    },
    status: { type: String, enum: ["completed", "failed", "pending"], default: "completed" },
  },
  { timestamps: true },
);

schema.index({ uid: 1, createdAt: -1 });

export const PurchaseModel = mongoose.model<PurchaseDoc>("Purchase", schema);
