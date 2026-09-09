import fs from "node:fs/promises";
import { CREDIT_COSTS } from "../../config/credits.js";
import { errors } from "../../lib/errors.js";
import { asDate } from "../../lib/wallet.js";
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
    if (uploads.some((u) => {
      const exp = asDate(u.expiresAt);
      return !exp || exp.getTime() <= Date.now();
    })) throw errors.notFound("Upload expired");
    const images = await Promise.all(
      uploads.map(async (u) => ({
        mimeType: u.mimeType,
        data: (await fs.readFile(u.path)).toString("base64"),
      })),
    );
    const vision = await this.gemini.visionJson(
      `Compare these ${images.length} professional profile photos of the same person. Return JSON only:
{"overallScore":0-100,"overallLabel":"Poor|Fair|Good|Excellent","summary":"one sentence","improvementTips":["tip"],"strengths":["point"],"photos":[{"index":0,"score":0-100,"rating":"Poor|Fair|Good|Excellent","factors":["lighting"],"strengths":["clear face"],"weaknesses":["crop"],"improvementTips":["tip"]}],"bestIndex":0,"bestScore":0}`,
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
    const normalized = normalizeProfileReview(vision, images.length);
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
      result: normalized,
    });
    return {
      reviewId: jobId,
      creditsDeducted: CREDIT_COSTS.profile_review,
      remainingSpendable: consumed.remainingSpendable,
      ...normalized,
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

function clampScore(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function ratingFromScore(score: number): string {
  if (score >= 85) return "Excellent";
  if (score >= 70) return "Good";
  if (score >= 50) return "Fair";
  return "Poor";
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item)).filter(Boolean);
}

function normalizeProfileReview(raw: unknown, photoCount: number) {
  const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const photosIn = Array.isArray(obj.photos) ? obj.photos : [];
  const photos = Array.from({ length: photoCount }, (_, index) => {
    const row = photosIn[index] && typeof photosIn[index] === "object" ? (photosIn[index] as Record<string, unknown>) : {};
    const score = clampScore(row.score) || clampScore(obj.bestScore);
    return {
      index,
      score,
      rating: String(row.rating || ratingFromScore(score)),
      factors: asStringArray(row.factors),
      strengths: asStringArray(row.strengths),
      weaknesses: asStringArray(row.weaknesses),
      improvementTips: asStringArray(row.improvementTips ?? row.tips),
    };
  });
  const rankedBest = photos.reduce((best, photo, i) => (photo.score > (photos[best]?.score ?? 0) ? i : best), 0);
  const bestIndex = Number.isInteger(Number(obj.bestIndex)) && Number(obj.bestIndex) >= 0 && Number(obj.bestIndex) < photoCount
    ? Number(obj.bestIndex)
    : rankedBest;
  const bestScore = photos[bestIndex]?.score ?? 0;
  const improvementTips = asStringArray(obj.improvementTips);
  const extraTips = photos.flatMap((p) => p.improvementTips);
  return {
    photos,
    bestIndex,
    bestScore,
    overallScore: clampScore(obj.overallScore) || bestScore,
    overallLabel: String(obj.overallLabel || ratingFromScore(bestScore)),
    summary: String(obj.summary ?? ""),
    improvementTips: improvementTips.length ? improvementTips : extraTips.slice(0, 6),
    strengths: asStringArray(obj.strengths),
  };
}
