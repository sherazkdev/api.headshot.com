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
