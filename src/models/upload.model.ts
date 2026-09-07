import mongoose, { Schema } from "mongoose";

export type UploadDoc = {
  uploadId: string;
  uid: string;
  purpose: "headshot" | "branding" | "profile_review";
  mimeType: string;
  size: number;
  path: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

const schema = new Schema<UploadDoc>(
  {
    uploadId: { type: String, required: true, unique: true },
    uid: { type: String, required: true, index: true },
    purpose: { type: String, enum: ["headshot", "branding", "profile_review"], default: "headshot" },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    path: { type: String, required: true },
    expiresAt: { type: Date, required: true, index: true },
  },
  { timestamps: true },
);

export const UploadModel = mongoose.model<UploadDoc>("Upload", schema);
