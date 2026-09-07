import type { FastifyRequest } from "fastify";
import { z } from "zod";
import { CREDIT_COSTS } from "../../config/credits.js";
import { parseBody } from "../../lib/zod.js";
import { ok } from "../../lib/errors.js";
import { rateGuard } from "../../lib/rate-guard.js";
import { AuthValidator } from "../../plugins/auth-validator.js";
import { CreditsService } from "./credits.service.js";

const consumeSchema = z.object({
  amount: z.number().int().positive(),
  reason: z.enum(["headshot_generation", "branding_analyze", "branding_improve", "profile_review"]),
  referenceId: z.string().optional(),
});

const canSchema = z.object({ amount: z.number().int().positive() });
const claimSchema = z.object({ ssvTransactionId: z.string().min(1).optional() });

export class CreditsController {
  constructor(
    private readonly service: CreditsService,
    private readonly auth: AuthValidator,
  ) {}

  get = async (req: FastifyRequest) => {
    const { uid } = this.auth.requireUser(req);
    return ok(await this.service.getWallet(uid));
  };

  consume = async (req: FastifyRequest) => {
    const { uid } = this.auth.requireUser(req);
    rateGuard.hit("credits.consume", uid, 60, 3600_000);
    const body = parseBody(consumeSchema, req.body);
    const key = header(req, "idempotency-key");
    return ok(await this.service.consume(uid, body.amount, body.reason, body.referenceId, key));
  };

  canProceed = async (req: FastifyRequest) => {
    const { uid } = this.auth.requireUser(req);
    const body = parseBody(canSchema, req.body);
    return ok(await this.service.canProceed(uid, body.amount));
  };

  claimAdReward = async (req: FastifyRequest) => {
    const { uid } = this.auth.requireUser(req);
    const body = parseBody(claimSchema, req.body ?? {});
    return ok(await this.service.claimAdReward(uid, body.ssvTransactionId));
  };

  rules = async () => ok(CREDIT_COSTS);
}

function header(req: FastifyRequest, name: string): string | undefined {
  const value = req.headers[name];
  return Array.isArray(value) ? value[0] : value;
}
