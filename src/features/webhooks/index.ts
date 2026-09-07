import type { FastifyInstance } from "fastify";
import type { AuthValidator } from "../../plugins/auth-validator.js";
import { WebhooksController } from "./webhooks.controller.js";

export async function registerWebhookRoutes(
  app: FastifyInstance,
  controller: WebhooksController,
  auth: AuthValidator,
) {
  app.post("/webhooks/google-play", controller.play);
  app.get("/webhooks/admob-ssv", controller.admob);
  app.post("/webhooks/app-store", controller.appStore);
  app.get("/admin/webhooks", { preHandler: auth.hook() }, controller.adminList);
}

export { WebhooksService } from "./webhooks.service.js";
export { WebhooksController } from "./webhooks.controller.js";
