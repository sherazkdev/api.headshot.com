import type { FastifyInstance } from "fastify";
import type { AuthValidator } from "../../plugins/auth-validator.js";
import { AnalyticsController } from "./analytics.controller.js";

export async function registerAnalyticsRoutes(
  app: FastifyInstance,
  controller: AnalyticsController,
  auth: AuthValidator,
) {
  const secure = { preHandler: auth.hook() };
  app.get("/admin/overview", secure, controller.overview);
  app.get("/admin/jobs", secure, controller.jobs);
  app.get("/admin/ai-usage", secure, controller.usage);
  app.get("/admin/wallets", secure, controller.wallets);
}

export { AnalyticsService } from "./analytics.service.js";
export { AnalyticsController } from "./analytics.controller.js";
