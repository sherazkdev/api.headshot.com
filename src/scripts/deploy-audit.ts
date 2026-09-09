import crypto from "node:crypto";
import { loadConfig } from "../config/index.js";
import { connectDb, disconnectDb } from "../db/index.js";
import { tinyJpeg } from "../lib/image-fixtures.js";
import { NotificationModel, PurchaseModel, UserModel, WebhookEventModel, AiJobModel } from "../models/index.js";
import { DEFAULT_FETCH_MS, pollAiJob } from "./audit-helpers.js";

type Envelope = { success?: boolean; data?: Record<string, unknown> & { items?: unknown[] }; error?: { code?: string; message?: string } };
type Row = { name: string; ok: boolean; status: number; detail: string };

function signHs256(payload: Record<string, unknown>, secret: string): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(
    JSON.stringify({ ...payload, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600 }),
  ).toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${sig}`;
}

function jpegMultipart() {
  const boundary = "----DeployAudit";
  const jpeg = tinyJpeg();
  const head = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="photo"; filename="selfie.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`,
  );
  const mid = Buffer.from(
    `\r\n--${boundary}\r\nContent-Disposition: form-data; name="purpose"\r\n\r\nheadshot\r\n--${boundary}--\r\n`,
  );
  return { body: Buffer.concat([head, jpeg, mid]), contentType: `multipart/form-data; boundary=${boundary}` };
}

async function main() {
  const config = loadConfig();
  const base = `http://127.0.0.1:${config.PORT}${config.API_BASE_PATH}`;
  const rows: Row[] = [];
  const uid = `deploy_audit_${Date.now()}`;
  const userToken = signHs256({ sub: uid, email: `${uid}@test.local`, kind: "user", name: "Deploy Audit" }, config.JWT_SECRET);

  const check = (name: string, ok: boolean, status: number, detail = "") => {
    rows.push({ name, ok, status, detail });
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}  [${status}]${detail ? `  ${detail}` : ""}`);
  };

  const req = async (
    method: string,
    path: string,
    opts: { token?: string; json?: unknown; raw?: Buffer; contentType?: string; apiKey?: string; timeoutMs?: number } = {},
  ) => {
    const headers: Record<string, string> = {};
    if (opts.token) headers.authorization = `Bearer ${opts.token}`;
    if (opts.apiKey) headers["x-api-key"] = opts.apiKey;
    let body: string | Uint8Array | undefined;
    if (opts.raw) {
      headers["content-type"] = opts.contentType ?? "application/octet-stream";
      body = new Uint8Array(opts.raw);
    } else if (opts.json !== undefined) {
      headers["content-type"] = "application/json";
      body = JSON.stringify(opts.json);
    }
    const started = Date.now();
    const res = await fetch(`${base}${path}`, {
      method,
      headers,
      body,
      signal: AbortSignal.timeout(opts.timeoutMs ?? DEFAULT_FETCH_MS),
    });
    const ms = Date.now() - started;
    let parsed: Envelope = {};
    const text = await res.text();
    try {
      parsed = JSON.parse(text) as Envelope;
    } catch {
      parsed = { error: { message: text.slice(0, 120) } };
    }
    return { status: res.status, body: parsed, ms };
  };

  const healthPing = await fetch(`http://127.0.0.1:${config.PORT}${config.API_BASE_PATH}/health`);
  if (!healthPing.ok) {
    console.error(`Live API not reachable at ${base}/health — start npm run dev first`);
    process.exitCode = 1;
    return;
  }

  await connectDb(config);

  try {
    const health = await req("GET", "/health");
    check("GET /health", health.status === 200 && health.body.success === true, health.status, `${health.ms}ms`);

    const styles = await req("GET", "/styles");
    check("GET /styles", styles.status === 200 && Array.isArray(styles.body.data?.genders), styles.status);

    const packs = await req("GET", "/packs");
    check("GET /packs", packs.status === 200 && Array.isArray(packs.body.data), packs.status);

    const unauth = await req("GET", "/credits");
    check("GET /credits no auth → 401", unauth.status === 401, unauth.status);

    const login = await req("POST", "/admin/login", {
      json: { email: config.ADMIN_EMAIL, password: config.ADMIN_PASSWORD },
    });
    const adminToken = String(login.body.data?.token ?? "");
    check("POST /admin/login", login.status === 200 && Boolean(adminToken), login.status);
    const admin = adminToken;

    const me = await req("GET", "/admin/me", { token: admin });
    check("GET /admin/me", me.status === 200, me.status);

    const boot = await req("POST", "/user/bootstrap", { token: userToken });
    check("POST /user/bootstrap", boot.status === 200 && boot.body.data?.uid === uid, boot.status);

    const profile = await req("GET", "/user/profile", { token: userToken });
    check("GET /user/profile", profile.status === 200, profile.status);

    const patched = await req("PATCH", "/user/profile", { token: userToken, json: { name: "Audit User" } });
    check("PATCH /user/profile", patched.status === 200 && patched.body.data?.name === "Audit User", patched.status);

    const credits = await req("GET", "/credits", { token: userToken });
    check("GET /credits", credits.status === 200, credits.status);

    const rules = await req("GET", "/credits/rules", { token: userToken });
    check("GET /credits/rules", rules.status === 200, rules.status);

    const can = await req("POST", "/credits/can-proceed", { token: userToken, json: { amount: 50 } });
    check("POST /credits/can-proceed", can.status === 200 && can.body.data?.allowed === false, can.status);

    const consume402 = await req("POST", "/credits/consume", {
      token: userToken,
      json: { amount: 50, reason: "headshot_generation" },
    });
    check("POST /credits/consume 402", consume402.status === 402, consume402.status);

    const claimEmpty = await req("POST", "/credits/ad-reward/claim", { token: userToken, json: {} });
    check("POST /credits/ad-reward/claim empty", claimEmpty.status === 200, claimEmpty.status);

    const ssvId = `ssv_${uid}`;
    const ssv = await req("GET", `/webhooks/admob-ssv?user_id=${uid}&transaction_id=${ssvId}&reward_amount=50`);
    check("GET /webhooks/admob-ssv", ssv.status === 200, ssv.status);

    const claim = await req("POST", "/credits/ad-reward/claim", { token: userToken, json: { ssvTransactionId: ssvId } });
    check("POST /credits/ad-reward/claim", claim.status === 200, claim.status);

    const verify = await req("POST", "/subscriptions/verify", {
      token: userToken,
      json: { platform: "android", productId: "sub_monthly", purchaseToken: `tok_${uid}` },
    });
    check(
      config.GOOGLE_PLAY_VERIFY_ENABLED ? "POST /subscriptions/verify (Play match ON)" : "POST /subscriptions/verify (Play match OFF)",
      config.GOOGLE_PLAY_VERIFY_ENABLED ? verify.status >= 400 : verify.status === 200 && verify.body.data?.isPremium === true,
      verify.status,
      String(verify.body.error?.message ?? verify.body.data?.passCredits ?? ""),
    );

    const sync = await req("POST", "/subscriptions/sync", { token: userToken });
    check("POST /subscriptions/sync", sync.status === 200, sync.status);

    const restore = await req("POST", "/subscriptions/restore", { token: userToken, json: { tokens: [`tok_${uid}`] } });
    check("POST /subscriptions/restore", restore.status === 200, restore.status);

    const purchases = await req("GET", "/purchases", { token: userToken });
    check("GET /purchases", purchases.status === 200, purchases.status);

    const file = jpegMultipart();
    const upload = await req("POST", "/headshots/upload", { token: userToken, raw: file.body, contentType: file.contentType });
    const uploadId = String(upload.body.data?.uploadId ?? "");
    check("POST /headshots/upload", upload.status === 200 && Boolean(uploadId), upload.status);

    const generated = await req("POST", "/headshots/generate", {
      token: userToken,
      json: { uploadId, toolType: "headshot", selections: { gender: { id: "male" }, style: { id: "corporate" } } },
    });
    const jobId = String(generated.body.data?.jobId ?? "");
    check("POST /headshots/generate", generated.status === 200 && Boolean(jobId), generated.status, generated.body.error?.message ?? "");

    let jobStatus = "missing";
    let imageUrl: unknown;
    let jobWaitMs = 0;
    if (jobId) {
      const polled = await pollAiJob(async () => {
        const job = await req("GET", `/headshots/jobs/${jobId}`, { token: userToken });
        return { status: String(job.body.data?.status ?? "missing"), imageUrl: (job.body.data?.imageUrl as string | null | undefined) ?? null };
      });
      jobStatus = polled.status;
      imageUrl = polled.imageUrl;
      jobWaitMs = polled.waitMs;
    }
    check("GET /headshots/jobs/:jobId", jobStatus === "completed" && Boolean(imageUrl), 200, `status=${jobStatus} wait=${jobWaitMs}ms`);

    const cancelMissing = await req("POST", "/headshots/jobs/does-not-exist/cancel", { token: userToken });
    check("POST /headshots/jobs/:jobId/cancel missing → 404", cancelMissing.status === 404, cancelMissing.status);

    const results = await req("GET", "/headshots/results", { token: userToken });
    check("GET /headshots/results", results.status === 200, results.status);

    const adminJob = await req("GET", `/admin/headshots/${jobId || "missing"}`, { token: admin });
    check("GET /admin/headshots/:jobId", jobId ? adminJob.status === 200 : adminJob.status === 404, adminJob.status);

    const brandingUp = await req("POST", "/headshots/upload", { token: userToken, raw: file.body, contentType: file.contentType });
    const brandingId = String(brandingUp.body.data?.uploadId ?? "");
    const analyzed = await req("POST", "/branding/analyze", { token: userToken, json: { uploadId: brandingId } });
    check("POST /branding/analyze", analyzed.status === 200, analyzed.status, analyzed.body.error?.message ?? "");

    await new Promise((r) => setTimeout(r, 1500));
    const improved = await req("POST", "/branding/improve", { token: userToken, json: { uploadId: brandingId } });
    const improvementId = String(improved.body.data?.improvementId ?? "");
    check("POST /branding/improve", improved.status === 200 && Boolean(improved.body.data?.imageUrl), improved.status, `${improved.ms}ms`);

    let improveStatus = "missing";
    let improveImage: unknown;
    let improveWaitMs = 0;
    if (improvementId) {
      const polledImprove = await pollAiJob(async () => {
        const job = await req("GET", `/headshots/jobs/${improvementId}`, { token: userToken });
        return { status: String(job.body.data?.status ?? "missing"), imageUrl: (job.body.data?.imageUrl as string | null | undefined) ?? null };
      });
      improveStatus = polledImprove.status;
      improveImage = polledImprove.imageUrl;
      improveWaitMs = polledImprove.waitMs;
    }
    check("GET /branding/improve job completed", improveStatus === "completed" && Boolean(improveImage), 200, `status=${improveStatus} wait=${improveWaitMs}ms`);

    const photoA = await req("POST", "/headshots/upload", { token: userToken, raw: file.body, contentType: file.contentType });
    const photoB = await req("POST", "/headshots/upload", { token: userToken, raw: file.body, contentType: file.contentType });
    const review = await req("POST", "/profile-review/analyze", {
      token: userToken,
      json: { uploadIds: [photoA.body.data?.uploadId, photoB.body.data?.uploadId] },
    });
    check("POST /profile-review/analyze", review.status === 200, review.status, review.body.error?.message ?? "");

    const project = await req("POST", "/projects", { token: userToken, json: { name: "Audit set", toolType: "headshot" } });
    const projectId = String(project.body.data?.projectId ?? "");
    check("POST /projects", project.status === 200 && Boolean(projectId), project.status);

    const projectList = await req("GET", "/projects", { token: userToken });
    check("GET /projects", projectList.status === 200, projectList.status);

    const gotProject = await req("GET", `/projects/${projectId}`, { token: userToken });
    check("GET /projects/:id", gotProject.status === 200, gotProject.status);

    const patchedProject = await req("PATCH", `/projects/${projectId}`, { token: userToken, json: { isFavorite: true } });
    check("PATCH /projects/:id", patchedProject.status === 200, patchedProject.status);

    const deletedProject = await req("DELETE", `/projects/${projectId}`, { token: userToken });
    check("DELETE /projects/:id", deletedProject.status === 200, deletedProject.status);

    const fcm = await req("POST", "/users/fcm-token", {
      token: userToken,
      json: { token: `fcm-audit-${uid}-token-1234567890`, platform: "android" },
    });
    check("POST /users/fcm-token", fcm.status === 200, fcm.status);

    const campaign = await req("POST", "/admin/fcm/campaign", {
      token: admin,
      json: { title: "Deploy audit", body: "Test campaign body", audience: "all" },
    });
    const queued = Number(campaign.body.data?.queued ?? 0);
    check("POST /admin/fcm/campaign", campaign.status === 200 && queued >= 1, campaign.status, `queued=${queued}`);

    const notes = await req("GET", "/notifications", { token: userToken });
    const noteItems = (notes.body.data?.items ?? []) as Array<{ notificationId?: string; title?: string; delivery?: string }>;
    const campaignNote = noteItems.find((n) => n.title === "Deploy audit");
    check("GET /notifications (campaign stored)", notes.status === 200 && Boolean(campaignNote), notes.status, `delivery=${campaignNote?.delivery ?? "missing"}`);

    if (campaignNote?.notificationId) {
      const read = await req("PATCH", `/notifications/${campaignNote.notificationId}/read`, { token: userToken });
      check("PATCH /notifications/:id/read", read.status === 200 && read.body.data?.read === true, read.status);
    } else {
      check("PATCH /notifications/:id/read", false, 0, "no campaign notification");
    }

    const adminFcm = await req("GET", "/admin/fcm", { token: admin });
    const registered = Number(adminFcm.body.data?.registeredTokens ?? 0);
    check("GET /admin/fcm", adminFcm.status === 200 && registered >= 1, adminFcm.status, `tokens=${registered}`);

    const playHook = await req("POST", "/webhooks/google-play", {
      json: { eventId: `play_${uid}`, eventType: "SUBSCRIPTION_PURCHASED", purchaseToken: `tok_${uid}`, productId: "sub_monthly" },
    });
    check("POST /webhooks/google-play", playHook.status === 200, playHook.status);

    const appStore = await req("POST", "/webhooks/app-store", { json: { notificationUUID: `ios_${uid}` } });
    check("POST /webhooks/app-store", appStore.status === 200, appStore.status);

    const adminGets = [
      "/admin/overview",
      "/admin/users",
      "/admin/wallets",
      "/admin/purchases",
      "/admin/subscriptions",
      "/admin/headshots",
      "/admin/branding",
      "/admin/profile-reviews",
      "/admin/projects",
      "/admin/notifications",
      "/admin/ai-usage",
      "/admin/jobs",
      "/admin/webhooks",
      "/admin/remote-config",
      "/admin/api-keys",
      "/admin/api-keys/stats",
    ];
    for (const path of adminGets) {
      const row = await req("GET", path, { token: admin });
      check(`GET ${path}`, row.status === 200 && row.body.success === true, row.status);
    }

    const userDetail = await req("GET", `/admin/users/${uid}`, { token: admin });
    check("GET /admin/users/:uid", userDetail.status === 200, userDetail.status);

    const suspend = await req("PATCH", `/admin/users/${uid}/status`, { token: admin, json: { accountStatus: "suspended" } });
    check("PATCH /admin/users/:uid/status suspend", suspend.status === 200, suspend.status);
    const activate = await req("PATCH", `/admin/users/${uid}/status`, { token: admin, json: { accountStatus: "active" } });
    check("PATCH /admin/users/:uid/status activate", activate.status === 200, activate.status);

    const saveFlag = await req("PATCH", "/admin/remote-config", { token: admin, json: { key: "audit_flag", value: "1" } });
    check("PATCH /admin/remote-config", saveFlag.status === 200, saveFlag.status);
    const publish = await req("POST", "/admin/remote-config/publish", { token: admin });
    check("POST /admin/remote-config/publish", publish.status === 200, publish.status);

    const createdKey = await req("POST", "/admin/api-keys", { token: admin, json: { name: `audit-${uid}`, role: "admin", env: "test" } });
    const keyId = String(createdKey.body.data?._id ?? "");
    const plaintext = String(createdKey.body.data?.plaintext ?? "");
    check("POST /admin/api-keys", createdKey.status === 200 && plaintext.startsWith("x-api-key_"), createdKey.status);

    const viaKey = await req("GET", "/admin/overview", { apiKey: plaintext });
    check("Admin GET via x-api-key", viaKey.status === 200, viaKey.status);

    const rotated = await req("POST", `/admin/api-keys/${keyId}/rotate`, { token: admin });
    check("POST /admin/api-keys/:id/rotate", rotated.status === 200, rotated.status);
    const rotateId = String(rotated.body.data?._id ?? keyId);
    const revoked = await req("POST", `/admin/api-keys/${rotateId}/revoke`, { token: admin });
    check("POST /admin/api-keys/:id/revoke", revoked.status === 200, revoked.status);

    const removed = await req("DELETE", "/user/delete", { token: userToken });
    check("DELETE /user/delete", removed.status === 200, removed.status);
  } catch (err) {
    check("Harness crash", false, 0, err instanceof Error ? err.message : String(err));
  } finally {
    await UserModel.deleteMany({ uid: { $regex: `^${uid}` } });
    await NotificationModel.deleteMany({ uid: { $regex: `^${uid}` } });
    await PurchaseModel.deleteMany({ uid: { $regex: `^${uid}` } });
    await AiJobModel.deleteMany({ uid: { $regex: `^${uid}` } });
    await WebhookEventModel.deleteMany({ eventId: { $regex: uid } });
    await disconnectDb();
  }

  const failed = rows.filter((r) => !r.ok);
  console.log(`\n${rows.length - failed.length}/${rows.length} live endpoint checks passed`);
  const timed = rows
    .map((r) => {
      const m = r.detail.match(/(\d+)ms/);
      return m ? { name: r.name, ms: Number(m[1]) } : null;
    })
    .filter((r): r is { name: string; ms: number } => Boolean(r))
    .sort((a, b) => b.ms - a.ms);
  if (timed.length) {
    console.log("\nSlowest endpoints:");
    for (const row of timed.slice(0, 8)) console.log(` - ${row.name}: ${row.ms}ms`);
  }
  if (failed.length) {
    console.log("Failed:");
    for (const row of failed) console.log(` - ${row.name}: [${row.status}] ${row.detail}`);
    process.exitCode = 1;
  }

  console.log("\n=== PRODUCTION GAPS (code, not HTTP 200) ===");
  console.log(`FCM push send: NO — campaign only writes Firestore notifications (delivery=queued), firebase-admin.messaging() never called`);
  console.log(`Photos: Firebase Storage when bucket works, else local uploads/ + generated/`);
  console.log(`REDIS_URL: UNUSED — MemoryQueue + MemoryCache`);
  console.log(`App Store IAP verify: NO — iOS verify rejected / webhook stored without Apple crypto`);
  console.log(`AdMob SSV crypto: NO — prod only checks signature/key_id presence`);
  console.log(`GOOGLE_PLAY_VERIFY_ENABLED=${config.GOOGLE_PLAY_VERIFY_ENABLED} — ${config.GOOGLE_PLAY_VERIFY_ENABLED ? "Play Console match ON" : "dev skip-match; set true before real money"}`);
  console.log(`Firebase Admin: ${config.FIREBASE_PROJECT_ID ? "SET (mobile ID tokens can verify)" : "EMPTY"}`);
  console.log(`Gemini: ${config.GEMINI_API_KEY ? "SET" : "EMPTY (mock PNG in development)"}`);
  console.log(`Play SA: ${config.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON ? "SET" : "EMPTY"}`);
}

void main();
