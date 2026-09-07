import mongoose, { Schema } from "mongoose";

export type NotificationDoc = {
  notificationId: string;
  uid: string;
  title: string;
  body: string;
  type: "generation" | "subscription" | "credits" | "system";
  delivery: "queued" | "sent" | "delivered" | "failed";
  read: boolean;
  platform?: string;
  createdAt: Date;
  updatedAt: Date;
};

const schema = new Schema<NotificationDoc>(
  {
    notificationId: { type: String, required: true, unique: true },
    uid: { type: String, required: true, index: true },
    title: { type: String, required: true },
    body: { type: String, required: true },
    type: { type: String, enum: ["generation", "subscription", "credits", "system"], required: true },
    delivery: { type: String, enum: ["queued", "sent", "delivered", "failed"], default: "queued" },
    read: { type: Boolean, default: false, index: true },
    platform: String,
  },
  { timestamps: true },
);

schema.index({ uid: 1, createdAt: -1 });

export const NotificationModel = mongoose.model<NotificationDoc>("Notification", schema);
