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
