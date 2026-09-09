import type { FastifyRequest } from "fastify";
import { z } from "zod";
import { parseBody, paginationQuery } from "../../lib/zod.js";
import { ok } from "../../lib/errors.js";
import { rateGuard } from "../../lib/rate-guard.js";
import { AuthValidator } from "../../plugins/auth-validator.js";
import { BrandingService } from "./branding.service.js";

export class BrandingController {
  constructor(
    private readonly service: BrandingService,
    private readonly auth: AuthValidator,
  ) {}

  analyze = async (req: FastifyRequest) => {
    const { uid } = this.auth.requireUser(req);
    rateGuard.hit("branding.analyze", uid, 20, 3600_000);
    const body = parseBody(z.object({ uploadId: z.string() }), req.body);
    const key = header(req, "idempotency-key");
    return ok(await this.service.analyze(uid, body.uploadId, key));
  };

  improve = async (req: FastifyRequest) => {
    const { uid } = this.auth.requireUser(req);
    rateGuard.hit("branding.improve", uid, 10, 3600_000);
    if (typeof req.raw.setTimeout === "function") req.raw.setTimeout(0);
    const body = parseBody(z.object({ uploadId: z.string(), enhancementPrompt: z.string().optional() }), req.body);
    const key = header(req, "idempotency-key");
    return ok(await this.service.improve(uid, body.uploadId, body.enhancementPrompt, key));
  };

  adminList = async (req: FastifyRequest) => {
    this.auth.requireAdmin(req);
    const query = paginationQuery.parse(req.query);
    return ok(await this.service.adminList(query.page, query.per_page));
  };
}

function header(req: FastifyRequest, name: string): string | undefined {
  const value = req.headers[name];
  return Array.isArray(value) ? value[0] : value;
}
