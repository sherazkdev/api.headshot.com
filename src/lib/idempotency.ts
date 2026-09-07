import { IdempotencyModel } from "../models/index.js";
import { errors } from "./errors.js";
import { isDuplicateKeyError } from "./mongo-dup.js";

export type IdempotencyMode = "conflict" | "reuse";

export async function beginIdempotency(
  uid: string,
  route: string,
  key: string | undefined,
  ttlHours: number,
): Promise<{ reserved: boolean }> {
  if (!key) return { reserved: false };
  try {
    await IdempotencyModel.create({
      key,
      uid,
      route,
      response: { reserved: true },
      expiresAt: new Date(Date.now() + ttlHours * 3600_000),
    });
    return { reserved: true };
  } catch (err) {
    if (isDuplicateKeyError(err)) return { reserved: false };
    throw err;
  }
}

export async function readIdempotency<T>(uid: string, route: string, key: string): Promise<T | undefined> {
  const doc = await IdempotencyModel.findOne({ key, uid, route });
  if (!doc) return undefined;
  const response = doc.response ?? {};
  if (response.reserved) return undefined;
  return response as T;
}

export async function finishIdempotency(
  uid: string,
  route: string,
  key: string | undefined,
  response: Record<string, unknown>,
): Promise<void> {
  if (!key) return;
  await IdempotencyModel.updateOne({ key, uid, route }, { $set: { response } });
}

export async function rejectIfDuplicate(
  uid: string,
  route: string,
  key: string | undefined,
  ttlHours: number,
): Promise<void> {
  const started = await beginIdempotency(uid, route, key, ttlHours);
  if (key && !started.reserved) throw errors.conflict("Idempotency key already used");
}

export async function reuseOrBegin<T>(
  uid: string,
  route: string,
  key: string | undefined,
  ttlHours: number,
): Promise<{ hit: T } | { hit: null }> {
  if (!key) return { hit: null };
  const started = await beginIdempotency(uid, route, key, ttlHours);
  if (started.reserved) return { hit: null };
  const existing = await readIdempotency<T>(uid, route, key);
  if (existing) return { hit: existing };
  throw errors.conflict("Idempotency key already used");
}
