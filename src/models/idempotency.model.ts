export type IdempotencyDoc = {
  key: string;
  uid: string;
  route: string;
  response: Record<string, unknown>;
  expiresAt: Date;
  createdAt: Date;
};
