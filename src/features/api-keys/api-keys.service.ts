import { API_KEY_PREFIX_LIVE, API_KEY_PREFIX_TEST } from "../../config/credits.js";
import { errors } from "../../lib/errors.js";
import { maskKey, randomToken, sha256 } from "../../lib/crypto.js";
import { ApiKeyModel } from "../../models/index.js";
import { MemoryCache } from "../../cache/index.js";
import { pageMeta } from "../../lib/zod.js";

export class ApiKeysService {
  constructor(private readonly cache: MemoryCache) {}

  async list(page: number, perPage: number, status?: string) {
    const filter = status && status !== "all" ? { status } : {};
    const [items, total, counts] = await Promise.all([
      ApiKeyModel.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * perPage)
        .limit(perPage),
      ApiKeyModel.countDocuments(filter),
      this.counts(),
    ]);
    return {
      items: items.map((k) => this.public(k)),
      meta: pageMeta(page, perPage, total),
      counts,
    };
  }

  async generate(input: {
    name: string;
    role: "admin" | "read_only" | "developer";
    ownerEmail: string;
    ownerName: string;
    env?: "live" | "test";
  }) {
    const prefixBase = input.env === "test" ? API_KEY_PREFIX_TEST : API_KEY_PREFIX_LIVE;
    const secret = randomToken(24);
    const raw = `${prefixBase}${secret}`;
    const prefix = `${prefixBase}${secret.slice(0, 8)}`;
    const doc = await ApiKeyModel.create({
      name: input.name,
      role: input.role,
      ownerEmail: input.ownerEmail,
      ownerName: input.ownerName,
      prefix,
      hash: sha256(raw),
      status: "never_used",
    });
    return { ...this.public(doc), plaintext: raw };
  }

  async rotate(id: string, actor: { email: string; name: string }) {
    const existing = await ApiKeyModel.findById(id);
    if (!existing) throw errors.notFound("API key not found");
    existing.status = "revoked";
    existing.revokedAt = new Date();
    await existing.save();
    this.cache.delPrefix("apikey:");
    return this.generate({
      name: existing.name,
      role: existing.role,
      ownerEmail: actor.email,
      ownerName: actor.name,
    });
  }

  async revoke(id: string) {
    const existing = await ApiKeyModel.findById(id);
    if (!existing) throw errors.notFound("API key not found");
    existing.status = "revoked";
    existing.revokedAt = new Date();
    await existing.save();
    this.cache.delPrefix("apikey:");
    return this.public(existing);
  }

  async stats() {
    const counts = await this.counts();
    const usedToday = await ApiKeyModel.aggregate<{ total: number }>([
      {
        $match: {
          lastUsedAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        },
      },
      { $group: { _id: null, total: { $sum: "$requestCount" } } },
    ]);
    return {
      activeKeys: counts.active,
      usedToday: usedToday[0]?.total ?? 0,
      unused30Days: counts.idle,
      revoked: counts.revoked,
      health: {
        active: counts.active,
        idle: counts.idle,
        neverUsed: counts.never_used,
        revoked: counts.revoked,
      },
    };
  }

  private async counts() {
    const rows = await ApiKeyModel.aggregate<{ _id: string; n: number }>([
      { $group: { _id: "$status", n: { $sum: 1 } } },
    ]);
    const map = Object.fromEntries(rows.map((r) => [r._id, r.n]));
    return {
      all: Object.values(map).reduce((a, b) => a + b, 0),
      active: map.active ?? 0,
      idle: map.idle ?? 0,
      never_used: map.never_used ?? 0,
      revoked: map.revoked ?? 0,
    };
  }

  private public(doc: { toObject: () => Record<string, unknown>; prefix: string; hash?: string }) {
    const o = doc.toObject();
    delete o.hash;
    return { ...o, prefix: maskKey(doc.prefix) };
  }
}
