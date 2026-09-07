import type { FastifyInstance } from "fastify";
import type { AuthValidator } from "../../plugins/auth-validator.js";
import { BrandingController } from "./branding.controller.js";

export async function registerBrandingRoutes(
  app: FastifyInstance,
  controller: BrandingController,
  auth: AuthValidator,
) {
  const secure = { preHandler: auth.hook() };
  app.post("/branding/analyze", secure, controller.analyze);
  app.post("/branding/improve", secure, controller.improve);
  app.get("/admin/branding", secure, controller.adminList);
}

export { BrandingService } from "./branding.service.js";
export { BrandingController } from "./branding.controller.js";
