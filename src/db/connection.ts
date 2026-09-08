import { getFirestore, type Firestore } from "firebase-admin/firestore";
import type { AppConfig } from "../config/index.js";
import { firebaseApp } from "../lib/firebase-app.js";

let db: Firestore | null = null;
let connectedConfig: AppConfig | null = null;

export async function connectDb(config: AppConfig): Promise<Firestore> {
  connectedConfig = config;
  firebaseApp(config);
  db = getFirestore();
  try {
    db.settings({ ignoreUndefinedProperties: true });
  } catch {
    /* settings already applied on this app */
  }
  return db;
}

export async function disconnectDb(): Promise<void> {
  db = null;
  connectedConfig = null;
}

export function firestore(): Firestore {
  if (!db) {
    if (!connectedConfig) throw new Error("Firestore is not connected — call connectDb first");
    db = getFirestore();
  }
  return db;
}
