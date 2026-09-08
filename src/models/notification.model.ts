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
