import type { FastifyRequest } from "fastify";
import { paginationQuery } from "../../lib/zod.js";
import { ok } from "../../lib/errors.js";
import { AuthValidator } from "../../plugins/auth-validator.js";
import { WebhooksService } from "./webhooks.service.js";

export class WebhooksController {
  constructor(
    private readonly service: WebhooksService,
    private readonly auth: AuthValidator,
  ) {}

  play = async (req: FastifyRequest) => ok(await this.service.googlePlay((req.body ?? {}) as Record<string, unknown>));

  appStore = async (req: FastifyRequest) => ok(await this.service.appStore((req.body ?? {}) as Record<string, unknown>));

  admob = async (req: FastifyRequest) =>
    ok(await this.service.admobSsv((req.query ?? {}) as Record<string, unknown>));

  adminList = async (req: FastifyRequest) => {
    this.auth.requireAdmin(req);
    const query = paginationQuery.parse(req.query);
    return ok(await this.service.adminList(query.page, query.per_page));
  };
}
