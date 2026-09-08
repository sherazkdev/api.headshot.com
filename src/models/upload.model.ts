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
