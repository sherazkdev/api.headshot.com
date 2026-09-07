import type { FastifyInstance } from "fastify";
import type { AuthValidator } from "../../plugins/auth-validator.js";
import { UsersController } from "./users.controller.js";

export async function registerUsersRoutes(
  app: FastifyInstance,
  controller: UsersController,
  auth: AuthValidator,
) {
  const secure = { preHandler: auth.hook() };
  app.get("/user/profile", secure, controller.profile);
  app.patch("/user/profile", secure, controller.update);
  app.post("/user/bootstrap", secure, controller.bootstrap);
  app.delete("/user/delete", secure, controller.remove);
  app.post("/users/fcm-token", secure, controller.fcm);
  app.get("/admin/users", secure, controller.adminList);
  app.get("/admin/users/:uid", secure, controller.adminGet);
  app.patch("/admin/users/:uid/status", secure, controller.adminStatus);
}

export { UsersService } from "./users.service.js";
export { UsersController } from "./users.controller.js";
