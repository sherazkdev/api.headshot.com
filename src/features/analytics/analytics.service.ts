import { AiJobModel, PurchaseModel, UserModel } from "../../models/index.js";
import { spendableCredits } from "../../lib/wallet.js";
import { GENERATIONS_PER_DAY_ALERT } from "../../config/credits.js";
import type { MemoryQueue } from "../../queue/index.js";
import { pageMeta } from "../../lib/zod.js";

export class AnalyticsService {
  constructor(private readonly queue: MemoryQueue) {}

  async overview() {
    const [users, premium, suspended, jobs, purchases] = await Promise.all([
      UserModel.countDocuments({ accountStatus: { $ne: "deleted" } }),
      UserModel.countDocuments({ isPremium: true }),
      UserModel.countDocuments({ accountStatus: "suspended" }),
      AiJobModel.countDocuments({}),
      PurchaseModel.aggregate<{ revenue: number; credits: number; n: number }>([
        { $match: { status: "completed" } },
        { $group: { _id: null, revenue: { $sum: "$amount" }, credits: { $sum: "$creditsAdded" }, n: { $sum: 1 } } },
      ]),
    ]);
    const wallets = await UserModel.find({ accountStatus: "active" }).select("credits passCredits passExpiresAt");
    const spendable = wallets.reduce((sum, u) => sum + spendableCredits(u), 0);
    return {
      totalUsers: users,
      premium,
      suspended,
      spendableCredits: spendable,
      aiGenerations: jobs,
      purchaseRevenue: purchases[0]?.revenue ?? 0,
      creditsAdded: purchases[0]?.credits ?? 0,
      transactions: purchases[0]?.n ?? 0,
      queue: this.queue.stats(),
    };
  }

  async jobs(page: number, perPage: number, status?: string) {
    const q = status ? { status } : {};
    const [items, total] = await Promise.all([
      AiJobModel.find(q)
        .sort({ createdAt: -1 })
        .skip((page - 1) * perPage)
        .limit(perPage),
      AiJobModel.countDocuments(q),
    ]);
    return { items, meta: pageMeta(page, perPage, total), queue: this.queue.stats() };
  }

  async usage() {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const today = await AiJobModel.aggregate<{ _id: string; n: number }>([
      { $match: { createdAt: { $gte: start } } },
      { $group: { _id: "$uid", n: { $sum: 1 } } },
      { $match: { n: { $gt: GENERATIONS_PER_DAY_ALERT } } },
    ]);
    const byType = await AiJobModel.aggregate<{ _id: string; n: number }>([
      { $group: { _id: "$jobType", n: { $sum: 1 } } },
    ]);
    const byProvider = await AiJobModel.aggregate<{ _id: string; n: number }>([
      { $group: { _id: "$provider", n: { $sum: 1 } } },
    ]);
    const byStatus = await AiJobModel.aggregate<{ _id: string; n: number }>([
      { $group: { _id: "$status", n: { $sum: 1 } } },
    ]);
    const totalJobs = byType.reduce((s, r) => s + r.n, 0);
    return {
      jobs: totalJobs,
      exceeded50Today: today,
      byEndpoint: byType,
      byProvider,
      byStatus,
    };
  }

  async wallets(page: number, perPage: number) {
    const [items, total] = await Promise.all([
      UserModel.find({ accountStatus: "active" })
        .sort({ updatedAt: -1 })
        .skip((page - 1) * perPage)
        .limit(perPage),
      UserModel.countDocuments({ accountStatus: "active" }),
    ]);
    return { items, meta: pageMeta(page, perPage, total) };
  }
}
