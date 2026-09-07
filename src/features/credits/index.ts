import type { FastifyInstance } from "fastify";
import type { AuthValidator } from "../../plugins/auth-validator.js";
import { CreditsController } from "./credits.controller.js";

export async function registerCreditsRoutes(
  app: FastifyInstance,
  controller: CreditsController,
  auth: AuthValidator,
) {
  const secure = { preHandler: auth.hook() };
  app.get("/credits", secure, controller.get);
  app.post("/credits/consume", secure, controller.consume);
  app.post("/credits/can-proceed", secure, controller.canProceed);
  app.post("/credits/ad-reward/claim", secure, controller.claimAdReward);
  app.get("/credits/rules", secure, controller.rules);
}

export { CreditsService } from "./credits.service.js";
export { CreditsController } from "./credits.controller.js";
