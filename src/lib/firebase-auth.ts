import { getAuth } from "firebase-admin/auth";
import type { AppConfig } from "../config/index.js";
import { AppError, errors } from "./errors.js";
import { firebaseApp } from "./firebase-app.js";

type Decoded = { uid: string; email?: string; name?: string; email_verified?: boolean };

export class FirebaseAuth {
  constructor(private readonly config: AppConfig) {}

  async verifyIdToken(token: string): Promise<Decoded> {
    if (!this.config.FIREBASE_PROJECT_ID && !this.config.GOOGLE_APPLICATION_CREDENTIALS) {
      throw errors.unauthorized("Firebase Admin is not configured");
    }
    try {
      firebaseApp(this.config);
      const decoded = await getAuth().verifyIdToken(token);
      return {
        uid: decoded.uid,
        email: decoded.email,
        name: decoded.name,
        email_verified: decoded.email_verified,
      };
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw errors.unauthorized("Invalid Firebase token");
    }
  }
}
