import mongoose, { Schema } from "mongoose";

export type CreditLedgerDoc = {
  uid: string;
  amount: number;
  direction: "debit" | "credit";
  reason: string;
  referenceId?: string;
  fromPassCredits: number;
  fromBonusCredits: number;
  remainingSpendable: number;
  createdAt: Date;
};

const schema = new Schema<CreditLedgerDoc>(
  {
    uid: { type: String, required: true, index: true },
    amount: { type: Number, required: true },
    direction: { type: String, enum: ["debit", "credit"], required: true },
    reason: { type: String, required: true, index: true },
    referenceId: String,
    fromPassCredits: { type: Number, default: 0 },
    fromBonusCredits: { type: Number, default: 0 },
    remainingSpendable: { type: Number, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

schema.index({ uid: 1, createdAt: -1 });

export const CreditLedgerModel = mongoose.model<CreditLedgerDoc>("CreditLedger", schema);
