import type { FastifyRequest } from "fastify";
import { z } from "zod";
import { paginationQuery, parseBody } from "../../lib/zod.js";
import { ok } from "../../lib/errors.js";
import { AuthValidator } from "../../plugins/auth-validator.js";
import { NotificationsService } from "./notifications.service.js";

export class NotificationsController {
  constructor(
    private readonly service: NotificationsService,
    private readonly auth: AuthValidator,
  ) {}

  list = async (req: FastifyRequest) => {
    const { uid } = this.auth.requireUser(req);
    const query = paginationQuery.parse(req.query);
    return ok(await this.service.list(uid, query.page, query.per_page));
  };

  read = async (req: FastifyRequest) => {
    const { uid } = this.auth.requireUser(req);
    return ok(await this.service.markRead(uid, (req.params as { id: string }).id));
  };

  adminList = async (req: FastifyRequest) => {
    this.auth.requireAdmin(req);
    const query = paginationQuery.parse(req.query);
    return ok(await this.service.adminList(query.page, query.per_page));
  };

  fcm = async (req: FastifyRequest) => {
    this.auth.requireAdmin(req);
    return ok(await this.service.fcmOverview());
  };

  campaign = async (req: FastifyRequest) => {
    this.auth.requireWriteAdmin(req);
    const body = parseBody(
      z.object({
        title: z.string().min(1).max(80),
        body: z.string().min(1).max(500),
        audience: z.enum(["all", "subscribers", "inactive"]).default("all"),
      }),
      req.body,
    );
    return ok(await this.service.campaign(body));
  };
}
