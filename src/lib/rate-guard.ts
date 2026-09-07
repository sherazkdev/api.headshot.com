import { errors } from "./errors.js";

export class RateGuard {
  private readonly buckets = new Map<string, number[]>();

  hit(scope: string, id: string, max: number, windowMs: number): void {
    const key = `${scope}:${id}`;
    const now = Date.now();
    const next = (this.buckets.get(key) ?? []).filter((t) => now - t < windowMs);
    if (next.length >= max) throw errors.rateLimited();
    next.push(now);
    this.buckets.set(key, next);
  }
}

export const rateGuard = new RateGuard();
