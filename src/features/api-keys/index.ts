import type { FastifyInstance } from "fastify";
import type { AuthValidator } from "../../plugins/auth-validator.js";
import { ApiKeysController } from "./api-keys.controller.js";

export async function registerApiKeyRoutes(
  app: FastifyInstance,
  controller: ApiKeysController,
  auth: AuthValidator,
) {
  const secure = { preHandler: auth.hook() };
  app.get("/admin/api-keys", secure, controller.list);
  app.get("/admin/api-keys/stats", secure, controller.stats);
  app.post("/admin/api-keys", secure, controller.create);
  app.post("/admin/api-keys/:id/rotate", secure, controller.rotate);
  app.post("/admin/api-keys/:id/revoke", secure, controller.revoke);
}

export { ApiKeysService } from "./api-keys.service.js";
export { ApiKeysController } from "./api-keys.controller.js";
