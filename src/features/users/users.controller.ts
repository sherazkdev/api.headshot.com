import type { FastifyRequest } from "fastify";
import { z } from "zod";
import { parseBody, paginationQuery } from "../../lib/zod.js";
import { errors, ok } from "../../lib/errors.js";
import { walletView } from "../../lib/wallet.js";
import { AuthValidator } from "../../plugins/auth-validator.js";
import { UsersService } from "./users.service.js";

const patchSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  photoUrl: z.string().url().optional(),
});

const fcmSchema = z.object({
  token: z.string().min(10).max(4096),
  platform: z.enum(["android", "ios"]).default("android"),
});

const WALLET_FIELDS = [
  "credits",
  "passCredits",
  "passExpiresAt",
  "activePassId",
  "isPremium",
  "premiumStatus",
  "adRewardClaimed",
  "welcomeBonusGranted",
  "premiumPlanId",
  "purchaseId",
];

export class UsersController {
  constructor(
    private readonly service: UsersService,
    private readonly auth: AuthValidator,
  ) {}

  bootstrap = async (req: FastifyRequest) => {
    const user = this.auth.requireUser(req);
    const auth = req.auth;
    return ok(
      await this.service.bootstrap({
        uid: user.uid,
        email: auth?.kind === "user" ? auth.email : undefined,
        name: auth?.kind === "user" ? auth.name : undefined,
      }),
    );
  };

  profile = async (req: FastifyRequest) => {
    const { uid } = this.auth.requireUser(req);
    return ok(await this.service.profile(uid));
  };

  update = async (req: FastifyRequest) => {
    const { uid } = this.auth.requireUser(req);
    const raw = req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {};
    const forbidden = WALLET_FIELDS.filter((field) => Object.prototype.hasOwnProperty.call(raw, field));
    if (forbidden.length) throw errors.validation("Wallet fields cannot be updated from client", { fields: forbidden });
    const body = parseBody(patchSchema, req.body);
    return ok(await this.service.updateProfile(uid, body));
  };

  remove = async (req: FastifyRequest) => {
    const { uid } = this.auth.requireUser(req);
    return ok(await this.service.deleteAccount(uid));
  };

  fcm = async (req: FastifyRequest) => {
    const { uid } = this.auth.requireUser(req);
    const body = parseBody(fcmSchema, req.body);
    return ok(await this.service.setFcm(uid, body.token, body.platform ?? "android"));
  };

  adminList = async (req: FastifyRequest) => {
    this.auth.requireAdmin(req);
    const query = paginationQuery.parse(req.query);
    const q = typeof (req.query as { q?: string }).q === "string" ? (req.query as { q?: string }).q : undefined;
    const data = await this.service.adminList(query.page, query.per_page, q);
    return ok({
      ...data,
      items: data.items.map((u) => ({ ...u.toObject(), wallet: walletView(u) })),
    });
  };

  adminGet = async (req: FastifyRequest) => {
    this.auth.requireAdmin(req);
    const uid = (req.params as { uid: string }).uid;
    const user = await this.service.adminGet(uid);
    return ok({ ...user.toObject(), wallet: walletView(user) });
  };

  adminStatus = async (req: FastifyRequest) => {
    this.auth.requireWriteAdmin(req);
    const uid = (req.params as { uid: string }).uid;
    const body = parseBody(z.object({ accountStatus: z.enum(["active", "suspended", "deleted"]) }), req.body);
    return ok(await this.service.setStatus(uid, body.accountStatus));
  };
}
