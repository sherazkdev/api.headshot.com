import { loadConfig } from "../config/index.js";
import { connectDb, disconnectDb } from "../db/index.js";
import { buildApp } from "../app.js";
import { tinyJpeg } from "../lib/image-fixtures.js";
import { NotificationModel, UserModel } from "../models/index.js";
import { verifyPlaySubscription } from "../lib/play-billing.js";
import { pollAiJob } from "./audit-helpers.js";

type Envelope<T = unknown> = { success?: boolean; data?: T; error?: { code?: string; message?: string } };
type CaseResult = { name: string; ok: boolean; detail: string; ms?: number };

function multipartPhoto(purpose = "headshot") {
  const boundary = "----HeadshotVerifyBoundary";
  const jpeg = tinyJpeg();
  const head = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="photo"; filename="selfie.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`,
  );
  const mid = Buffer.from(
    `\r\n--${boundary}\r\nContent-Disposition: form-data; name="purpose"\r\n\r\n${purpose}\r\n--${boundary}--\r\n`,
  );
  return {
    payload: Buffer.concat([head, jpeg, mid]),
    headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
  };
}

async function main() {
  process.env.NODE_ENV = process.env.NODE_ENV === "production" ? "development" : process.env.NODE_ENV || "development";

  const config = loadConfig();
  await connectDb(config);
  const app = await buildApp(config);
  const results: CaseResult[] = [];
  const uid = `verify_${Date.now()}`;
  const userToken = app.jwt.sign({ sub: uid, email: `${uid}@test.local`, kind: "user", name: "Verify User" }, { expiresIn: "2h" });
  const userAuth = { authorization: `Bearer ${userToken}` };

  const check = (name: string, ok: boolean, detail: string, ms?: number) => {
    results.push({ name, ok, detail, ms });
    const mark = ok ? "PASS" : "FAIL";
    const timing = ms !== undefined ? ` (${ms}ms)` : "";
    console.log(`${mark}  ${name}${detail ? ` — ${detail}` : ""}${timing}`);
  };

  const inject = async (opts: {
    method: "GET" | "POST" | "PATCH" | "DELETE";
    url: string;
    headers?: Record<string, string>;
    payload?: unknown;
  }) => {
    const res = await app.inject({
      method: opts.method,
      url: opts.url,
      headers: opts.headers,
      payload: opts.payload as never,
    });
    let body: Envelope = {};
    try {
      const raw = res.body;
      body = typeof raw === "string" ? (JSON.parse(raw) as Envelope) : ((raw as Envelope) ?? {});
    } catch {
      body = {};
    }
    return { status: res.statusCode, body };
  };

  try {
    const health = await inject({ method: "GET", url: "/v1/health" });
    check("GET /health", health.status === 200 && health.body.success === true, `status ${health.status}`);

    const styles = await inject({ method: "GET", url: "/v1/styles" });
    check("GET /styles", styles.status === 200 && Array.isArray((styles.body.data as { genders?: string[] })?.genders), `status ${styles.status}`);

    const packs = await inject({ method: "GET", url: "/v1/packs" });
    check("GET /packs", packs.status === 200 && Array.isArray(packs.body.data), `status ${packs.status}`);

    const unauth = await inject({ method: "GET", url: "/v1/credits" });
    check(
      "401 without token",
      unauth.status === 401 && unauth.body.error?.code === "UNAUTHORIZED",
      `status ${unauth.status} body=${JSON.stringify(unauth.body)}`,
    );

    const badToken = await inject({ method: "GET", url: "/v1/credits", headers: { authorization: "Bearer not-a-token" } });
    check("401 invalid token", badToken.status === 401, `status ${badToken.status}`);

    const login = await inject({
      method: "POST",
      url: "/v1/admin/login",
      payload: { email: config.ADMIN_EMAIL, password: config.ADMIN_PASSWORD },
    });
    const adminToken = (login.body.data as { token?: string } | undefined)?.token;
    check("POST /admin/login", login.status === 200 && Boolean(adminToken), `status ${login.status}`);
    const adminAuth = { authorization: `Bearer ${adminToken}` };

    const me = await inject({ method: "GET", url: "/v1/admin/me", headers: adminAuth });
    check("GET /admin/me", me.status === 200 && (me.body.data as { auth?: { kind?: string } })?.auth?.kind === "admin", `status ${me.status}`);

    const docsUi = await app.inject({ method: "GET", url: "/docs" });
    check(
      "GET /docs swagger UI",
      docsUi.statusCode === 200 && docsUi.body.toLowerCase().includes("swagger"),
      `status ${docsUi.statusCode}`,
    );

    const docsJson = await inject({ method: "GET", url: "/docs/json" });
    const spec = docsJson.body as { openapi?: string; paths?: Record<string, unknown> };
    check(
      "GET /docs/json OpenAPI",
      docsJson.status === 200 && spec.openapi?.startsWith("3.") === true && Boolean(spec.paths?.["/admin/login"]),
      `status ${docsJson.status} openapi=${spec.openapi}`,
    );

    const badEmail = await inject({ method: "POST", url: "/v1/admin/login", payload: { email: "not-an-email", password: "admin@123" } });
    check("POST /admin/login fake email 422", badEmail.status === 422 && badEmail.body.error?.code === "VALIDATION_ERROR", `status ${badEmail.status}`);

    const shortPw = await inject({ method: "POST", url: "/v1/admin/login", payload: { email: "admin@headshotapi.com", password: "123" } });
    check("POST /admin/login short password 422", shortPw.status === 422 && shortPw.body.error?.code === "VALIDATION_ERROR", `status ${shortPw.status}`);

    const unauthAdmin = await inject({ method: "GET", url: "/v1/admin/overview" });
    check("GET /admin/overview without auth 401", unauthAdmin.status === 401 && unauthAdmin.body.error?.code === "UNAUTHORIZED", `status ${unauthAdmin.status}`);

    const emptyFcm = await inject({ method: "POST", url: "/v1/admin/fcm/campaign", headers: adminAuth, payload: { title: "", body: "" } });
    check("POST /admin/fcm/campaign empty 422", emptyFcm.status === 422 && emptyFcm.body.error?.code === "VALIDATION_ERROR", `status ${emptyFcm.status}`);

    const namelessKey = await inject({ method: "POST", url: "/v1/admin/api-keys", headers: adminAuth, payload: { role: "admin" } });
    check("POST /admin/api-keys without name 422", namelessKey.status === 422 && namelessKey.body.error?.code === "VALIDATION_ERROR", `status ${namelessKey.status}`);

    const badFlag = await inject({ method: "PATCH", url: "/v1/admin/remote-config", headers: adminAuth, payload: { key: "" } });
    check("PATCH /admin/remote-config fake payload 422", badFlag.status === 422 && badFlag.body.error?.code === "VALIDATION_ERROR", `status ${badFlag.status}`);

    const emptyProject = await inject({ method: "POST", url: "/v1/projects", headers: userAuth, payload: { name: "" } });
    check("POST /projects empty name 422", emptyProject.status === 422 && emptyProject.body.error?.code === "VALIDATION_ERROR", `status ${emptyProject.status}`);

    const adminGets = [
      "/v1/admin/users",
      "/v1/admin/wallets",
      "/v1/admin/purchases",
      "/v1/admin/subscriptions",
      "/v1/admin/headshots",
      "/v1/admin/branding",
      "/v1/admin/profile-reviews",
      "/v1/admin/projects",
      "/v1/admin/notifications",
      "/v1/admin/fcm",
      "/v1/admin/ai-usage",
      "/v1/admin/jobs",
      "/v1/admin/webhooks",
      "/v1/admin/remote-config",
    ];
    for (const url of adminGets) {
      const row = await inject({ method: "GET", url, headers: adminAuth });
      check(`GET ${url.replace("/v1", "")} wired`, row.status === 200 && row.body.success === true, `status ${row.status}`);
    }

    const createdKey = await inject({
      method: "POST",
      url: "/v1/admin/api-keys",
      headers: adminAuth,
      payload: { name: "Verify Key", role: "admin", env: "test" },
    });
    const keyId = (createdKey.body.data as { _id?: string; plaintext?: string } | undefined)?._id;
    const plaintext = (createdKey.body.data as { plaintext?: string } | undefined)?.plaintext;
    check(
      "API key create (token management kept)",
      createdKey.status === 200 && Boolean(plaintext?.startsWith("x-api-key_")),
      plaintext ? "plaintext issued once" : `status ${createdKey.status}`,
    );

    const listed = await inject({ method: "GET", url: "/v1/admin/api-keys", headers: adminAuth });
    check("API key list", listed.status === 200, `status ${listed.status}`);

    const stats = await inject({ method: "GET", url: "/v1/admin/api-keys/stats", headers: adminAuth });
    check("API key stats", stats.status === 200, `status ${stats.status}`);

    const viaKey = await inject({ method: "GET", url: "/v1/admin/api-keys/stats", headers: { "x-api-key": plaintext ?? "" } });
    check("Admin route via x-api-key", viaKey.status === 200, `status ${viaKey.status}`);

    const boot = await inject({ method: "POST", url: "/v1/user/bootstrap", headers: userAuth });
    check("POST /user/bootstrap", boot.status === 200 && (boot.body.data as { uid?: string })?.uid === uid, `status ${boot.status}`);

    const profile = await inject({ method: "GET", url: "/v1/user/profile", headers: userAuth });
    const profileData = profile.body.data as { spendableCredits?: number; credits?: number };
    check("GET /user/profile + wallet fields", profile.status === 200 && typeof profileData?.spendableCredits === "number", `status ${profile.status}`);

    const patched = await inject({
      method: "PATCH",
      url: "/v1/user/profile",
      headers: userAuth,
      payload: { name: "Updated Name" },
    });
    check("PATCH /user/profile name", patched.status === 200 && (patched.body.data as { name?: string })?.name === "Updated Name", `status ${patched.status}`);

    const walletHack = await inject({
      method: "PATCH",
      url: "/v1/user/profile",
      headers: userAuth,
      payload: { name: "X", credits: 9999 },
    });
    check("PATCH wallet fields rejected", walletHack.status === 422, `status ${walletHack.status}`);

    const emptyWallet = await inject({ method: "GET", url: "/v1/credits", headers: userAuth });
    check("GET /credits empty wallet", emptyWallet.status === 200 && (emptyWallet.body.data as { spendableCredits?: number })?.spendableCredits === 0, `status ${emptyWallet.status}`);

    const cannot = await inject({ method: "POST", url: "/v1/credits/can-proceed", headers: userAuth, payload: { amount: 50 } });
    check("POST /credits/can-proceed false", cannot.status === 200 && (cannot.body.data as { allowed?: boolean })?.allowed === false, `status ${cannot.status}`);

    const poor = await inject({
      method: "POST",
      url: "/v1/credits/consume",
      headers: { ...userAuth, "idempotency-key": crypto.randomUUID() },
      payload: { amount: 50, reason: "headshot_generation" },
    });
    check(
      "POST /credits/consume 402",
      poor.status === 402 && poor.body.error?.code === "INSUFFICIENT_CREDITS",
      `status ${poor.status} body=${JSON.stringify(poor.body)}`,
    );

    const claimNoSsv = await inject({ method: "POST", url: "/v1/credits/ad-reward/claim", headers: userAuth, payload: {} });
    check(
      "POST /credits/ad-reward/claim without SSV",
      claimNoSsv.status === 200 && (claimNoSsv.body.data as { credits?: number })?.credits === 50,
      `status ${claimNoSsv.status} credits=${(claimNoSsv.body.data as { credits?: number })?.credits}`,
    );

    const ssvId = `ssv_${uid}`;
    const ssv = await inject({
      method: "GET",
      url: `/v1/webhooks/admob-ssv?user_id=${uid}&transaction_id=${ssvId}&reward_amount=50`,
    });
    check("GET /webhooks/admob-ssv grants +50 once", ssv.status === 200, `status ${ssv.status}`);

    const afterSsv = await inject({ method: "GET", url: "/v1/credits", headers: userAuth });
    check("Wallet after SSV is 50", afterSsv.status === 200 && (afterSsv.body.data as { credits?: number })?.credits === 50, `credits=${(afterSsv.body.data as { credits?: number })?.credits}`);

    const claim = await inject({
      method: "POST",
      url: "/v1/credits/ad-reward/claim",
      headers: userAuth,
      payload: { ssvTransactionId: ssvId },
    });
    check("POST /credits/ad-reward/claim after SSV", claim.status === 200, `status ${claim.status}`);

    const ssvAgain = await inject({
      method: "GET",
      url: `/v1/webhooks/admob-ssv?user_id=${uid}&transaction_id=${ssvId}&reward_amount=50`,
    });
    const afterDup = await inject({ method: "GET", url: "/v1/credits", headers: userAuth });
    check("SSV not double-grant", afterDup.status === 200 && (afterDup.body.data as { credits?: number })?.credits === 50 && ssvAgain.status === 200, `credits=${(afterDup.body.data as { credits?: number })?.credits}`);

    const consumeKey = crypto.randomUUID();
    const consumed = await inject({
      method: "POST",
      url: "/v1/credits/consume",
      headers: { ...userAuth, "idempotency-key": consumeKey },
      payload: { amount: 50, reason: "headshot_generation" },
    });
    check("POST /credits/consume 50", consumed.status === 200 && (consumed.body.data as { deducted?: number })?.deducted === 50, `status ${consumed.status}`);

    const replay = await inject({
      method: "POST",
      url: "/v1/credits/consume",
      headers: { ...userAuth, "idempotency-key": consumeKey },
      payload: { amount: 50, reason: "headshot_generation" },
    });
    check(
      "Idempotency 409",
      replay.status === 409 && replay.body.error?.code === "CONFLICT",
      `status ${replay.status} body=${JSON.stringify(replay.body)}`,
    );

    const badAmount = await inject({
      method: "POST",
      url: "/v1/credits/consume",
      headers: userAuth,
      payload: { amount: 7, reason: "headshot_generation" },
    });
    check("Invalid consume amount 422", badAmount.status === 422, `status ${badAmount.status}`);

    const verifySub = await inject({
      method: "POST",
      url: "/v1/subscriptions/verify",
      headers: userAuth,
      payload: { platform: "android", productId: "sub_monthly", purchaseToken: `tok_${uid}` },
    });
    if (config.GOOGLE_PLAY_VERIFY_ENABLED) {
      check(
        "POST /subscriptions/verify requires real Google Play",
        verifySub.status >= 400,
        `status ${verifySub.status} msg=${verifySub.body.error?.message}`,
      );
      await UserModel.updateOne(
        { uid },
        {
          $set: {
            passCredits: 3000,
            credits: 50,
            isPremium: true,
            premiumStatus: "active",
            premiumPlanId: "sub_monthly",
            premiumPlanName: "Monthly",
            activePassId: "sub_monthly",
            passExpiresAt: new Date(Date.now() + 30 * 86400000),
            premiumExpiresAt: new Date(Date.now() + 30 * 86400000),
          },
        },
      );
    } else {
      check(
        "POST /subscriptions/verify grants without Play match",
        verifySub.status === 200 && (verifySub.body.data as { isPremium?: boolean; passCredits?: number })?.isPremium === true
          && (verifySub.body.data as { passCredits?: number })?.passCredits === 3000,
        `status ${verifySub.status} passCredits=${(verifySub.body.data as { passCredits?: number })?.passCredits}`,
      );
    }

    const verifyAgain = await inject({
      method: "POST",
      url: "/v1/subscriptions/verify",
      headers: userAuth,
      payload: { platform: "android", productId: "sub_monthly", purchaseToken: `tok_${uid}` },
    });
    check(
      config.GOOGLE_PLAY_VERIFY_ENABLED ? "Same token still rejected without Play" : "Same token does not stack credits",
      config.GOOGLE_PLAY_VERIFY_ENABLED
        ? verifyAgain.status >= 400
        : verifyAgain.status === 200 && (verifyAgain.body.data as { passCredits?: number })?.passCredits === 3000,
      `status ${verifyAgain.status}`,
    );

    try {
      await verifyPlaySubscription({ ...config, GOOGLE_PLAY_VERIFY_ENABLED: true }, {
        purchaseToken: "fake_token",
        productId: "sub_monthly",
      });
      check("GOOGLE_PLAY_VERIFY_ENABLED=true without SA is rejected", false, "did not throw");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      check(
        "GOOGLE_PLAY_VERIFY_ENABLED=true without SA is rejected",
        msg.toLowerCase().includes("google_play") || msg.toLowerCase().includes("service_account") || msg.toLowerCase().includes("play"),
        msg,
      );
    }

    const sync = await inject({ method: "POST", url: "/v1/subscriptions/sync", headers: userAuth, payload: {} });
    const syncData = sync.body.data as { isPremium?: boolean; uid?: string; credits?: number };
    check(
      "POST /subscriptions/sync",
      sync.status === 200 && syncData?.isPremium === true && Boolean(syncData?.uid),
      `status ${sync.status} uid=${syncData?.uid}`,
    );

    const restore = await inject({ method: "POST", url: "/v1/subscriptions/restore", headers: userAuth, payload: { tokens: [`tok_${uid}`] } });
    check("POST /subscriptions/restore", restore.status === 200, `status ${restore.status}`);

    const purchases = await inject({ method: "GET", url: "/v1/purchases", headers: userAuth });
    check("GET /purchases", purchases.status === 200, `status ${purchases.status}`);

    const upload = await inject({
      method: "POST",
      url: "/v1/headshots/upload",
      headers: { ...userAuth, ...multipartPhoto("headshot").headers },
      payload: multipartPhoto("headshot").payload,
    });
    const uploadId = (upload.body.data as { uploadId?: string } | undefined)?.uploadId;
    check("POST /headshots/upload", upload.status === 200 && Boolean(uploadId), `status ${upload.status}`);

    const noPhoto = await inject({
      method: "POST",
      url: "/v1/headshots/upload",
      headers: { ...userAuth, "content-type": "multipart/form-data; boundary=xxx" },
      payload: Buffer.from("--xxx--\r\n"),
    });
    check("Upload without photo 400", noPhoto.status === 400, `status ${noPhoto.status}`);

    const genKey = crypto.randomUUID();
    const generated = await inject({
      method: "POST",
      url: "/v1/headshots/generate",
      headers: { ...userAuth, "idempotency-key": genKey },
      payload: {
        uploadId,
        toolType: "headshot",
        selections: { gender: { id: "male" }, style: { id: "corporate" }, background: { id: "studio_grey" } },
      },
    });
    const jobId = (generated.body.data as { jobId?: string } | undefined)?.jobId;
    check("POST /headshots/generate async job", generated.status === 200 && Boolean(jobId), `status ${generated.status}`);

    const genReplay = await inject({
      method: "POST",
      url: "/v1/headshots/generate",
      headers: { ...userAuth, "idempotency-key": genKey },
      payload: { uploadId },
    });
    check("Generate idempotency 409", genReplay.status === 409, `status ${genReplay.status}`);

    const polled = await pollAiJob(async () => {
      const job = await inject({ method: "GET", url: `/v1/headshots/jobs/${jobId}`, headers: userAuth });
      const data = job.body.data as { status?: string; imageUrl?: string } | undefined;
      return { status: data?.status, imageUrl: data?.imageUrl ?? null };
    });
    check(
      "GET /headshots/jobs/:id completed",
      polled.status === "completed" && Boolean(polled.imageUrl),
      `status=${polled.status} polls=${polled.polls}`,
      polled.waitMs,
    );

    const resultsList = await inject({ method: "GET", url: "/v1/headshots/results", headers: userAuth });
    check("GET /headshots/results", resultsList.status === 200, `status ${resultsList.status}`);

    const brandingUpload = await inject({
      method: "POST",
      url: "/v1/headshots/upload",
      headers: { ...userAuth, ...multipartPhoto("branding").headers },
      payload: multipartPhoto("branding").payload,
    });
    const brandingId = (brandingUpload.body.data as { uploadId?: string } | undefined)?.uploadId;
    const analyzed = await inject({
      method: "POST",
      url: "/v1/branding/analyze",
      headers: userAuth,
      payload: { uploadId: brandingId },
    });
    check(
      "POST /branding/analyze 50 credits",
      analyzed.status === 200 && (analyzed.body.data as { creditsDeducted?: number })?.creditsDeducted === 50,
      `status ${analyzed.status}`,
    );

    const beforeImprove = await inject({ method: "GET", url: "/v1/credits", headers: userAuth });
    const spendableBefore = Number((beforeImprove.body.data as { spendableCredits?: number })?.spendableCredits ?? 0);
    const improveStarted = Date.now();
    const improved = await inject({
      method: "POST",
      url: "/v1/branding/improve",
      headers: userAuth,
      payload: { uploadId: brandingId },
    });
    const improveData = improved.body.data as { improvementId?: string; imageUrl?: string; status?: string } | undefined;
    const improvementId = improveData?.improvementId;
    check(
      "POST /branding/improve returns image",
      improved.status === 200 && Boolean(improvementId) && Boolean(improveData?.imageUrl),
      `status ${improved.status} imageUrl=${Boolean(improveData?.imageUrl)}`,
    );

    const polledImprove = await pollAiJob(async () => {
      const job = await inject({ method: "GET", url: `/v1/headshots/jobs/${improvementId}`, headers: userAuth });
      const data = job.body.data as { status?: string; imageUrl?: string } | undefined;
      return { status: data?.status, imageUrl: data?.imageUrl ?? null };
    });
    const improveMs = Date.now() - improveStarted;
    const afterImprove = await inject({ method: "GET", url: "/v1/credits", headers: userAuth });
    const spendableAfter = Number((afterImprove.body.data as { spendableCredits?: number })?.spendableCredits ?? 0);
    check(
      "POST /branding/improve deducts 100 not 150",
      polledImprove.status === "completed" &&
        Boolean(polledImprove.imageUrl) &&
        spendableBefore - spendableAfter === 100,
      `delta=${spendableBefore - spendableAfter} status=${polledImprove.status} wait=${polledImprove.waitMs}ms`,
      improveMs,
    );

    const photoA = await inject({
      method: "POST",
      url: "/v1/headshots/upload",
      headers: { ...userAuth, ...multipartPhoto("profile_review").headers },
      payload: multipartPhoto("profile_review").payload,
    });
    const photoB = await inject({
      method: "POST",
      url: "/v1/headshots/upload",
      headers: { ...userAuth, ...multipartPhoto("profile_review").headers },
      payload: multipartPhoto("profile_review").payload,
    });
    const onePhoto = await inject({
      method: "POST",
      url: "/v1/profile-review/analyze",
      headers: userAuth,
      payload: { uploadIds: [(photoA.body.data as { uploadId?: string })?.uploadId] },
    });
    check("Profile review rejects <2 photos", onePhoto.status === 422, `status ${onePhoto.status}`);

    const review = await inject({
      method: "POST",
      url: "/v1/profile-review/analyze",
      headers: userAuth,
      payload: {
        uploadIds: [
          (photoA.body.data as { uploadId?: string })?.uploadId,
          (photoB.body.data as { uploadId?: string })?.uploadId,
        ],
      },
    });
    check(
      "POST /profile-review/analyze 50 credits",
      review.status === 200 &&
        (review.body.data as { creditsDeducted?: number })?.creditsDeducted === 50 &&
        Array.isArray((review.body.data as { photos?: unknown[] })?.photos) &&
        Number((review.body.data as { overallScore?: number })?.overallScore ?? -1) >= 0 &&
        Boolean((review.body.data as { summary?: string })?.summary) &&
        Array.isArray((review.body.data as { metrics?: unknown[] })?.metrics),
      `status ${review.status} score=${(review.body.data as { overallScore?: number })?.overallScore}`,
    );

    const project = await inject({
      method: "POST",
      url: "/v1/projects",
      headers: userAuth,
      payload: { name: "LinkedIn set", toolType: "headshot", styleId: "corporate", isFavorite: true },
    });
    const projectId = (project.body.data as { projectId?: string } | undefined)?.projectId;
    check("POST /projects", project.status === 200 && Boolean(projectId), `status ${project.status}`);

    const gotProject = await inject({ method: "GET", url: `/v1/projects/${projectId}`, headers: userAuth });
    check("GET /projects/:id", gotProject.status === 200, `status ${gotProject.status}`);

    const patchedProject = await inject({
      method: "PATCH",
      url: `/v1/projects/${projectId}`,
      headers: userAuth,
      payload: { isFavorite: false },
    });
    check("PATCH /projects/:id", patchedProject.status === 200, `status ${patchedProject.status}`);

    const deletedProject = await inject({ method: "DELETE", url: `/v1/projects/${projectId}`, headers: userAuth });
    const listedProjects = await inject({ method: "GET", url: "/v1/projects", headers: userAuth });
    const hidden = ((listedProjects.body.data as { items?: Array<{ projectId?: string }> })?.items ?? []).every((p) => p.projectId !== projectId);
    check("DELETE /projects soft-hide", deletedProject.status === 200 && hidden, `hidden=${hidden}`);

    await NotificationModel.create({
      notificationId: `n_${uid}`,
      uid,
      title: "Ready",
      body: "Your headshot is ready",
      type: "generation",
      delivery: "sent",
    });
    const notes = await inject({ method: "GET", url: "/v1/notifications", headers: userAuth });
    check("GET /notifications", notes.status === 200, `status ${notes.status}`);
    const read = await inject({ method: "PATCH", url: `/v1/notifications/n_${uid}/read`, headers: userAuth });
    check("PATCH /notifications/:id/read", read.status === 200 && (read.body.data as { read?: boolean })?.read === true, `status ${read.status}`);

    const fcm = await inject({
      method: "POST",
      url: "/v1/users/fcm-token",
      headers: userAuth,
      payload: { token: "fcm-device-token-1234567890", platform: "android" },
    });
    check("POST /users/fcm-token", fcm.status === 200, `status ${fcm.status}`);

    const playHook = await inject({
      method: "POST",
      url: "/v1/webhooks/google-play",
      payload: { eventId: `play_${uid}`, eventType: "SUBSCRIPTION_CANCELED", purchaseToken: `tok_${uid}`, productId: "sub_monthly" },
    });
    check("POST /webhooks/google-play", playHook.status === 200, `status ${playHook.status}`);

    const appStore = await inject({ method: "POST", url: "/v1/webhooks/app-store", payload: { notificationUUID: `ios_${uid}` } });
    check("POST /webhooks/app-store", appStore.status === 200, `status ${appStore.status}`);

    const overview = await inject({ method: "GET", url: "/v1/admin/overview", headers: adminAuth });
    check("GET /admin/overview", overview.status === 200, `status ${overview.status}`);

    const rotated = await inject({ method: "POST", url: `/v1/admin/api-keys/${keyId}/rotate`, headers: adminAuth });
    const newPlain = (rotated.body.data as { plaintext?: string } | undefined)?.plaintext;
    check("API key rotate", rotated.status === 200 && Boolean(newPlain) && newPlain !== plaintext, `status ${rotated.status}`);

    const revoked = await inject({
      method: "POST",
      url: `/v1/admin/api-keys/${(rotated.body.data as { _id?: string })?._id}/revoke`,
      headers: adminAuth,
    });
    check("API key revoke", revoked.status === 200, `status ${revoked.status}`);

    const oldKey = await inject({ method: "GET", url: "/v1/admin/api-keys/stats", headers: { "x-api-key": plaintext ?? "" } });
    check("Revoked/rotated old key rejected", oldKey.status === 401, `status ${oldKey.status}`);

    const removed = await inject({ method: "DELETE", url: "/v1/user/delete", headers: userAuth });
    check("DELETE /user/delete", removed.status === 200, `status ${removed.status}`);

    const afterDelete = await inject({ method: "GET", url: "/v1/credits", headers: userAuth });
    check("Deleted account 403", afterDelete.status === 403, `status ${afterDelete.status}`);

    const cancelUpload = await inject({
      method: "POST",
      url: "/v1/user/bootstrap",
      headers: userAuth,
    });
    check("Bootstrap deleted account 403", cancelUpload.status === 403, `status ${cancelUpload.status}`);
  } catch (err) {
    check("Harness crash", false, err instanceof Error ? err.message : String(err));
  } finally {
    await UserModel.deleteMany({ uid: { $regex: `^${uid}` } });
    await app.close();
    await disconnectDb();
  }

  const failed = results.filter((r) => !r.ok);
  const timed = results.filter((r) => r.ms !== undefined).sort((a, b) => (b.ms ?? 0) - (a.ms ?? 0));
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (timed.length) {
    console.log("\nSlowest endpoints:");
    for (const row of timed.slice(0, 8)) console.log(` - ${row.name}: ${row.ms}ms`);
  }
  if (failed.length) {
    console.log("Failed:");
    for (const row of failed) console.log(` - ${row.name}: ${row.detail}`);
    process.exitCode = 1;
  }
}

void main();
