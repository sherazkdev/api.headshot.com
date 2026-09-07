import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { parseBody } from "../../lib/zod.js";
import { ok } from "../../lib/errors.js";
import { AdminAuthService } from "./auth.service.js";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export class AuthController {
  constructor(private readonly service: AdminAuthService) {}

  login = async (req: FastifyRequest, reply: FastifyReply) => {
    const body = parseBody(loginSchema, req.body);
    const data = await this.service.login(body.email, body.password);
    reply.setCookie("admin_token", data.token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 12,
    });
    return ok(data);
  };

  me = async (req: FastifyRequest) => {
    return ok({ auth: req.auth });
  };
}
