import type { FastifyInstance } from "fastify";
import type { AuthValidator } from "../../plugins/auth-validator.js";
import { NotificationsController } from "./notifications.controller.js";

export async function registerNotificationRoutes(
  app: FastifyInstance,
  controller: NotificationsController,
  auth: AuthValidator,
) {
  const secure = { preHandler: auth.hook() };
  app.get("/notifications", secure, controller.list);
  app.patch("/notifications/:id/read", secure, controller.read);
  app.get("/admin/notifications", secure, controller.adminList);
  app.get("/admin/fcm", secure, controller.fcm);
  app.post("/admin/fcm/campaign", secure, controller.campaign);
}

export { NotificationsService } from "./notifications.service.js";
export { NotificationsController } from "./notifications.controller.js";
