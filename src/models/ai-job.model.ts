import mongoose, { Schema } from "mongoose";

export const JOB_TYPES = [
  "headshot_generation",
  "branding_analyze",
  "branding_improve",
  "profile_review",
] as const;

export const JOB_STATUSES = ["queued", "processing", "completed", "failed", "cancelled"] as const;

export type AiJobDoc = {
  jobId: string;
  uid: string;
  jobType: (typeof JOB_TYPES)[number];
  provider: "gemini" | "bfl";
  model: string;
  status: (typeof JOB_STATUSES)[number];
  payload: Record<string, unknown>;
  result?: Record<string, unknown>;
  credits: number;
  fromPassCredits: number;
  fromBonusCredits: number;
  error?: string | null;
  queueMs?: number;
  durationMs?: number;
  createdAt: Date;
  updatedAt: Date;
};

const schema = new Schema<AiJobDoc>(
  {
    jobId: { type: String, required: true, unique: true },
    uid: { type: String, required: true, index: true },
    jobType: { type: String, enum: JOB_TYPES, required: true, index: true },
    provider: { type: String, enum: ["gemini", "bfl"], required: true },
    model: { type: String, required: true },
    status: { type: String, enum: JOB_STATUSES, default: "queued", index: true },
    payload: { type: Schema.Types.Mixed, default: {} },
    result: { type: Schema.Types.Mixed, default: {} },
    credits: { type: Number, required: true },
    fromPassCredits: { type: Number, default: 0 },
    fromBonusCredits: { type: Number, default: 0 },
    error: { type: String, default: null },
    queueMs: Number,
    durationMs: Number,
  },
  { timestamps: true },
);

schema.index({ status: 1, createdAt: -1 });
schema.index({ uid: 1, createdAt: -1 });

export const AiJobModel = mongoose.model<AiJobDoc>("AiJob", schema);
