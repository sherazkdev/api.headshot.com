import { firestore } from "../db/connection.js";
import { FsModel } from "../db/fs-model.js";
import type { UserDoc } from "./user.model.js";
import type { ApiKeyDoc } from "./api-key.model.js";
import type { PurchaseDoc } from "./purchase.model.js";
import type { AiJobDoc } from "./ai-job.model.js";
import type { ProjectDoc } from "./project.model.js";
import type { NotificationDoc } from "./notification.model.js";
import type { WebhookEventDoc } from "./webhook-event.model.js";
import type { UploadDoc } from "./upload.model.js";
import type { IdempotencyDoc } from "./idempotency.model.js";
import type { RemoteConfigDoc } from "./remote-config.model.js";
import type { CreditLedgerDoc } from "./credit-ledger.model.js";

const db = () => firestore();

export const UserModel = new FsModel<UserDoc>(() => db(), "users", "uid");
export const ApiKeyModel = new FsModel<ApiKeyDoc>(() => db(), "api_keys");
export const PurchaseModel = new FsModel<PurchaseDoc>(() => db(), "purchases", "purchaseId");
export const AiJobModel = new FsModel<AiJobDoc>(() => db(), "ai_jobs", "jobId");
export const ProjectModel = new FsModel<ProjectDoc>(() => db(), "projects", "projectId");
export const NotificationModel = new FsModel<NotificationDoc>(() => db(), "notifications", "notificationId");
export const WebhookEventModel = new FsModel<WebhookEventDoc>(() => db(), "webhook_events", "eventId");
export const UploadModel = new FsModel<UploadDoc>(() => db(), "uploads", "uploadId");
export const IdempotencyModel = new FsModel<IdempotencyDoc>(
  () => db(),
  "idempotency",
  undefined,
  (d) => `${d.uid}__${d.route}__${d.key}`,
);
export const RemoteConfigModel = new FsModel<RemoteConfigDoc>(() => db(), "remote_config", "key");
export const CreditLedgerModel = new FsModel<CreditLedgerDoc>(() => db(), "credit_ledger");
