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
