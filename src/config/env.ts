import { existsSync, readFileSync } from "node:fs";
import { z } from "zod";

function loadDotEnv() {
  const path = ".env";
  if (!existsSync(path)) return;
  for (const raw of readFileSync(path, "utf8").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(3000),
  API_BASE_PATH: z.string().default("/v1"),
  ADMIN_ORIGIN: z.string().default("http://localhost:3001"),
  MONGODB_URI: z.string().min(1),
  ADMIN_EMAIL: z.string().email(),
  ADMIN_PASSWORD: z.string().min(8),
  JWT_SECRET: z.string().min(16),
  FIREBASE_PROJECT_ID: z.string().optional().default(""),
  FIREBASE_CLIENT_EMAIL: z.string().optional().default(""),
  FIREBASE_PRIVATE_KEY: z.string().optional().default(""),
  GOOGLE_APPLICATION_CREDENTIALS: z.string().optional().default(""),
  GEMINI_API_KEY: z.string().optional().default(""),
  GEMINI_IMAGE_MODEL: z.string().default("gemini-3.1-flash-image"),
  GEMINI_VISION_MODEL: z.string().default("gemini-3.1-flash-lite"),
  BFL_API_KEY: z.string().optional().default(""),
  BFL_FLUX_MODEL: z.string().default("flux-2-klein-4b"),
  HEADSHOT_AI_PROVIDER: z.enum(["gemini", "bfl"]).default("gemini"),
  GOOGLE_PLAY_PACKAGE_NAME: z.string().default("com.yourcompany.headshotai"),
  GOOGLE_PLAY_SERVICE_ACCOUNT_JSON: z.string().optional().default(""),
  GOOGLE_PLAY_VERIFY_ENABLED: z
    .string()
    .optional()
    .default("false")
    .transform((v) => v === "true"),
  STORAGE_DRIVER: z.enum(["local", "gcs", "s3"]).default("local"),
  GCS_BUCKET: z.string().optional().default(""),
  AWS_S3_BUCKET: z.string().optional().default(""),
  AWS_ACCESS_KEY_ID: z.string().optional().default(""),
  AWS_SECRET_ACCESS_KEY: z.string().optional().default(""),
  REDIS_URL: z.string().optional().default(""),
  ADMOB_SSV_VERIFIER_ENABLED: z
    .string()
    .optional()
    .default("true")
    .transform((v) => v !== "false"),
  CLUSTER_WORKERS: z.coerce.number().default(0),
  MAX_INFLIGHT_AI: z.coerce.number().default(32),
  IDEMPOTENCY_TTL_HOURS: z.coerce.number().default(24),
  MAX_UPLOAD_MB: z.coerce.number().default(10),
  AI_REQUEST_TIMEOUT_MS: z.coerce.number().default(180_000),
});

export type AppConfig = z.infer<typeof envSchema> & {
  isProd: boolean;
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  loadDotEnv();
  const parsed = envSchema.parse(env);
  return { ...parsed, isProd: parsed.NODE_ENV === "production" };
}
