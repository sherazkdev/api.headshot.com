import type { FastifyRequest } from "fastify";
import { z } from "zod";
import { parseBody } from "../../lib/zod.js";
import { ok } from "../../lib/errors.js";
import { AuthValidator } from "../../plugins/auth-validator.js";
import { RemoteConfigService } from "./remote-config.service.js";

export class RemoteConfigController {
  constructor(
    private readonly service: RemoteConfigService,
    private readonly auth: AuthValidator,
  ) {}

  list = async (req: FastifyRequest) => {
    this.auth.requireAdmin(req);
    return ok(await this.service.list());
  };

  save = async (req: FastifyRequest) => {
    this.auth.requireWriteAdmin(req);
    const body = parseBody(z.object({ key: z.string(), value: z.string() }), req.body);
    const email = req.auth?.kind === "admin" ? req.auth.email : "api-key";
    return ok(await this.service.save(body.key, body.value, email));
  };

  publish = async (req: FastifyRequest) => {
    this.auth.requireWriteAdmin(req);
    const email = req.auth?.kind === "admin" ? req.auth.email : "api-key";
    return ok(await this.service.publish(email));
  };
}
