import { loadConfig } from "../config/index.js";
import { connectDb, disconnectDb } from "../db/index.js";
import {
  UserModel,
  ApiKeyModel,
  PurchaseModel,
  AiJobModel,
  ProjectModel,
  NotificationModel,
  WebhookEventModel,
  UploadModel,
  IdempotencyModel,
  RemoteConfigModel,
  CreditLedgerModel,
} from "../models/index.js";

const MODELS = [
  UserModel,
  ApiKeyModel,
  PurchaseModel,
  AiJobModel,
  ProjectModel,
  NotificationModel,
  WebhookEventModel,
  UploadModel,
  IdempotencyModel,
  RemoteConfigModel,
  CreditLedgerModel,
];

async function indexDb() {
  const config = loadConfig();
  await connectDb(config);

  console.log("Syncing MongoDB indexes...");
  for (const model of MODELS) {
    const result = await model.syncIndexes();
    const created = Object.keys(result).filter((k) => result[k] === "create");
    const dropped = Object.keys(result).filter((k) => result[k] === "drop");
    console.log(
      `${model.modelName}: ${created.length ? `created [${created.join(", ")}]` : "ok"}${
        dropped.length ? ` dropped [${dropped.join(", ")}]` : ""
      }`,
    );
  }

  console.log("Done — all collection indexes synced.");
  await disconnectDb();
}

void indexDb();
