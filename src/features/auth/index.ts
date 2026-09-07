import type { FastifyInstance } from "fastify";
import { AuthController } from "./auth.controller.js";
import type { AuthValidator } from "../../plugins/auth-validator.js";

export async function registerAuthRoutes(
  app: FastifyInstance,
  controller: AuthController,
  auth: AuthValidator,
) {
  app.post("/admin/login", controller.login);
  app.get("/admin/me", { preHandler: auth.hook() }, controller.me);
}

export { AuthController } from "./auth.controller.js";
export { AdminAuthService } from "./auth.service.js";
