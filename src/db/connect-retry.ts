import type { Firestore } from "firebase-admin/firestore";
import type { AppConfig } from "../config/index.js";
import { connectDb } from "./connection.js";

export async function connectDbWithRetry(config: AppConfig, attempts = 5): Promise<Firestore> {
  let last: unknown;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await connectDb(config);
    } catch (err) {
      last = err;
      const delayMs = Math.min(10_000, 1000 * (i + 1));
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw last instanceof Error ? last : new Error("Firestore connect failed");
}
