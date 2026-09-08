import { loadConfig } from "../config/index.js";
import { connectDb, disconnectDb } from "../db/index.js";

const COLLECTIONS = [
  "users",
  "api_keys",
  "purchases",
  "ai_jobs",
  "projects",
  "notifications",
  "webhook_events",
  "uploads",
  "idempotency",
  "remote_config",
  "credit_ledger",
];

async function indexDb() {
  const config = loadConfig();
  await connectDb(config);
  console.log("Firestore collections (indexes are automatic / Console composite indexes):");
  for (const name of COLLECTIONS) console.log(`  - ${name}`);
  await disconnectDb();
}

void indexDb();
