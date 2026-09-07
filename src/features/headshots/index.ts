import type { FastifyInstance } from "fastify";
import type { AuthValidator } from "../../plugins/auth-validator.js";
import { HeadshotsController } from "./headshots.controller.js";

export async function registerHeadshotRoutes(
  app: FastifyInstance,
  controller: HeadshotsController,
  auth: AuthValidator,
) {
  const secure = { preHandler: auth.hook() };
  app.post("/headshots/upload", secure, controller.upload);
  app.post("/headshots/generate", secure, controller.generate);
  app.get("/headshots/jobs/:jobId", secure, controller.job);
  app.post("/headshots/jobs/:jobId/cancel", secure, controller.cancel);
  app.get("/headshots/results", secure, controller.results);
  app.get("/admin/headshots", secure, controller.adminList);
  app.get("/admin/headshots/:jobId", secure, controller.adminJob);
}

export { HeadshotsService } from "./headshots.service.js";
export { HeadshotsController } from "./headshots.controller.js";
