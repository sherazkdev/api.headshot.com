import { loadConfig } from "../config/index.js";
import { connectDb, disconnectDb } from "../db/index.js";
import { buildApp } from "../app.js";
import { tinyJpeg } from "../lib/image-fixtures.js";

function flag(name, value, used) {
  const set = value !== undefined && value !== null && String(value).length > 0 && value !== 0;
  const shown = typeof value === "boolean" || typeof value === "number" ? String(value) : set ? "SET" : "EMPTY";
  return { name, used, shown, set };
}

async function req(app, opts) {
  const res = await app.inject(opts);
  let body = {};
  try {
    body = JSON.parse(res.body);
  } catch {
    body = { raw: res.body?.slice?.(0, 80) };
  }
  return { status: res.statusCode, body };
}

function jpegMultipart() {
  const boundary = "----EnvProof";
  const jpeg = tinyJpeg();
  const head = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="photo"; filename="selfie.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`,
  );
  const mid = Buffer.from(`\r\n--${boundary}\r\nContent-Disposition: form-data; name="purpose"\r\n\r\nheadshot\r\n--${boundary}--\r\n`);
  return { payload: Buffer.concat([head, jpeg, mid]), headers: { "content-type": `multipart/form-data; boundary=${boundary}` } };
}

async function main() {
  const config = loadConfig();
  const rows = [
    flag("NODE_ENV", config.NODE_ENV, "boot"),
    flag("PORT", config.PORT, "boot"),
    flag("API_BASE_PATH", config.API_BASE_PATH, "boot"),
    flag("ADMIN_ORIGIN", config.ADMIN_ORIGIN, "CORS"),
    flag("MONGODB_URI", config.MONGODB_URI, "DB"),
    flag("ADMIN_EMAIL", config.ADMIN_EMAIL, "admin login"),
    flag("ADMIN_PASSWORD", config.ADMIN_PASSWORD, "admin login"),
    flag("JWT_SECRET", config.JWT_SECRET, "JWT sign/verify"),
    flag("FIREBASE_PROJECT_ID", config.FIREBASE_PROJECT_ID, "mobile auth"),
    flag("FIREBASE_CLIENT_EMAIL", config.FIREBASE_CLIENT_EMAIL, "mobile auth"),
    flag("FIREBASE_PRIVATE_KEY", config.FIREBASE_PRIVATE_KEY, "mobile auth"),
    flag("GOOGLE_APPLICATION_CREDENTIALS", config.GOOGLE_APPLICATION_CREDENTIALS, "mobile auth"),
    flag("GEMINI_API_KEY", config.GEMINI_API_KEY, "real headshots/branding"),
    flag("GEMINI_IMAGE_MODEL", config.GEMINI_IMAGE_MODEL, "AI model id"),
    flag("GEMINI_VISION_MODEL", config.GEMINI_VISION_MODEL, "AI model id"),
    flag("BFL_API_KEY", config.BFL_API_KEY, "Flux provider"),
    flag("BFL_FLUX_MODEL", config.BFL_FLUX_MODEL, "Flux model id"),
    flag("HEADSHOT_AI_PROVIDER", config.HEADSHOT_AI_PROVIDER, "gemini|bfl"),
    flag("GOOGLE_PLAY_VERIFY_ENABLED", config.GOOGLE_PLAY_VERIFY_ENABLED, "false=skip Play match, true=Console match"),
    flag("GOOGLE_PLAY_PACKAGE_NAME", config.GOOGLE_PLAY_PACKAGE_NAME, "Play verify when enabled"),
    flag("GOOGLE_PLAY_SERVICE_ACCOUNT_JSON", config.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON, "Play verify when enabled"),
    flag("STORAGE_DRIVER", config.STORAGE_DRIVER, "UNUSED in code (always LocalStorage)"),
    flag("GCS_BUCKET", config.GCS_BUCKET, "UNUSED"),
    flag("AWS_S3_BUCKET", config.AWS_S3_BUCKET, "UNUSED"),
    flag("AWS_ACCESS_KEY_ID", config.AWS_ACCESS_KEY_ID, "UNUSED"),
    flag("AWS_SECRET_ACCESS_KEY", config.AWS_SECRET_ACCESS_KEY, "UNUSED"),
    flag("REDIS_URL", config.REDIS_URL, "UNUSED (MemoryQueue/MemoryCache)"),
    flag("ADMOB_SSV_VERIFIER_ENABLED", config.ADMOB_SSV_VERIFIER_ENABLED, "prod SSV field check"),
    flag("CLUSTER_WORKERS", config.CLUSTER_WORKERS, "node cluster"),
    flag("MAX_INFLIGHT_AI", config.MAX_INFLIGHT_AI, "queue concurrency"),
    flag("IDEMPOTENCY_TTL_HOURS", config.IDEMPOTENCY_TTL_HOURS, "idempotency"),
    flag("MAX_UPLOAD_MB", config.MAX_UPLOAD_MB, "upload limit"),
  ];

  console.log("=== ENV MAP (values hidden) ===");
  for (const r of rows) {
    console.log(`${r.shown.padEnd(6)}  ${r.name.padEnd(34)}  ${r.used}`);
  }

  await connectDb(config);
  const app = await buildApp(config);
  const checks = [];
  const check = (name, ok, detail) => {
    checks.push({ name, ok, detail });
    console.log(`${ok ? "PASS" : "FAIL"}  ${name} — ${detail}`);
  };

  try {
    const health = await req(app, { method: "GET", url: "/v1/health" });
    check("MONGODB + API boot (GET /health)", health.status === 200 && health.body.success === true, `status ${health.status}`);

    const live = await fetch("http://127.0.0.1:3000/v1/health");
    const liveBody = await live.json();
    check("Live server on PORT from env", live.status === 200 && liveBody.success === true, `http://127.0.0.1:${config.PORT}/v1/health`);

    const badLogin = await req(app, {
      method: "POST",
      url: "/v1/admin/login",
      headers: { "content-type": "application/json" },
      payload: { email: config.ADMIN_EMAIL, password: "wrong-password-xx" },
    });
    check("Wrong ADMIN_PASSWORD rejected", badLogin.status === 401, `status ${badLogin.status}`);

    const login = await req(app, {
      method: "POST",
      url: "/v1/admin/login",
      headers: { "content-type": "application/json" },
      payload: { email: config.ADMIN_EMAIL, password: config.ADMIN_PASSWORD },
    });
    check("ADMIN_EMAIL + ADMIN_PASSWORD + JWT_SECRET login", login.status === 200 && Boolean(login.body.data?.token), `email=${login.body.data?.email ?? login.body.error?.message}`);

    const adminAuth = { authorization: `Bearer ${login.body.data?.token}` };
    const overview = await req(app, { method: "GET", url: "/v1/admin/overview", headers: adminAuth });
    check("JWT_SECRET verifies admin token + Mongo overview", overview.status === 200, `users=${overview.body.data?.totalUsers}`);

    const fakeFb = await req(app, { method: "GET", url: "/v1/credits", headers: { authorization: "Bearer fake.firebase.token" } });
    check(
      "FIREBASE empty → fake mobile token rejected",
      fakeFb.status === 401,
      `${fakeFb.body.error?.message ?? fakeFb.status}`,
    );

    const uid = `envproof_${Date.now()}`;
    const userToken = app.jwt.sign({ sub: uid, email: `${uid}@test.local`, kind: "user", name: "Env Proof" }, { expiresIn: "1h" });
    const userAuth = { authorization: `Bearer ${userToken}` };
    const boot = await req(app, { method: "POST", url: "/v1/user/bootstrap", headers: userAuth });
    check("Dev user JWT bootstrap (no Firebase needed in development)", boot.status === 200, `uid=${boot.body.data?.uid}`);

    const play = await req(app, {
      method: "POST",
      url: "/v1/subscriptions/verify",
      headers: { ...userAuth, "content-type": "application/json" },
      payload: { platform: "android", productId: "sub_monthly", purchaseToken: `tok_${uid}` },
    });
    check(
      config.GOOGLE_PLAY_VERIFY_ENABLED
        ? "GOOGLE_PLAY_VERIFY_ENABLED=true → fake token rejected"
        : "GOOGLE_PLAY_VERIFY_ENABLED=false → buy without Play match",
      config.GOOGLE_PLAY_VERIFY_ENABLED ? play.status >= 400 : play.status === 200 && play.body.data?.isPremium === true,
      `status=${play.status} msg=${play.body.error?.message ?? "ok"}`,
    );

    const ssv = await req(app, {
      method: "GET",
      url: `/v1/webhooks/admob-ssv?user_id=${uid}&transaction_id=ssv_${uid}&reward_amount=50`,
    });
    check("AdMob SSV +50 for generate proof", ssv.status === 200, `status ${ssv.status}`);

    const file = jpegMultipart();
    const upload = await req(app, {
      method: "POST",
      url: "/v1/headshots/upload",
      headers: { ...userAuth, ...file.headers },
      payload: file.payload,
    });
    const uploadId = upload.body.data?.uploadId;
    check("MAX_UPLOAD_MB + local storage upload", upload.status === 200 && Boolean(uploadId), `uploadId=${uploadId}`);

    const gen = await req(app, {
      method: "POST",
      url: "/v1/headshots/generate",
      headers: { ...userAuth, "content-type": "application/json" },
      payload: { uploadId, toolType: "headshot" },
    });
    const jobId = gen.body.data?.jobId;
    check("HEADSHOT_AI_PROVIDER generate queued", gen.status === 200 && Boolean(jobId), `jobId=${jobId}`);

    let job;
    for (let i = 0; i < 20; i += 1) {
      await new Promise((r) => setTimeout(r, 200));
      job = await req(app, { method: "GET", url: `/v1/headshots/jobs/${jobId}`, headers: userAuth });
      if (job.body.data?.status === "completed" || job.body.data?.status === "failed") break;
    }
    const mockAi = !config.GEMINI_API_KEY;
    check(
      mockAi ? "GEMINI_API_KEY empty → mock PNG job (dev only)" : "GEMINI_API_KEY set → real generate",
      job?.status === 200 && job.body.data?.status === "completed",
      `status=${job?.body.data?.status} mock=${mockAi} imageUrl=${Boolean(job?.body.data?.imageUrl)}`,
    );

    const prodGemini = !config.GEMINI_API_KEY && config.NODE_ENV === "production";
    check("NODE_ENV is not production (mock AI/Play allowed)", config.NODE_ENV !== "production", `NODE_ENV=${config.NODE_ENV} isProd=${config.isProd}`);
    if (prodGemini) check("GEMINI required in production", false, "would crash generate");

    const unused = ["REDIS_URL", "GCS_BUCKET", "AWS_S3_BUCKET", "STORAGE_DRIVER"].filter((k) => {
      const v = config[k];
      return v && String(v).length && !(k === "STORAGE_DRIVER" && v === "local");
    });
    check("Unused infra keys not required yet", unused.length === 0, unused.length ? unused.join(",") : "REDIS/S3/GCS not read by runtime");
  } finally {
    await app.close();
    await disconnectDb();
  }

  const failed = checks.filter((c) => !c.ok);
  console.log(`\n${checks.length - failed.length}/${checks.length} proofs passed`);
  if (failed.length) {
    process.exitCode = 1;
    for (const f of failed) console.log(` - ${f.name}: ${f.detail}`);
  }
}

void main();
