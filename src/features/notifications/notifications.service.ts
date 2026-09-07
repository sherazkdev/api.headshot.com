import { randomUUID } from "node:crypto";
import { NotificationModel, UserModel } from "../../models/index.js";
import { errors } from "../../lib/errors.js";
import { pageMeta } from "../../lib/zod.js";

export class NotificationsService {
  async list(uid: string, page: number, perPage: number) {
    const [items, total] = await Promise.all([
      NotificationModel.find({ uid })
        .sort({ createdAt: -1 })
        .skip((page - 1) * perPage)
        .limit(perPage),
      NotificationModel.countDocuments({ uid }),
    ]);
    return { items, meta: pageMeta(page, perPage, total) };
  }

  async markRead(uid: string, id: string) {
    const doc = await NotificationModel.findOne({ notificationId: id, uid });
    if (!doc) throw errors.notFound("Notification not found");
    doc.read = true;
    await doc.save();
    return doc;
  }

  async adminList(page: number, perPage: number) {
    const [items, total] = await Promise.all([
      NotificationModel.find()
        .sort({ createdAt: -1 })
        .skip((page - 1) * perPage)
        .limit(perPage),
      NotificationModel.countDocuments(),
    ]);
    return { items, meta: pageMeta(page, perPage, total) };
  }

  async fcmOverview() {
    const [registered, android, ios, invalid, tokens, history] = await Promise.all([
      UserModel.countDocuments({ fcmToken: { $ne: null } }),
      UserModel.countDocuments({ fcmPlatform: "android", fcmToken: { $ne: null } }),
      UserModel.countDocuments({ fcmPlatform: "ios", fcmToken: { $ne: null } }),
      UserModel.countDocuments({ fcmToken: null, accountStatus: "active" }),
      UserModel.find({ fcmToken: { $ne: null } })
        .select("uid email fcmToken fcmPlatform updatedAt")
        .sort({ updatedAt: -1 })
        .limit(40),
      NotificationModel.find({ type: "system" }).sort({ createdAt: -1 }).limit(20),
    ]);
    return {
      registeredTokens: registered,
      androidDevices: android,
      iosDevices: ios,
      invalidTokens: invalid,
      tokens: tokens.map((u) => ({
        uid: u.uid,
        email: u.email,
        token: u.fcmToken ? `${u.fcmToken.slice(0, 6)}…${u.fcmToken.slice(-4)}` : "",
        platform: u.fcmPlatform ?? "unknown",
        lastSeen: u.updatedAt,
      })),
      history,
    };
  }

  async campaign(input: { title: string; body: string; audience: "all" | "subscribers" | "inactive" }) {
    if (!input.title.trim() || !input.body.trim()) throw errors.validation("Title and body are required");
    const q: Record<string, unknown> = { accountStatus: "active", fcmToken: { $ne: null } };
    if (input.audience === "subscribers") q.isPremium = true;
    if (input.audience === "inactive") {
      const week = new Date(Date.now() - 7 * 86400000);
      q.lastLoginAt = { $lt: week };
    }
    const users = await UserModel.find(q).select("uid fcmPlatform").limit(5000);
    const docs = users.map((u) => ({
      notificationId: `n_${randomUUID().replace(/-/g, "").slice(0, 16)}`,
      uid: u.uid,
      title: input.title.trim(),
      body: input.body.trim(),
      type: "system" as const,
      delivery: "queued" as const,
      platform: u.fcmPlatform ?? undefined,
    }));
    if (docs.length) await NotificationModel.insertMany(docs);
    return { queued: docs.length, audience: input.audience };
  }
}
