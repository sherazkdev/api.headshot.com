import { getAuth } from "firebase-admin/auth";
import type { AppConfig } from "../config/index.js";
import type { MemoryCache } from "../cache/index.js";
import { withTimeout } from "./async.js";
import { sha256 } from "./crypto.js";
import { AppError, errors } from "./errors.js";
import { firebaseApp } from "./firebase-app.js";

type Decoded = { uid: string; email?: string; name?: string; email_verified?: boolean };

export class FirebaseAuth {
  constructor(
    private readonly config: AppConfig,
    private readonly cache?: MemoryCache,
  ) {}

  async verifyIdToken(token: string): Promise<Decoded> {
    if (!this.config.FIREBASE_PROJECT_ID && !this.config.GOOGLE_APPLICATION_CREDENTIALS) {
      throw errors.unauthorized("Firebase Admin is not configured");
    }

    const cacheKey = `firebase:${sha256(token)}`;
    const cached = this.cache?.get<Decoded>(cacheKey);
    if (cached) return cached;

    try {
      firebaseApp(this.config);
      const decoded = await withTimeout(
        getAuth().verifyIdToken(token),
        this.config.FIREBASE_VERIFY_TIMEOUT_MS,
        "firebase verifyIdToken",
      );
      const mapped: Decoded = {
        uid: decoded.uid,
        email: decoded.email,
        name: decoded.name,
        email_verified: decoded.email_verified,
      };
      if (this.cache) {
        const maxTtl = this.config.FIREBASE_TOKEN_CACHE_TTL_SEC * 1000;
        this.cache.set(cacheKey, mapped, firebaseTokenCacheTtlMs(token, maxTtl));
      }
      return mapped;
    } catch (err) {
      if (err instanceof AppError) throw err;
      if (isVerifyTimeout(err)) throw errors.authUnavailable();
      throw errors.unauthorized("Invalid Firebase token");
    }
  }
}

function isVerifyTimeout(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  return /timed out/i.test(err.message);
}

function firebaseTokenCacheTtlMs(token: string, maxTtlMs: number): number {
  const parts = token.split(".");
  const payloadPart = parts[1];
  if (parts.length !== 3 || !payloadPart) return maxTtlMs;
  try {
    const padded = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(Buffer.from(padded, "base64").toString("utf8")) as { exp?: number };
    if (!payload.exp) return maxTtlMs;
    const msUntilExp = payload.exp * 1000 - Date.now() - 30_000;
    return Math.max(5_000, Math.min(maxTtlMs, msUntilExp));
  } catch {
    return maxTtlMs;
  }
}
