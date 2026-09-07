import type { FastifyRequest } from "fastify";
import { z } from "zod";
import { parseBody, paginationQuery } from "../../lib/zod.js";
import { ok } from "../../lib/errors.js";
import { AuthValidator } from "../../plugins/auth-validator.js";
import { SubscriptionsService } from "./subscriptions.service.js";

export class SubscriptionsController {
  constructor(
    private readonly service: SubscriptionsService,
    private readonly auth: AuthValidator,
  ) {}

  verify = async (req: FastifyRequest) => {
    const { uid } = this.auth.requireUser(req);
    const body = parseBody(
      z.object({
        platform: z.enum(["android", "ios"]),
        productId: z.enum(["sub_weekly", "sub_monthly", "sub_yearly"]),
        purchaseToken: z.string().optional(),
        transactionId: z.string().optional(),
        packageName: z.string().optional(),
      }),
      req.body,
    );
    return ok(await this.service.verify(uid, body));
  };

  sync = async (req: FastifyRequest) => {
    const { uid } = this.auth.requireUser(req);
    return ok(await this.service.sync(uid));
  };

  restore = async (req: FastifyRequest) => {
    const { uid } = this.auth.requireUser(req);
    const body = parseBody(z.object({ tokens: z.array(z.string()).default([]) }), req.body ?? {});
    return ok(await this.service.restore(uid, body.tokens ?? []));
  };

  purchases = async (req: FastifyRequest) => {
    const { uid } = this.auth.requireUser(req);
    const query = paginationQuery.parse(req.query);
    return ok(await this.service.listPurchases(uid, query.page, query.per_page));
  };

  packs = async () => ok(this.service.packs());

  adminPurchases = async (req: FastifyRequest) => {
    this.auth.requireAdmin(req);
    const query = paginationQuery.parse(req.query);
    return ok(await this.service.listPurchases(undefined, query.page, query.per_page));
  };

  adminSubs = async (req: FastifyRequest) => {
    this.auth.requireAdmin(req);
    const query = paginationQuery.parse(req.query);
    const { UserModel } = await import("../../models/index.js");
    const filter = { isPremium: true };
    const [items, total] = await Promise.all([
      UserModel.find(filter)
        .sort({ premiumExpiresAt: 1 })
        .skip((query.page - 1) * query.per_page)
        .limit(query.per_page),
      UserModel.countDocuments(filter),
    ]);
    return ok({ items, total });
  };
}
