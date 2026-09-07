import type { FastifyInstance } from "fastify";
import type { AuthValidator } from "../../plugins/auth-validator.js";
import { ProjectsController } from "./projects.controller.js";

export async function registerProjectRoutes(
  app: FastifyInstance,
  controller: ProjectsController,
  auth: AuthValidator,
) {
  const secure = { preHandler: auth.hook() };
  app.get("/projects", secure, controller.list);
  app.post("/projects", secure, controller.create);
  app.get("/projects/:id", secure, controller.get);
  app.patch("/projects/:id", secure, controller.patch);
  app.delete("/projects/:id", secure, controller.remove);
  app.get("/admin/projects", secure, controller.adminList);
}

export { ProjectsService } from "./projects.service.js";
export { ProjectsController } from "./projects.controller.js";
