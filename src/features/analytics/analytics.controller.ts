import type { FastifyRequest } from "fastify";
import { paginationQuery } from "../../lib/zod.js";
import { ok } from "../../lib/errors.js";
import { walletView } from "../../lib/wallet.js";
import { AuthValidator } from "../../plugins/auth-validator.js";
import { AnalyticsService } from "./analytics.service.js";

export class AnalyticsController {
  constructor(
    private readonly service: AnalyticsService,
    private readonly auth: AuthValidator,
  ) {}

  overview = async (req: FastifyRequest) => {
    this.auth.requireAdmin(req);
    return ok(await this.service.overview());
  };

  jobs = async (req: FastifyRequest) => {
    this.auth.requireAdmin(req);
    const query = paginationQuery.parse(req.query);
    return ok(await this.service.jobs(query.page, query.per_page, (req.query as { status?: string }).status));
  };

  usage = async (req: FastifyRequest) => {
    this.auth.requireAdmin(req);
    return ok(await this.service.usage());
  };

  wallets = async (req: FastifyRequest) => {
    this.auth.requireAdmin(req);
    const query = paginationQuery.parse(req.query);
    const data = await this.service.wallets(query.page, query.per_page);
    return ok({ ...data, items: data.items.map((u) => ({ ...u.toObject(), wallet: walletView(u) })) });
  };
}
