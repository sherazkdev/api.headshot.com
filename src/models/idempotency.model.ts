import mongoose, { Schema } from "mongoose";

export type IdempotencyDoc = {
  key: string;
  uid: string;
  route: string;
  response: Record<string, unknown>;
  expiresAt: Date;
  createdAt: Date;
};

const schema = new Schema<IdempotencyDoc>(
  {
    key: { type: String, required: true },
    uid: { type: String, required: true },
    route: { type: String, required: true },
    response: { type: Schema.Types.Mixed, required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

schema.index({ key: 1, uid: 1, route: 1 }, { unique: true });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const IdempotencyModel = mongoose.model<IdempotencyDoc>("Idempotency", schema);
