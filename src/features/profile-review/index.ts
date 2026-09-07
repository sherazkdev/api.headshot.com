import type { FastifyInstance } from "fastify";
import type { AuthValidator } from "../../plugins/auth-validator.js";
import { ProfileReviewController } from "./profile-review.controller.js";

export async function registerProfileReviewRoutes(
  app: FastifyInstance,
  controller: ProfileReviewController,
  auth: AuthValidator,
) {
  const secure = { preHandler: auth.hook() };
  app.post("/profile-review/analyze", secure, controller.analyze);
  app.get("/admin/profile-reviews", secure, controller.adminList);
}

export { ProfileReviewService } from "./profile-review.service.js";
export { ProfileReviewController } from "./profile-review.controller.js";
