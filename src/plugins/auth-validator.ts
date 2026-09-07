import type { FastifyReply, FastifyRequest } from "fastify";
import { API_KEY_HEADER } from "../config/credits.js";
import { AppError, errors } from "../lib/errors.js";
import { sha256 } from "../lib/crypto.js";
import { FirebaseAuth } from "../lib/firebase-auth.js";
import { ApiKeyModel } from "../models/index.js";
import { MemoryCache } from "../cache/index.js";

export type AuthPrincipal =
  | { kind: "user"; uid: string; email?: string; name?: string }
  | { kind: "api_key"; keyId: string; role: "admin" | "read_only" | "developer"; ownerEmail: string }
  | { kind: "admin"; email: string };

declare module "fastify" {
  interface FastifyRequest {
    auth?: AuthPrincipal;
  }
}

export class AuthValidator {
  constructor(
    private readonly firebase: FirebaseAuth,
    private readonly cache: MemoryCache,
    private readonly options: { allowDevUserJwt?: boolean } = {},
  ) {}

  async authenticate(req: FastifyRequest): Promise<AuthPrincipal> {
    const apiKey = this.header(req, API_KEY_HEADER) ?? this.header(req, "x-api-key");
    if (apiKey) return this.fromApiKey(apiKey);

    const bearer = this.bearer(req) ?? this.cookie(req);
    if (bearer) {
      try {
        const decoded = req.server.jwt.verify<{ sub?: string; email?: string; kind?: string; name?: string }>(bearer);
        if (decoded.kind === "admin" && decoded.email) return { kind: "admin", email: decoded.email };
        if (decoded.kind === "user" && decoded.sub && this.options.allowDevUserJwt) {
          return { kind: "user", uid: decoded.sub, email: decoded.email, name: decoded.name };
        }
      } catch {
        /* not an admin/dev JWT */
      }
      try {
        const user = await this.firebase.verifyIdToken(bearer);
        return { kind: "user", uid: user.uid, email: user.email, name: user.name };
      } catch (err) {
        if (err instanceof AppError) throw err;
        throw errors.unauthorized("Invalid Firebase token");
      }
    }

    throw errors.unauthorized("Missing Bearer token or x-api-key");
  }

  requireUser(req: FastifyRequest): { uid: string } {
    const auth = req.auth;
    if (!auth) throw errors.unauthorized();
    if (auth.kind === "user") return { uid: auth.uid };
    throw errors.unauthorized("Firebase user token required");
  }

  requireAdmin(req: FastifyRequest): void {
    const auth = req.auth;
    if (!auth) throw errors.unauthorized();
    if (auth.kind === "admin") return;
    if (auth.kind === "api_key" && (auth.role === "admin" || auth.role === "read_only")) return;
    throw errors.forbidden("Admin or x-api-key with admin/read_only role required");
  }

  requireWriteAdmin(req: FastifyRequest): void {
    const auth = req.auth;
    if (!auth) throw errors.unauthorized();
    if (auth.kind === "admin") return;
    if (auth.kind === "api_key" && auth.role === "admin") return;
    throw errors.forbidden("Admin write access required");
  }

  hook() {
    return async (req: FastifyRequest, _reply: FastifyReply) => {
      req.auth = await this.authenticate(req);
    };
  }

  private async fromApiKey(raw: string): Promise<AuthPrincipal> {
    const hash = sha256(raw);
    const cached = this.cache.get<AuthPrincipal>(`apikey:${hash}`);
    if (cached) return cached;
    const doc = await ApiKeyModel.findOne({ hash, status: { $ne: "revoked" } });
    if (!doc) throw errors.unauthorized("Invalid x-api-key");
    const principal: AuthPrincipal = {
      kind: "api_key",
      keyId: String(doc._id),
      role: doc.role,
      ownerEmail: doc.ownerEmail,
    };
    this.cache.set(`apikey:${hash}`, principal, 30_000);
    void ApiKeyModel.updateOne(
      { _id: doc._id },
      { $inc: { requestCount: 1 }, $set: { lastUsedAt: new Date(), status: "active" } },
    );
    return principal;
  }

  private bearer(req: FastifyRequest): string | null {
    const header = this.header(req, "authorization");
    if (!header?.startsWith("Bearer ")) return null;
    return header.slice(7).trim();
  }

  private cookie(req: FastifyRequest): string | null {
    const token = req.cookies?.admin_token;
    return token || null;
  }

  private header(req: FastifyRequest, name: string): string | undefined {
    const value = req.headers[name];
    return Array.isArray(value) ? value[0] : value;
  }
}
