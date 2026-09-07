import type { FastifyRequest } from "fastify";
import { z } from "zod";
import { parseBody, paginationQuery } from "../../lib/zod.js";
import { ok } from "../../lib/errors.js";
import { rateGuard } from "../../lib/rate-guard.js";
import { AuthValidator } from "../../plugins/auth-validator.js";
import { ProfileReviewService } from "./profile-review.service.js";

export class ProfileReviewController {
  constructor(
    private readonly service: ProfileReviewService,
    private readonly auth: AuthValidator,
  ) {}

  analyze = async (req: FastifyRequest) => {
    const { uid } = this.auth.requireUser(req);
    rateGuard.hit("profile-review.analyze", uid, 10, 3600_000);
    const body = parseBody(z.object({ uploadIds: z.array(z.string()).min(2) }), req.body);
    const key = req.headers["idempotency-key"];
    return ok(await this.service.analyze(uid, body.uploadIds, Array.isArray(key) ? key[0] : key));
  };

  adminList = async (req: FastifyRequest) => {
    this.auth.requireAdmin(req);
    const query = paginationQuery.parse(req.query);
    return ok(await this.service.adminList(query.page, query.per_page));
  };
}
