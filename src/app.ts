import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import jwt from "@fastify/jwt";
import cookie from "@fastify/cookie";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import underPressure from "@fastify/under-pressure";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import type { AppConfig } from "./config/index.js";
import { buildOpenApiDocument } from "./docs/openapi.js";
import { AppError, errorEnvelope, rewriteFastifyErrorPayload, toClientError } from "./lib/errors.js";
import { MemoryCache } from "./cache/index.js";
import { MemoryQueue } from "./queue/index.js";
import { FirebaseAuth } from "./lib/firebase-auth.js";
import { GeminiClient, BflClient } from "./lib/ai-providers.js";
import { LocalStorage } from "./lib/storage.js";
import { AuthValidator } from "./plugins/auth-validator.js";
import { AdminAuthService, AuthController, registerAuthRoutes } from "./features/auth/index.js";
import { CreditsService, CreditsController, registerCreditsRoutes } from "./features/credits/index.js";
import { UsersService, UsersController, registerUsersRoutes } from "./features/users/index.js";
import { ApiKeysService, ApiKeysController, registerApiKeyRoutes } from "./features/api-keys/index.js";
import { HeadshotsService, HeadshotsController, registerHeadshotRoutes } from "./features/headshots/index.js";
import { BrandingService, BrandingController, registerBrandingRoutes } from "./features/branding/index.js";
import {
  ProfileReviewService,
  ProfileReviewController,
  registerProfileReviewRoutes,
} from "./features/profile-review/index.js";
import {
  SubscriptionsService,
  SubscriptionsController,
  registerSubscriptionRoutes,
} from "./features/subscriptions/index.js";
import { ProjectsService, ProjectsController, registerProjectRoutes } from "./features/projects/index.js";
import {
  NotificationsService,
  NotificationsController,
  registerNotificationRoutes,
} from "./features/notifications/index.js";
import { WebhooksService, WebhooksController, registerWebhookRoutes } from "./features/webhooks/index.js";
import {
  RemoteConfigService,
  RemoteConfigController,
  registerRemoteConfigRoutes,
} from "./features/remote-config/index.js";
import { AnalyticsService, AnalyticsController, registerAnalyticsRoutes } from "./features/analytics/index.js";
import { registerHealthRoutes } from "./features/health/index.js";

export async function buildApp(config: AppConfig): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: config.isProd ? "info" : "debug",
    },
    trustProxy: true,
    requestTimeout: Math.max(config.AI_REQUEST_TIMEOUT_MS, 300_000),
    // 0 = do not kill long Gemini calls. 10s inactivity was closing /branding/improve → nginx 502.
    connectionTimeout: 0,
    keepAliveTimeout: 310_000,
    bodyLimit: config.MAX_UPLOAD_MB * 1024 * 1024,
  });

  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, {
    origin: [
      config.ADMIN_ORIGIN,
      "http://localhost:3001",
      "https://aiheadshotapi.com",
      config.PUBLIC_BASE_URL,
    ].filter((origin): origin is string => Boolean(origin)),
    credentials: true,
  });
  await app.register(cookie);
  await app.register(jwt, { secret: config.JWT_SECRET });
  await app.register(multipart, { limits: { fileSize: config.MAX_UPLOAD_MB * 1024 * 1024 } });
  await app.register(rateLimit, {
    max: 100,
    timeWindow: "1 minute",
    allowList: ["127.0.0.1"],
  });
  await app.register(underPressure, {
    maxEventLoopDelay: 2000,
    maxHeapUsedBytes: 1_500_000_000,
    maxRssBytes: 2_000_000_000,
    retryAfter: 10,
  });
  await app.register(swagger, {
    mode: "static",
    specification: { document: buildOpenApiDocument(config) as never },
  });
  await app.register(swaggerUi, {
    routePrefix: "/docs",
    uiConfig: {
      docExpansion: "list",
      deepLinking: true,
      persistAuthorization: true,
      displayRequestDuration: true,
      tryItOutEnabled: true,
    },
  });

  const cache = new MemoryCache(50_000);
  const queue = new MemoryQueue(config.MAX_INFLIGHT_AI);
  const firebase = new FirebaseAuth(config);
  const auth = new AuthValidator(firebase, cache, { allowDevUserJwt: !config.isProd });
  const gemini = new GeminiClient(config);
  const bfl = new BflClient(config);
  const storage = new LocalStorage();

  const credits = new CreditsService(cache, config);
  const users = new UsersService(cache, storage);
  const apiKeys = new ApiKeysService(cache);
  const headshots = new HeadshotsService(config, credits, queue, storage, gemini, bfl);
  const branding = new BrandingService(config, credits, queue, gemini, storage);
  const reviews = new ProfileReviewService(config, credits, gemini, storage);
  const subs = new SubscriptionsService(config);
  const projects = new ProjectsService();
  const notifications = new NotificationsService();
  const webhooks = new WebhooksService(credits, subs, config);
  const remoteConfig = new RemoteConfigService();
  const analytics = new AnalyticsService(queue);
  const adminAuth = new AdminAuthService(config, app);

  const prefix = config.API_BASE_PATH;

  const handleError: Parameters<FastifyInstance["setErrorHandler"]>[0] = (err, req, reply) => {
    const mapped = toClientError(err);
    if (mapped) return reply.status(mapped.httpStatus).send(errorEnvelope(mapped));
    req.log.error(err);
    const message = config.isProd ? "Internal error" : err instanceof Error ? err.message : "Internal error";
    return reply.status(500).send(errorEnvelope(new AppError(500, "SERVER_ERROR", message)));
  };

  await app.register(
    async (api) => {
      api.addHook("onSend", async (_req, _reply, payload) => rewriteFastifyErrorPayload(payload));
      api.setErrorHandler(handleError);
      await registerHealthRoutes(api, queue);
      await registerAuthRoutes(api, new AuthController(adminAuth), auth);
      await registerCreditsRoutes(api, new CreditsController(credits, auth), auth);
      await registerUsersRoutes(api, new UsersController(users, auth), auth);
      await registerApiKeyRoutes(api, new ApiKeysController(apiKeys, auth), auth);
      await registerHeadshotRoutes(api, new HeadshotsController(headshots, auth), auth);
      await registerBrandingRoutes(api, new BrandingController(branding, auth), auth);
      await registerProfileReviewRoutes(api, new ProfileReviewController(reviews, auth), auth);
      await registerSubscriptionRoutes(api, new SubscriptionsController(subs, auth), auth);
      await registerProjectRoutes(api, new ProjectsController(projects, auth), auth);
      await registerNotificationRoutes(api, new NotificationsController(notifications, auth), auth);
      await registerWebhookRoutes(api, new WebhooksController(webhooks, auth), auth);
      await registerRemoteConfigRoutes(api, new RemoteConfigController(remoteConfig, auth), auth);
      await registerAnalyticsRoutes(api, new AnalyticsController(analytics, auth), auth);
    },
    { prefix },
  );

  app.addHook("onSend", async (_req, _reply, payload) => rewriteFastifyErrorPayload(payload));

  app.setErrorHandler((err, req, reply) => {
    const mapped = toClientError(err);
    if (mapped) {
      return reply.status(mapped.httpStatus).send(errorEnvelope(mapped));
    }
    req.log.error(err);
    const message = config.isProd ? "Internal error" : err instanceof Error ? err.message : "Internal error";
    return reply.status(500).send(errorEnvelope(new AppError(500, "SERVER_ERROR", message)));
  });

  queue.start();
  await remoteConfig.ensure();
  app.addHook("onClose", async () => queue.stop());
  return app;
}
