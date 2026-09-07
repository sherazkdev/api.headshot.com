import mongoose, { Schema } from "mongoose";

export type RemoteConfigDoc = {
  key: string;
  type: "json" | "secret" | "string";
  value: string;
  status: "published" | "modified" | "remove_required";
  version: number;
  publishedBy?: string;
  createdAt: Date;
  updatedAt: Date;
};

const schema = new Schema<RemoteConfigDoc>(
  {
    key: { type: String, required: true, unique: true },
    type: { type: String, enum: ["json", "secret", "string"], default: "json" },
    value: { type: String, default: "{}" },
    status: { type: String, enum: ["published", "modified", "remove_required"], default: "published" },
    version: { type: Number, default: 1 },
    publishedBy: String,
  },
  { timestamps: true },
);

export const RemoteConfigModel = mongoose.model<RemoteConfigDoc>("RemoteConfig", schema);
