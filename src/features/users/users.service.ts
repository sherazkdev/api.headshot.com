import { UserModel } from "../../models/index.js";
import { errors } from "../../lib/errors.js";
import { walletView } from "../../lib/wallet.js";
import { MemoryCache } from "../../cache/index.js";
import { pageMeta } from "../../lib/zod.js";
import { LocalStorage } from "../../lib/storage.js";

export class UsersService {
  constructor(
    private readonly cache: MemoryCache,
    private readonly storage: LocalStorage,
  ) {}

  async bootstrap(input: {
    uid: string;
    email?: string;
    name?: string;
    photoUrl?: string;
    loginProvider?: "email" | "google" | "apple" | "facebook";
    emailVerified?: boolean;
  }) {
    const existing = await UserModel.findOne({ uid: input.uid });
    if (existing) {
      if (existing.accountStatus === "deleted") throw errors.forbidden("Account deleted");
      if (existing.accountStatus === "suspended") throw errors.forbidden("Account suspended");
      existing.lastLoginAt = new Date();
      if (input.email) existing.email = input.email;
      if (input.name) existing.name = input.name;
      await existing.save();
      this.cache.del(`user:${input.uid}`);
      return this.public(existing);
    }
    const created = await UserModel.create({
      uid: input.uid,
      email: input.email ?? "",
      name: input.name ?? "",
      photoUrl: input.photoUrl,
      loginProvider: input.loginProvider ?? "email",
      emailVerified: input.emailVerified ?? false,
      lastLoginAt: new Date(),
    });
    return this.public(created);
  }

  async profile(uid: string) {
    return this.public(await this.require(uid, true));
  }

  async updateProfile(uid: string, patch: { name?: string; photoUrl?: string }) {
    const user = await this.require(uid, true);
    if (patch.name !== undefined) user.name = patch.name;
    if (patch.photoUrl !== undefined) user.photoUrl = patch.photoUrl;
    await user.save();
    this.cache.del(`user:${uid}`);
    return this.public(user);
  }

  async deleteAccount(uid: string) {
    const user = await UserModel.findOne({ uid });
    if (!user) throw errors.notFound("User not found");
    user.accountStatus = "deleted";
    user.name = "";
    user.email = "";
    user.photoUrl = "";
    user.fcmToken = null;
    user.credits = 0;
    user.passCredits = 0;
    user.passExpiresAt = null;
    user.activePassId = null;
    user.isPremium = false;
    user.premiumStatus = "expired";
    await user.save();
    await this.storage.deleteUserFiles(uid);
    this.cache.delPrefix(`user:${uid}`);
    this.cache.del(`wallet:${uid}`);
    return { deleted: true };
  }

  async setFcm(uid: string, token: string, platform: string) {
    const user = await this.require(uid, true);
    user.fcmToken = token;
    user.fcmPlatform = platform;
    await user.save();
    return { stored: true };
  }

  async adminList(page: number, perPage: number, q?: string) {
    const filter = q
      ? {
          $or: [{ name: new RegExp(q, "i") }, { email: new RegExp(q, "i") }, { uid: new RegExp(q, "i") }],
        }
      : {};
    const [items, total] = await Promise.all([
      UserModel.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * perPage)
        .limit(perPage),
      UserModel.countDocuments(filter),
    ]);
    return { items, meta: pageMeta(page, perPage, total) };
  }

  async adminGet(uid: string) {
    return this.require(uid, false);
  }

  async setStatus(uid: string, accountStatus: "active" | "suspended" | "deleted") {
    const user = await this.require(uid, false);
    user.accountStatus = accountStatus;
    await user.save();
    this.cache.del(`user:${uid}`);
    return user;
  }

  private public(user: { toObject: () => Record<string, unknown> } & Parameters<typeof walletView>[0]) {
    const obj = user.toObject();
    return { ...obj, ...walletView(user) };
  }

  private async require(uid: string, blockInactive: boolean) {
    const user = await UserModel.findOne({ uid });
    if (!user) throw errors.notFound("User not found");
    if (blockInactive && user.accountStatus === "deleted") throw errors.forbidden("Account deleted");
    if (blockInactive && user.accountStatus === "suspended") throw errors.forbidden("Account suspended");
    return user;
  }
}
