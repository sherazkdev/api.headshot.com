import mongoose, { Schema } from "mongoose";

export type ProjectDoc = {
  projectId: string;
  uid: string;
  name: string;
  toolType: string;
  status: "pending" | "in_progress" | "completed";
  styleId?: string;
  outfitId?: string;
  backgroundId?: string;
  poseId?: string;
  gender?: string;
  purpose?: string;
  sourcePhotoUrl?: string;
  resultImageUrl?: string;
  brandingScore?: number;
  brandingStrengths?: string[];
  profileReviewData?: Record<string, unknown>;
  isFavorite: boolean;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

const schema = new Schema<ProjectDoc>(
  {
    projectId: { type: String, required: true, unique: true },
    uid: { type: String, required: true, index: true },
    name: { type: String, required: true },
    toolType: { type: String, required: true, index: true },
    status: { type: String, enum: ["pending", "in_progress", "completed"], default: "pending" },
    styleId: String,
    outfitId: String,
    backgroundId: String,
    poseId: String,
    gender: String,
    purpose: String,
    sourcePhotoUrl: String,
    resultImageUrl: String,
    brandingScore: Number,
    brandingStrengths: { type: [String], default: [] },
    profileReviewData: { type: Schema.Types.Mixed, default: null },
    isFavorite: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

schema.index({ uid: 1, updatedAt: -1 });

export const ProjectModel = mongoose.model<ProjectDoc>("Project", schema);
