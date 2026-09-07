import type { FastifyInstance } from "fastify";
import type { AuthValidator } from "../../plugins/auth-validator.js";
import { SubscriptionsController } from "./subscriptions.controller.js";

export async function registerSubscriptionRoutes(
  app: FastifyInstance,
  controller: SubscriptionsController,
  auth: AuthValidator,
) {
  const secure = { preHandler: auth.hook() };
  app.post("/subscriptions/verify", secure, controller.verify);
  app.post("/subscriptions/sync", secure, controller.sync);
  app.post("/subscriptions/restore", secure, controller.restore);
  app.get("/purchases", secure, controller.purchases);
  app.get("/packs", controller.packs);
  app.get("/admin/purchases", secure, controller.adminPurchases);
  app.get("/admin/subscriptions", secure, controller.adminSubs);
}

export { SubscriptionsService } from "./subscriptions.service.js";
export { SubscriptionsController } from "./subscriptions.controller.js";
