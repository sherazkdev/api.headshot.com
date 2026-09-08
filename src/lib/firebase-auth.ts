import type { AppConfig } from "../config/index.js";
import { errors } from "./errors.js";

type Decoded = { uid: string; email?: string; name?: string; email_verified?: boolean };
type FirebaseAdmin = typeof import("firebase-admin") & { default?: typeof import("firebase-admin") };

function adminSdk(mod: FirebaseAdmin): typeof import("firebase-admin") {
  return mod.default ?? mod;
}

export class FirebaseAuth {
  private appReady = false;

  constructor(private readonly config: AppConfig) {}

  async verifyIdToken(token: string): Promise<Decoded> {
    const admin = await this.sdk();
    if (!admin) throw errors.unauthorized("Firebase Admin is not configured");
    try {
      const decoded = await admin.auth().verifyIdToken(token);
      return {
        uid: decoded.uid,
        email: decoded.email,
        name: decoded.name,
        email_verified: decoded.email_verified,
      };
    } catch {
      throw errors.unauthorized("Invalid Firebase token");
    }
  }

  private async sdk() {
    if (!this.config.FIREBASE_PROJECT_ID && !this.config.GOOGLE_APPLICATION_CREDENTIALS) {
      return null;
    }
    const admin = adminSdk(await import("firebase-admin"));
    if (!this.appReady && admin.apps.length === 0) {
      const privateKey = this.config.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n");
      if (this.config.GOOGLE_APPLICATION_CREDENTIALS) {
        admin.initializeApp({
          credential: admin.credential.applicationDefault(),
          projectId: this.config.FIREBASE_PROJECT_ID || undefined,
        });
      } else if (this.config.FIREBASE_CLIENT_EMAIL && privateKey) {
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId: this.config.FIREBASE_PROJECT_ID,
            clientEmail: this.config.FIREBASE_CLIENT_EMAIL,
            privateKey,
          }),
        });
      } else {
        return null;
      }
      this.appReady = true;
    }
    return admin;
  }
}
