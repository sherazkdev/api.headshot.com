import fs from "node:fs/promises";
import { CREDIT_COSTS } from "../../config/credits.js";
import { errors } from "../../lib/errors.js";
import { GeminiClient } from "../../lib/ai-providers.js";
import { rejectIfDuplicate } from "../../lib/idempotency.js";
import { UploadModel, AiJobModel } from "../../models/index.js";
import { CreditsService } from "../credits/credits.service.js";
import type { AppConfig } from "../../config/index.js";
import { pageMeta } from "../../lib/zod.js";

export class ProfileReviewService {
  constructor(
    private readonly config: AppConfig,
    private readonly credits: CreditsService,
    private readonly gemini: GeminiClient,
  ) {}

  async analyze(uid: string, uploadIds: string[], idempotencyKey?: string) {
    if (uploadIds.length < 2) throw errors.validation("Minimum 2 photos required");
    const can = await this.credits.canProceed(uid, CREDIT_COSTS.profile_review);
    if (!can.allowed) throw errors.insufficientCredits(CREDIT_COSTS.profile_review, can.spendableCredits);
    await rejectIfDuplicate(uid, "profile-review.analyze", idempotencyKey, this.config.IDEMPOTENCY_TTL_HOURS);
    const uploads = await UploadModel.find({ uid, uploadId: { $in: uploadIds } });
    if (uploads.length !== uploadIds.length) throw errors.notFound("Upload not found");
    if (uploads.some((u) => u.expiresAt.getTime() <= Date.now())) throw errors.notFound("Upload expired");
    const images = await Promise.all(
      uploads.map(async (u) => ({
        mimeType: u.mimeType,
        data: (await fs.readFile(u.path)).toString("base64"),
      })),
    );
    const vision = await this.gemini.visionJson(
      `Rank these profile photos. Return JSON {"photos":[{"index":0,"score":0-100,"factors":[],"strengths":[],"weaknesses":[]}],"bestIndex":0,"bestScore":0}`,
      images,
    );
    const consumed = await this.credits.consume(
      uid,
      CREDIT_COSTS.profile_review,
      "profile_review",
      uploadIds.join(","),
      idempotencyKey,
      { reuseIdempotency: true },
    );
    const jobId = crypto.randomUUID();
    await AiJobModel.create({
      jobId,
      uid,
      jobType: "profile_review",
      provider: "gemini",
      model: this.config.GEMINI_VISION_MODEL,
      status: "completed",
      credits: CREDIT_COSTS.profile_review,
      fromPassCredits: consumed.fromPassCredits,
      fromBonusCredits: consumed.fromBonusCredits,
      payload: { uploadIds },
      result: vision as Record<string, unknown>,
    });
    return {
      reviewId: jobId,
      creditsDeducted: CREDIT_COSTS.profile_review,
      remainingSpendable: consumed.remainingSpendable,
      ...(vision as object),
    };
  }

  async adminList(page: number, perPage: number) {
    const q = { jobType: "profile_review" };
    const [items, total] = await Promise.all([
      AiJobModel.find(q)
        .sort({ createdAt: -1 })
        .skip((page - 1) * perPage)
        .limit(perPage),
      AiJobModel.countDocuments(q),
    ]);
    return { items, meta: pageMeta(page, perPage, total) };
  }
}
