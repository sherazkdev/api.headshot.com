import type { AppConfig } from "../config/index.js";

const envelope = {
  type: "object",
  properties: {
    success: { type: "boolean" },
    data: {},
    message: { type: "string" },
    error: {
      type: "object",
      properties: {
        code: { type: "string" },
        message: { type: "string" },
        details: { type: "object" },
      },
    },
  },
} as const;

function op(summary: string, opts: Record<string, unknown> = {}) {
  return { summary, tags: opts.tags ?? ["App"], security: opts.security, requestBody: opts.requestBody, parameters: opts.parameters, responses: { 200: { description: "OK", content: { "application/json": { schema: envelope } } }, 400: { description: "Bad request" }, 401: { description: "Unauthorized" }, 422: { description: "Validation error" } } };
}

const bearer = [{ bearerAuth: [] }];
const admin = [{ bearerAuth: [] }, { apiKey: [] }];
const json = (schema: Record<string, unknown>) => ({ content: { "application/json": { schema } } });

export const openApiDocument = {
  openapi: "3.0.3",
  info: {
    title: "Headshot AI API",
    version: "1.0.0",
    description:
      "Fastify + MongoDB backend. Admin dashboard at http://localhost:3001 proxies `/api-proxy/*` → `/v1/*`.\n\nAuth: `Authorization: Bearer <admin JWT | Firebase | dev user JWT>` or `x-api-key`.",
  },
  servers: [{ url: "/v1", description: "Same host (relative)" }],
  tags: [
    { name: "Health" },
    { name: "Auth" },
    { name: "User" },
    { name: "Credits" },
    { name: "Headshots" },
    { name: "Branding" },
    { name: "Reviews" },
    { name: "Subscriptions" },
    { name: "Projects" },
    { name: "Notifications" },
    { name: "Webhooks" },
    { name: "Admin" },
    { name: "API Keys" },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
      apiKey: { type: "apiKey", in: "header", name: "x-api-key" },
    },
  },
  paths: {
    "/health": { get: op("Health + queue", { tags: ["Health"], security: [] }) },
    "/styles": { get: op("Prompt / style catalog", { tags: ["Health"], security: [] }) },
    "/packs": { get: op("Credit packs", { tags: ["Subscriptions"], security: [] }) },

    "/admin/login": {
      post: op("Admin login", {
        tags: ["Auth"],
        security: [],
        requestBody: json({
          type: "object",
          required: ["email", "password"],
          properties: { email: { type: "string", format: "email" }, password: { type: "string", minLength: 8 } },
        }),
      }),
    },
    "/admin/me": { get: op("Current admin principal", { tags: ["Auth"], security: admin }) },

    "/user/profile": {
      get: op("User profile + wallet", { tags: ["User"], security: bearer }),
      patch: op("Update profile (wallet fields rejected)", {
        tags: ["User"],
        security: bearer,
        requestBody: json({ type: "object", properties: { name: { type: "string" } } }),
      }),
    },
    "/user/bootstrap": { post: op("Create/load user", { tags: ["User"], security: bearer }) },
    "/user/delete": { delete: op("Delete account", { tags: ["User"], security: bearer }) },
    "/users/fcm-token": {
      post: op("Register FCM token", {
        tags: ["User"],
        security: bearer,
        requestBody: json({
          type: "object",
          required: ["token"],
          properties: { token: { type: "string" }, platform: { type: "string", enum: ["android", "ios", "web"] } },
        }),
      }),
    },

    "/credits": { get: op("Wallet", { tags: ["Credits"], security: bearer }) },
    "/credits/rules": { get: op("Credit costs", { tags: ["Credits"], security: bearer }) },
    "/credits/consume": {
      post: op("Atomic consume", {
        tags: ["Credits"],
        security: bearer,
        requestBody: json({ type: "object", required: ["amount"], properties: { amount: { type: "number" }, reason: { type: "string" } } }),
      }),
    },
    "/credits/can-proceed": { post: op("Can proceed?", { tags: ["Credits"], security: bearer }) },
    "/credits/ad-reward/claim": { post: op("Claim ad reward (SSV)", { tags: ["Credits"], security: bearer }) },

    "/headshots/upload": { post: op("Upload source photo (multipart)", { tags: ["Headshots"], security: bearer }) },
    "/headshots/generate": { post: op("Queue generation", { tags: ["Headshots"], security: bearer }) },
    "/headshots/jobs/{jobId}": { get: op("Job status", { tags: ["Headshots"], security: bearer, parameters: [{ name: "jobId", in: "path", required: true, schema: { type: "string" } }] }) },
    "/headshots/jobs/{jobId}/cancel": { post: op("Cancel job", { tags: ["Headshots"], security: bearer, parameters: [{ name: "jobId", in: "path", required: true, schema: { type: "string" } }] }) },
    "/headshots/results": { get: op("User results", { tags: ["Headshots"], security: bearer }) },

    "/branding/analyze": { post: op("Branding analyze", { tags: ["Branding"], security: bearer }) },
    "/branding/improve": { post: op("Branding improve (100 credits + image)", { tags: ["Branding"], security: bearer }) },
    "/profile-review/analyze": { post: op("Profile review", { tags: ["Reviews"], security: bearer }) },

    "/subscriptions/verify": { post: op("Verify a real Google Play purchase token (Play service account required). Grants credits only if Play says ACTIVE.", { tags: ["Subscriptions"], security: bearer }) },
    "/subscriptions/sync": { post: op("Sync entitlement", { tags: ["Subscriptions"], security: bearer }) },
    "/subscriptions/restore": { post: op("Restore purchases", { tags: ["Subscriptions"], security: bearer }) },
    "/purchases": { get: op("User purchases", { tags: ["Subscriptions"], security: bearer }) },

    "/projects": {
      get: op("List projects", { tags: ["Projects"], security: bearer }),
      post: op("Create project", { tags: ["Projects"], security: bearer }),
    },
    "/projects/{id}": {
      get: op("Get project", { tags: ["Projects"], security: bearer, parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }] }),
      patch: op("Patch project", { tags: ["Projects"], security: bearer, parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }] }),
      delete: op("Soft-delete project", { tags: ["Projects"], security: bearer, parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }] }),
    },

    "/notifications": { get: op("User notifications", { tags: ["Notifications"], security: bearer }) },
    "/notifications/{id}/read": { patch: op("Mark read", { tags: ["Notifications"], security: bearer, parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }] }) },

    "/webhooks/google-play": { post: op("Play Billing RTDN", { tags: ["Webhooks"], security: [] }) },
    "/webhooks/admob-ssv": { get: op("AdMob SSV", { tags: ["Webhooks"], security: [] }) },
    "/webhooks/app-store": { post: op("App Store notification", { tags: ["Webhooks"], security: [] }) },

    "/admin/overview": { get: op("Dashboard KPIs", { tags: ["Admin"], security: admin }) },
    "/admin/users": { get: op("Users table", { tags: ["Admin"], security: admin }) },
    "/admin/users/{uid}": {
      get: op("User detail", { tags: ["Admin"], security: admin, parameters: [{ name: "uid", in: "path", required: true, schema: { type: "string" } }] }),
    },
    "/admin/users/{uid}/status": {
      patch: op("Suspend / activate user", {
        tags: ["Admin"],
        security: admin,
        parameters: [{ name: "uid", in: "path", required: true, schema: { type: "string" } }],
        requestBody: json({ type: "object", required: ["accountStatus"], properties: { accountStatus: { type: "string", enum: ["active", "suspended", "deleted"] } } }),
      }),
    },
    "/admin/wallets": { get: op("Wallets", { tags: ["Admin"], security: admin }) },
    "/admin/purchases": { get: op("Purchases / transactions", { tags: ["Admin"], security: admin }) },
    "/admin/subscriptions": { get: op("Subscriptions", { tags: ["Admin"], security: admin }) },
    "/admin/headshots": { get: op("Generation jobs", { tags: ["Admin"], security: admin }) },
    "/admin/headshots/{jobId}": { get: op("Job detail", { tags: ["Admin"], security: admin, parameters: [{ name: "jobId", in: "path", required: true, schema: { type: "string" } }] }) },
    "/admin/branding": { get: op("Branding jobs", { tags: ["Admin"], security: admin }) },
    "/admin/profile-reviews": { get: op("Profile reviews", { tags: ["Admin"], security: admin }) },
    "/admin/projects": { get: op("All projects", { tags: ["Admin"], security: admin }) },
    "/admin/notifications": { get: op("All notifications", { tags: ["Admin"], security: admin }) },
    "/admin/fcm": { get: op("FCM tokens + health", { tags: ["Admin"], security: admin }) },
    "/admin/fcm/campaign": {
      post: op("Send FCM campaign", {
        tags: ["Admin"],
        security: admin,
        requestBody: json({
          type: "object",
          required: ["title", "body"],
          properties: { title: { type: "string" }, body: { type: "string" }, audience: { type: "string", enum: ["all", "subscribers", "inactive"] } },
        }),
      }),
    },
    "/admin/ai-usage": { get: op("AI usage analytics", { tags: ["Admin"], security: admin }) },
    "/admin/jobs": { get: op("AI job queue", { tags: ["Admin"], security: admin }) },
    "/admin/webhooks": { get: op("Webhook events", { tags: ["Admin"], security: admin }) },
    "/admin/remote-config": {
      get: op("Remote config", { tags: ["Admin"], security: admin }),
      patch: op("Save flag", {
        tags: ["Admin"],
        security: admin,
        requestBody: json({ type: "object", required: ["key", "value"], properties: { key: { type: "string" }, value: { type: "string" } } }),
      }),
    },
    "/admin/remote-config/publish": { post: op("Publish remote config", { tags: ["Admin"], security: admin }) },

    "/admin/api-keys": {
      get: op("List API keys", { tags: ["API Keys"], security: admin }),
      post: op("Generate API key (plaintext once)", {
        tags: ["API Keys"],
        security: admin,
        requestBody: json({
          type: "object",
          required: ["name"],
          properties: { name: { type: "string" }, role: { type: "string", enum: ["admin", "read_only", "developer"] }, env: { type: "string" } },
        }),
      }),
    },
    "/admin/api-keys/stats": { get: op("API key stats", { tags: ["API Keys"], security: admin }) },
    "/admin/api-keys/{id}/rotate": { post: op("Rotate key", { tags: ["API Keys"], security: admin, parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }] }) },
    "/admin/api-keys/{id}/revoke": { post: op("Revoke key", { tags: ["API Keys"], security: admin, parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }] }) },
  },
};

/** Swagger "Try it out" uses PUBLIC_BASE_URL in production, not 127.0.0.1 */
export function buildOpenApiDocument(config: AppConfig) {
  const basePath = config.API_BASE_PATH.startsWith("/") ? config.API_BASE_PATH : `/${config.API_BASE_PATH}`;
  const publicUrl = config.PUBLIC_BASE_URL?.replace(/\/$/, "");
  const servers = publicUrl
    ? [{ url: `${publicUrl}${basePath}`, description: "Production" }]
    : [
        { url: `${basePath}`, description: "Relative" },
        { url: `http://127.0.0.1:${config.PORT}${basePath}`, description: "Local" },
      ];
  return { ...openApiDocument, servers };
}
