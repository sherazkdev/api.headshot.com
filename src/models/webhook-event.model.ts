import mongoose, { Schema } from "mongoose";

export type WebhookEventDoc = {
  eventId: string;
  source: "google_play" | "admob_ssv" | "app_store";
  eventType: string;
  reference?: string;
  signatureValid: boolean;
  status: "processed" | "failed" | "retrying" | "ignored";
  attempts: number;
  payload: Record<string, unknown>;
  error?: string | null;
  receivedAt: Date;
  processedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

const schema = new Schema<WebhookEventDoc>(
  {
    eventId: { type: String, required: true, unique: true },
    source: { type: String, enum: ["google_play", "admob_ssv", "app_store"], required: true, index: true },
    eventType: { type: String, required: true, index: true },
    reference: String,
    signatureValid: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ["processed", "failed", "retrying", "ignored"],
      default: "retrying",
      index: true,
    },
    attempts: { type: Number, default: 0 },
    payload: { type: Schema.Types.Mixed, default: {} },
    error: { type: String, default: null },
    receivedAt: { type: Date, default: () => new Date() },
    processedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export const WebhookEventModel = mongoose.model<WebhookEventDoc>("WebhookEvent", schema);
