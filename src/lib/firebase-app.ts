import { applicationDefault, cert, getApps, initializeApp, type App } from "firebase-admin/app";
import type { AppConfig } from "../config/index.js";

export function firebaseApp(config: AppConfig): App {
  const existing = getApps()[0];
  if (existing) return existing;
  const privateKey = config.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n");
  const storageBucket =
    config.FIREBASE_STORAGE_BUCKET ||
    (config.FIREBASE_PROJECT_ID ? `${config.FIREBASE_PROJECT_ID}.appspot.com` : undefined);
  if (config.GOOGLE_APPLICATION_CREDENTIALS) {
    return initializeApp({
      credential: applicationDefault(),
      projectId: config.FIREBASE_PROJECT_ID || undefined,
      storageBucket,
    });
  }
  if (config.FIREBASE_PROJECT_ID && config.FIREBASE_CLIENT_EMAIL && privateKey) {
    return initializeApp({
      credential: cert({
        projectId: config.FIREBASE_PROJECT_ID,
        clientEmail: config.FIREBASE_CLIENT_EMAIL,
        privateKey,
      }),
      storageBucket,
    });
  }
  throw new Error("Firebase Admin is not configured (set FIREBASE_PROJECT_ID + service account)");
}
