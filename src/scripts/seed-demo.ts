import { randomUUID } from "node:crypto";
import { loadConfig } from "../config/index.js";
import { connectDb, disconnectDb } from "../db/index.js";
import {
  AiJobModel,
  NotificationModel,
  ProjectModel,
  PurchaseModel,
  UserModel,
  WebhookEventModel,
} from "../models/index.js";

function daysAgo(n: number) {
  return new Date(Date.now() - n * 86400000);
}

const DEMO_PREFIX = "demo_";

async function main() {
  const config = loadConfig();
  await connectDb(config);

  await Promise.all([
    UserModel.deleteMany({ uid: { $regex: `^${DEMO_PREFIX}` } }),
    AiJobModel.deleteMany({ uid: { $regex: `^${DEMO_PREFIX}` } }),
    PurchaseModel.deleteMany({ uid: { $regex: `^${DEMO_PREFIX}` } }),
    NotificationModel.deleteMany({ uid: { $regex: `^${DEMO_PREFIX}` } }),
    WebhookEventModel.deleteMany({ eventId: { $regex: `^${DEMO_PREFIX}` } }),
    ProjectModel.deleteMany({ uid: { $regex: `^${DEMO_PREFIX}` } }),
  ]);

  const users = [
    { uid: `${DEMO_PREFIX}emma`, name: "Emma Wilson", email: "emma@demo.local", loginProvider: "google" as const, credits: 120, passCredits: 3000, isPremium: true, premiumPlanId: "sub_monthly", premiumPlanName: "Monthly", premiumStatus: "active" as const, passExpiresAt: daysAgo(-20), premiumExpiresAt: daysAgo(-20), fcmToken: "fcm_emma_token_abc1234567890", fcmPlatform: "android" },
    { uid: `${DEMO_PREFIX}liam`, name: "Liam Chen", email: "liam@demo.local", loginProvider: "apple" as const, credits: 50, passCredits: 0, isPremium: false, premiumStatus: "free" as const, fcmToken: "fcm_liam_token_xyz9876543210", fcmPlatform: "ios" },
    { uid: `${DEMO_PREFIX}sara`, name: "Sara Khan", email: "sara@demo.local", loginProvider: "email" as const, credits: 200, passCredits: 13000, isPremium: true, premiumPlanId: "sub_yearly", premiumPlanName: "Yearly", premiumStatus: "active" as const, passExpiresAt: daysAgo(-200), premiumExpiresAt: daysAgo(-200) },
    { uid: `${DEMO_PREFIX}omar`, name: "Omar Ali", email: "omar@demo.local", loginProvider: "google" as const, credits: 0, passCredits: 500, isPremium: true, premiumPlanId: "sub_weekly", premiumPlanName: "Weekly", premiumStatus: "active" as const, passExpiresAt: daysAgo(-3), premiumExpiresAt: daysAgo(-3) },
    { uid: `${DEMO_PREFIX}mia`, name: "Mia Park", email: "mia@demo.local", loginProvider: "email" as const, credits: 80, passCredits: 0, isPremium: false, premiumStatus: "cancelled" as const, premiumPlanName: "Monthly" },
    { uid: `${DEMO_PREFIX}noah`, name: "Noah Brooks", email: "noah@demo.local", loginProvider: "google" as const, credits: 30, passCredits: 0, isPremium: false, premiumStatus: "free" as const, accountStatus: "suspended" as const },
    { uid: `${DEMO_PREFIX}ava`, name: "Ava Singh", email: "ava@demo.local", loginProvider: "apple" as const, credits: 150, passCredits: 3000, isPremium: true, premiumPlanId: "sub_monthly", premiumPlanName: "Monthly", premiumStatus: "active" as const, passExpiresAt: daysAgo(-15), premiumExpiresAt: daysAgo(-15), fcmToken: "fcm_ava_token_def4567890123", fcmPlatform: "ios" },
    { uid: `${DEMO_PREFIX}zoe`, name: "Zoe Martin", email: "zoe@demo.local", loginProvider: "email" as const, credits: 45, passCredits: 0, isPremium: false, premiumStatus: "free" as const },
  ].map((u) => ({
    ...u,
    emailVerified: true,
    adRewardClaimed: true,
    welcomeBonusGranted: true,
    accountStatus: u.accountStatus ?? ("active" as const),
    lastLoginAt: daysAgo(Math.floor(Math.random() * 14)),
    createdAt: daysAgo(30 + Math.floor(Math.random() * 60)),
    updatedAt: daysAgo(Math.floor(Math.random() * 7)),
  }));

  await UserModel.insertMany(users);

  const purchases = [
    { purchaseId: `${DEMO_PREFIX}p1`, uid: `${DEMO_PREFIX}emma`, productId: "sub_monthly", creditsAdded: 3000, amount: 9.99, platform: "play_store" as const, createdAt: daysAgo(25) },
    { purchaseId: `${DEMO_PREFIX}p2`, uid: `${DEMO_PREFIX}sara`, productId: "sub_yearly", creditsAdded: 13000, amount: 49.99, platform: "play_store" as const, createdAt: daysAgo(40) },
    { purchaseId: `${DEMO_PREFIX}p3`, uid: `${DEMO_PREFIX}omar`, productId: "sub_weekly", creditsAdded: 500, amount: 4.99, platform: "play_store" as const, createdAt: daysAgo(5) },
    { purchaseId: `${DEMO_PREFIX}p4`, uid: `${DEMO_PREFIX}ava`, productId: "sub_monthly", creditsAdded: 3000, amount: 9.99, platform: "play_store" as const, createdAt: daysAgo(18) },
    { purchaseId: `${DEMO_PREFIX}p5`, uid: `${DEMO_PREFIX}liam`, productId: "rewarded_ad", creditsAdded: 50, amount: 0, platform: "rewarded_ad" as const, createdAt: daysAgo(2) },
    { purchaseId: `${DEMO_PREFIX}p6`, uid: `${DEMO_PREFIX}zoe`, productId: "rewarded_ad", creditsAdded: 50, amount: 0, platform: "rewarded_ad" as const, createdAt: daysAgo(1) },
    { purchaseId: `${DEMO_PREFIX}p7`, uid: `${DEMO_PREFIX}emma`, productId: "sub_monthly", creditsAdded: 3000, amount: 9.99, platform: "play_store" as const, createdAt: daysAgo(3) },
  ].map((p) => ({ ...p, currency: "USD", status: "completed" as const }));

  await PurchaseModel.insertMany(purchases);

  const jobTypes = [
    { jobType: "headshot_generation" as const, credits: 50, provider: "gemini" as const, model: "gemini-3.1-flash-image", payload: { toolType: "headshot" } },
    { jobType: "branding_analyze" as const, credits: 50, provider: "gemini" as const, model: "gemini-3.1-flash-lite", payload: {}, result: { overallScore: 78 } },
    { jobType: "branding_improve" as const, credits: 100, provider: "gemini" as const, model: "gemini-3.1-flash-image", payload: {} },
    { jobType: "profile_review" as const, credits: 50, provider: "gemini" as const, model: "gemini-3.1-flash-lite", payload: {} },
    { jobType: "headshot_generation" as const, credits: 50, provider: "bfl" as const, model: "flux-2-klein-4b", payload: { toolType: "headshot" } },
  ];
  const statuses = ["completed", "completed", "completed", "processing", "queued", "failed", "cancelled"] as const;
  const jobs = Array.from({ length: 28 }, (_, i) => {
    const u = users[i % users.length];
    const t = jobTypes[i % jobTypes.length];
    const status = statuses[i % statuses.length];
    return {
      jobId: `${DEMO_PREFIX}job_${i + 1}`,
      uid: u.uid,
      ...t,
      status,
      fromPassCredits: status === "completed" ? t.credits : 0,
      fromBonusCredits: 0,
      queueMs: 120 + i * 10,
      durationMs: status === "completed" ? 2400 + i * 50 : undefined,
      createdAt: daysAgo(28 - (i % 28)),
      updatedAt: daysAgo(28 - (i % 28)),
    };
  });
  await AiJobModel.insertMany(jobs);

  const notes = users.flatMap((u, i) => [
    {
      notificationId: `${DEMO_PREFIX}n_${i}_1`,
      uid: u.uid,
      title: "Headshot ready",
      body: "Your professional headshot is ready to download.",
      type: "generation" as const,
      delivery: "delivered" as const,
      read: i % 2 === 0,
      createdAt: daysAgo(3),
    },
    {
      notificationId: `${DEMO_PREFIX}n_${i}_2`,
      uid: u.uid,
      title: "Premium active",
      body: "Your subscription credits are available.",
      type: "subscription" as const,
      delivery: "sent" as const,
      read: false,
      createdAt: daysAgo(1),
    },
  ]);
  await NotificationModel.insertMany(notes);

  const webhooks = [
    { eventId: `${DEMO_PREFIX}wh1`, source: "google_play" as const, eventType: "SUBSCRIPTION_PURCHASED", status: "processed" as const, signatureValid: true, attempts: 1, receivedAt: daysAgo(10), processedAt: daysAgo(10) },
    { eventId: `${DEMO_PREFIX}wh2`, source: "google_play" as const, eventType: "SUBSCRIPTION_RENEWED", status: "processed" as const, signatureValid: true, attempts: 1, receivedAt: daysAgo(3), processedAt: daysAgo(3) },
    { eventId: `${DEMO_PREFIX}wh3`, source: "admob_ssv" as const, eventType: "REWARD_GRANTED", status: "processed" as const, signatureValid: true, attempts: 1, receivedAt: daysAgo(2), processedAt: daysAgo(2) },
    { eventId: `${DEMO_PREFIX}wh4`, source: "app_store" as const, eventType: "DID_RENEW", status: "ignored" as const, signatureValid: false, attempts: 1, receivedAt: daysAgo(7), processedAt: daysAgo(7) },
    { eventId: `${DEMO_PREFIX}wh5`, source: "google_play" as const, eventType: "SUBSCRIPTION_CANCELED", status: "failed" as const, signatureValid: false, attempts: 2, receivedAt: daysAgo(1), processedAt: daysAgo(1) },
    { eventId: `${DEMO_PREFIX}wh6`, source: "google_play" as const, eventType: "SUBSCRIPTION_RENEWED", status: "processed" as const, signatureValid: true, attempts: 1, receivedAt: daysAgo(0), processedAt: daysAgo(0) },
  ].map((w) => ({ ...w, payload: {}, createdAt: w.receivedAt, updatedAt: w.receivedAt }));
  await WebhookEventModel.insertMany(webhooks);

  const projects = users.slice(0, 5).map((u, i) => ({
    projectId: `${DEMO_PREFIX}proj_${i + 1}`,
    uid: u.uid,
    name: ["LinkedIn Set", "Corporate Pack", "Creative Portfolio", "Resume Photo", "Team Headshots"][i],
    toolType: "headshot",
    status: (i % 2 === 0 ? "completed" : "in_progress") as "completed" | "in_progress",
    styleId: "corporate",
    isFavorite: i % 3 === 0,
    brandingScore: 70 + i * 4,
    createdAt: daysAgo(14 - i),
    updatedAt: daysAgo(i),
  }));
  await ProjectModel.insertMany(projects);

  const counts = {
    users: await UserModel.countDocuments({ uid: { $regex: `^${DEMO_PREFIX}` } }),
    jobs: await AiJobModel.countDocuments({ uid: { $regex: `^${DEMO_PREFIX}` } }),
    purchases: await PurchaseModel.countDocuments({ uid: { $regex: `^${DEMO_PREFIX}` } }),
    notifications: await NotificationModel.countDocuments({ uid: { $regex: `^${DEMO_PREFIX}` } }),
    webhooks: await WebhookEventModel.countDocuments({ eventId: { $regex: `^${DEMO_PREFIX}` } }),
    projects: await ProjectModel.countDocuments({ uid: { $regex: `^${DEMO_PREFIX}` } }),
  };

  console.log("Demo data seeded into MongoDB (headshot_ai):");
  console.log(counts);
  console.log("Refresh admin dashboard: http://localhost:3001");

  await disconnectDb();
}

void main();
