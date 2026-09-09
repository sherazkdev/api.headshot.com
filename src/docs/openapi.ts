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
  const result: Record<string, unknown> = {
    summary,
    tags: opts.tags ?? ["App"],
    responses: {
      200: { description: "OK", content: { "application/json": { schema: envelope } } },
      400: { description: "Bad request" },
      401: { description: "Unauthorized" },
      422: { description: "Validation error" },
    },
  };
  if (opts.description) result.description = opts.description;
  if (opts.security !== undefined) result.security = opts.security;
  if (opts.parameters) result.parameters = opts.parameters;
  if (opts.requestBody) result.requestBody = opts.requestBody;
  return result;
}

/** Mobile app routes — Firebase ID token only (not x-api-key) */
const firebaseUser = [{ firebaseAuth: [] }];
/** Admin dashboard — JWT from /admin/login OR x-api-key (admin/read_only) */
const adminAccess = [{ adminJwt: [] }, { apiKey: [] }];
const json = (schema: Record<string, unknown>, required = true) => ({
  required,
  content: { "application/json": { schema } },
});
const multipart = (schema: Record<string, unknown>, required = true) => ({
  required,
  content: { "multipart/form-data": { schema } },
});

const idempotencyHeader = {
  name: "idempotency-key",
  in: "header",
  required: false,
  schema: { type: "string" },
  description: "Optional — prevents duplicate jobs/charges",
};

const pageQuery = [
  { name: "page", in: "query", schema: { type: "integer", default: 1 } },
  { name: "per_page", in: "query", schema: { type: "integer", default: 20 } },
];

export const openApiDocument = {
  openapi: "3.0.3",
  info: {
    title: "Headshot AI API",
    version: "1.0.0",
    description:
      "Headshot AI REST API.\n\n## Authentication (Swagger Authorize button)\n\n| Scheme | Use for | How to get |\n|--------|---------|------------|\n| **firebaseAuth** | Mobile user routes (`/user/*`, `/credits`, `/headshots`, `/branding`, `/profile-review`, …) | Firebase Auth **ID token** from mobile app after login |\n| **adminJwt** | Admin routes (`/admin/*`) | `POST /admin/login` → paste JWT |\n| **apiKey** | Admin routes only | `x-api-key` from seed / admin API keys |\n\n**Important:** `x-api-key` does **not** work on `/user/profile` or other mobile routes — you will get `Firebase user token required`.\n\nRequest bodies match Zod validation in `src/features/*/controllers`.",
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
      firebaseAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "Firebase ID Token",
        description: "Mobile app user. Authorization: Bearer <firebase-id-token>",
      },
      adminJwt: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "Admin JWT from POST /admin/login response data.token",
      },
      apiKey: {
        type: "apiKey",
        in: "header",
        name: "x-api-key",
        description: "Server API key (admin/read_only). Admin routes only — not mobile /user routes.",
      },
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
    "/admin/me": { get: op("Current admin principal", { tags: ["Auth"], security: adminAccess }) },

    "/user/profile": {
      get: op("User profile + wallet", {
        tags: ["User"],
        security: firebaseUser,
        description: "Authorize with **firebaseAuth** only. x-api-key returns 401.",
      }),
      patch: op("Update profile (wallet fields rejected)", {
        tags: ["User"],
        security: firebaseUser,
        requestBody: json({
          type: "object",
          properties: {
            name: { type: "string", minLength: 1, maxLength: 80 },
            photoUrl: { type: "string", format: "uri" },
          },
        }),
      }),
    },
    "/user/bootstrap": {
      post: op("Create/load user on first login", {
        tags: ["User"],
        security: firebaseUser,
        description: "No body — uses Firebase token claims (uid, email, name).",
      }),
    },
    "/user/delete": { delete: op("Delete account", { tags: ["User"], security: firebaseUser }) },
    "/users/fcm-token": {
      post: op("Register FCM token", {
        tags: ["User"],
        security: firebaseUser,
        requestBody: json({
          type: "object",
          required: ["token"],
          properties: {
            token: { type: "string", minLength: 10, maxLength: 4096 },
            platform: { type: "string", enum: ["android", "ios"], default: "android" },
          },
        }),
      }),
    },

    "/credits": { get: op("Wallet", { tags: ["Credits"], security: firebaseUser }) },
    "/credits/rules": { get: op("Credit costs", { tags: ["Credits"], security: firebaseUser }) },
    "/credits/consume": {
      post: op("Atomic consume", {
        tags: ["Credits"],
        security: firebaseUser,
        parameters: [idempotencyHeader],
        requestBody: json({
          type: "object",
          required: ["amount", "reason"],
          properties: {
            amount: { type: "integer", minimum: 1 },
            reason: {
              type: "string",
              enum: ["headshot_generation", "branding_analyze", "branding_improve", "profile_review"],
            },
            referenceId: { type: "string" },
          },
        }),
      }),
    },
    "/credits/can-proceed": {
      post: op("Can proceed?", {
        tags: ["Credits"],
        security: firebaseUser,
        requestBody: json({
          type: "object",
          required: ["amount"],
          properties: { amount: { type: "integer", minimum: 1 } },
        }),
      }),
    },
    "/credits/ad-reward/claim": {
      post: op("Claim ad reward", {
        tags: ["Credits"],
        security: firebaseUser,
        description:
          "ssvTransactionId is optional until AdMob SSV is enabled. Empty body grants the rewarded-ad credits once. If ssvTransactionId is sent, it must match a processed AdMob SSV webhook.",
        requestBody: json(
          {
            type: "object",
            properties: { ssvTransactionId: { type: "string", minLength: 1 } },
          },
          false,
        ),
      }),
    },

    "/headshots/upload": {
      post: op("Upload source photo", {
        tags: ["Headshots"],
        security: firebaseUser,
        requestBody: multipart({
          type: "object",
          required: ["photo"],
          properties: {
            photo: { type: "string", format: "binary", description: "Image file (required)" },
            purpose: { type: "string", default: "headshot", description: "Optional field in multipart form" },
          },
        }),
      }),
    },
    "/headshots/generate": {
      post: op("Queue generation", {
        tags: ["Headshots"],
        security: firebaseUser,
        parameters: [idempotencyHeader],
        requestBody: json({
          type: "object",
          required: ["uploadId"],
          properties: {
            uploadId: { type: "string", minLength: 1 },
            toolType: { type: "string", default: "headshot" },
            provider: { type: "string", enum: ["gemini", "bfl"] },
            selections: {
              type: "object",
              additionalProperties: {
                type: "object",
                properties: { id: { type: "string" }, prompt: { type: "string" } },
              },
            },
            referencePrompts: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  role: { type: "string" },
                  visualReferencePrompt: { type: "string" },
                },
              },
            },
          },
        }),
      }),
    },
    "/headshots/jobs/{jobId}": { get: op("Job status", { tags: ["Headshots"], security: firebaseUser, parameters: [{ name: "jobId", in: "path", required: true, schema: { type: "string" } }] }) },
    "/headshots/jobs/{jobId}/cancel": { post: op("Cancel job", { tags: ["Headshots"], security: firebaseUser, parameters: [{ name: "jobId", in: "path", required: true, schema: { type: "string" } }] }) },
    "/headshots/results": {
      get: op("User results", { tags: ["Headshots"], security: firebaseUser, parameters: pageQuery }),
    },

    "/branding/analyze": {
      post: op("Branding analyze", {
        tags: ["Branding"],
        security: firebaseUser,
        parameters: [idempotencyHeader],
        requestBody: json({
          type: "object",
          required: ["uploadId"],
          properties: { uploadId: { type: "string" } },
        }),
      }),
    },
    "/branding/improve": {
      post: op("Branding improve (100 credits + image)", {
        tags: ["Branding"],
        security: firebaseUser,
        description: "Waits for the improved image, then returns imageUrl plus rescore metrics in the same response.",
        parameters: [idempotencyHeader],
        requestBody: json({
          type: "object",
          required: ["uploadId"],
          properties: {
            uploadId: { type: "string" },
            enhancementPrompt: { type: "string" },
          },
        }),
      }),
    },
    "/profile-review/analyze": {
      post: op("Profile review", {
        tags: ["Reviews"],
        security: firebaseUser,
        description: "Requires at least 2 upload IDs. Returns per-photo scores, bestIndex, overallScore, and improvementTips.",
        parameters: [idempotencyHeader],
        requestBody: json({
          type: "object",
          required: ["uploadIds"],
          properties: {
            uploadIds: {
              type: "array",
              minItems: 2,
              items: { type: "string" },
              description: "At least 2 upload IDs from /headshots/upload",
            },
          },
        }),
      }),
    },

    "/subscriptions/verify": {
      post: op("Verify Google Play / App Store purchase", {
        tags: ["Subscriptions"],
        security: firebaseUser,
        requestBody: json({
          type: "object",
          required: ["platform", "productId"],
          properties: {
            platform: { type: "string", enum: ["android", "ios"] },
            productId: { type: "string", enum: ["sub_weekly", "sub_monthly", "sub_yearly"] },
            purchaseToken: { type: "string", description: "Android Google Play token" },
            transactionId: { type: "string", description: "iOS transaction ID" },
            packageName: { type: "string", description: "Android package name" },
          },
        }),
      }),
    },
    "/subscriptions/sync": {
      post: op("Sync entitlement", {
        tags: ["Subscriptions"],
        security: firebaseUser,
        description:
          "No body required. Expires an overdue pass if needed and returns the same profile shape as GET /user/profile. Always JSON — never an empty gateway error.",
      }),
    },
    "/subscriptions/restore": {
      post: op("Restore purchases", {
        tags: ["Subscriptions"],
        security: firebaseUser,
        requestBody: json(
          {
            type: "object",
            properties: {
              tokens: { type: "array", items: { type: "string" }, default: [] },
            },
          },
          false,
        ),
      }),
    },
    "/purchases": {
      get: op("User purchases", { tags: ["Subscriptions"], security: firebaseUser, parameters: pageQuery }),
    },

    "/projects": {
      get: op("List projects", { tags: ["Projects"], security: firebaseUser, parameters: pageQuery }),
      post: op("Create project", {
        tags: ["Projects"],
        security: firebaseUser,
        requestBody: json({
          type: "object",
          required: ["name", "toolType"],
          properties: {
            name: { type: "string", minLength: 1 },
            toolType: { type: "string", minLength: 1 },
            styleId: { type: "string" },
            outfitId: { type: "string" },
            backgroundId: { type: "string" },
            poseId: { type: "string" },
            gender: { type: "string" },
            purpose: { type: "string" },
            sourcePhotoUrl: { type: "string" },
            resultImageUrl: { type: "string" },
            brandingScore: { type: "number" },
            brandingStrengths: { type: "array", items: { type: "string" } },
            profileReviewData: { type: "object" },
            isFavorite: { type: "boolean" },
          },
        }),
      }),
    },
    "/projects/{id}": {
      get: op("Get project", { tags: ["Projects"], security: firebaseUser, parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }] }),
      patch: op("Patch project", {
        tags: ["Projects"],
        security: firebaseUser,
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: json({
          type: "object",
          properties: {
            name: { type: "string" },
            isFavorite: { type: "boolean" },
          },
        }),
      }),
      delete: op("Soft-delete project", { tags: ["Projects"], security: firebaseUser, parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }] }),
    },

    "/notifications": {
      get: op("User notifications", { tags: ["Notifications"], security: firebaseUser, parameters: pageQuery }),
    },
    "/notifications/{id}/read": { patch: op("Mark read", { tags: ["Notifications"], security: firebaseUser, parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }] }) },

    "/webhooks/google-play": { post: op("Play Billing RTDN", { tags: ["Webhooks"], security: [] }) },
    "/webhooks/admob-ssv": { get: op("AdMob SSV", { tags: ["Webhooks"], security: [] }) },
    "/webhooks/app-store": { post: op("App Store notification", { tags: ["Webhooks"], security: [] }) },

    "/admin/overview": { get: op("Dashboard KPIs", { tags: ["Admin"], security: adminAccess }) },
    "/admin/users": { get: op("Users table", { tags: ["Admin"], security: adminAccess, parameters: pageQuery }) },
    "/admin/users/{uid}": {
      get: op("User detail", { tags: ["Admin"], security: adminAccess, parameters: [{ name: "uid", in: "path", required: true, schema: { type: "string" } }] }),
    },
    "/admin/users/{uid}/status": {
      patch: op("Suspend / activate user", {
        tags: ["Admin"],
        security: adminAccess,
        parameters: [{ name: "uid", in: "path", required: true, schema: { type: "string" } }],
        requestBody: json({ type: "object", required: ["accountStatus"], properties: { accountStatus: { type: "string", enum: ["active", "suspended", "deleted"] } } }),
      }),
    },
    "/admin/wallets": { get: op("Wallets", { tags: ["Admin"], security: adminAccess, parameters: pageQuery }) },
    "/admin/purchases": { get: op("Purchases / transactions", { tags: ["Admin"], security: adminAccess, parameters: pageQuery }) },
    "/admin/subscriptions": { get: op("Subscriptions", { tags: ["Admin"], security: adminAccess, parameters: pageQuery }) },
    "/admin/headshots": {
      get: op("Generation jobs", {
        tags: ["Admin"],
        security: adminAccess,
        parameters: [
          ...pageQuery,
          { name: "status", in: "query", schema: { type: "string" }, description: "Optional job status filter" },
        ],
      }),
    },
    "/admin/headshots/{jobId}": { get: op("Job detail", { tags: ["Admin"], security: adminAccess, parameters: [{ name: "jobId", in: "path", required: true, schema: { type: "string" } }] }) },
    "/admin/branding": { get: op("Branding jobs", { tags: ["Admin"], security: adminAccess, parameters: pageQuery }) },
    "/admin/profile-reviews": { get: op("Profile reviews", { tags: ["Admin"], security: adminAccess, parameters: pageQuery }) },
    "/admin/projects": { get: op("All projects", { tags: ["Admin"], security: adminAccess, parameters: pageQuery }) },
    "/admin/notifications": { get: op("All notifications", { tags: ["Admin"], security: adminAccess, parameters: pageQuery }) },
    "/admin/fcm": { get: op("FCM tokens + health", { tags: ["Admin"], security: adminAccess }) },
    "/admin/fcm/campaign": {
      post: op("Send FCM campaign", {
        tags: ["Admin"],
        security: adminAccess,
        requestBody: json({
          type: "object",
          required: ["title", "body"],
          properties: { title: { type: "string" }, body: { type: "string" }, audience: { type: "string", enum: ["all", "subscribers", "inactive"] } },
        }),
      }),
    },
    "/admin/ai-usage": { get: op("AI usage analytics", { tags: ["Admin"], security: adminAccess, parameters: pageQuery }) },
    "/admin/jobs": { get: op("AI job queue", { tags: ["Admin"], security: adminAccess, parameters: pageQuery }) },
    "/admin/webhooks": { get: op("Webhook events", { tags: ["Admin"], security: adminAccess, parameters: pageQuery }) },
    "/admin/remote-config": {
      get: op("Remote config", { tags: ["Admin"], security: adminAccess }),
      patch: op("Save flag", {
        tags: ["Admin"],
        security: adminAccess,
        requestBody: json({ type: "object", required: ["key", "value"], properties: { key: { type: "string" }, value: { type: "string" } } }),
      }),
    },
    "/admin/remote-config/publish": { post: op("Publish remote config", { tags: ["Admin"], security: adminAccess }) },

    "/admin/api-keys": {
      get: op("List API keys", { tags: ["API Keys"], security: adminAccess, parameters: pageQuery }),
      post: op("Generate API key (plaintext once)", {
        tags: ["API Keys"],
        security: adminAccess,
        requestBody: json({
          type: "object",
          required: ["name"],
          properties: { name: { type: "string" }, role: { type: "string", enum: ["admin", "read_only", "developer"] }, env: { type: "string" } },
        }),
      }),
    },
    "/admin/api-keys/stats": { get: op("API key stats", { tags: ["API Keys"], security: adminAccess }) },
    "/admin/api-keys/{id}/rotate": { post: op("Rotate key", { tags: ["API Keys"], security: adminAccess, parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }] }) },
    "/admin/api-keys/{id}/revoke": { post: op("Revoke key", { tags: ["API Keys"], security: adminAccess, parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }] }) },
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
