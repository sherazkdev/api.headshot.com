import type { FastifyInstance } from "fastify";
import type { AuthValidator } from "../../plugins/auth-validator.js";
import { RemoteConfigController } from "./remote-config.controller.js";

export async function registerRemoteConfigRoutes(
  app: FastifyInstance,
  controller: RemoteConfigController,
  auth: AuthValidator,
) {
  const secure = { preHandler: auth.hook() };
  app.get("/admin/remote-config", secure, controller.list);
  app.patch("/admin/remote-config", secure, controller.save);
  app.post("/admin/remote-config/publish", secure, controller.publish);
}

export { RemoteConfigService } from "./remote-config.service.js";
export { RemoteConfigController } from "./remote-config.controller.js";
