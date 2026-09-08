export type PurchaseDoc = {
  purchaseId: string;
  uid: string;
  productId: string;
  creditsAdded: number;
  amount: number;
  currency: string;
  platform: "play_store" | "app_store" | "rewarded_ad" | "bonus";
  status: "completed" | "failed" | "pending";
  createdAt: Date;
  updatedAt: Date;
};
