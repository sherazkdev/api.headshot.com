import { CREDIT_COSTS } from "../../config/credits.js";
import { errors } from "../../lib/errors.js";
import { asDate } from "../../lib/wallet.js";
import { GeminiClient } from "../../lib/ai-providers.js";
import { LocalStorage } from "../../lib/storage.js";
import { rejectIfDuplicate } from "../../lib/idempotency.js";
import { UploadModel, AiJobModel } from "../../models/index.js";
import { CreditsService } from "../credits/credits.service.js";
import type { AppConfig } from "../../config/index.js";
import { pageMeta } from "../../lib/zod.js";

const METRIC_DEFS = [
  { id: "lighting", label: "Lighting" },
  { id: "composition", label: "Composition & framing" },
  { id: "background", label: "Background" },
  { id: "clothing", label: "Clothing & grooming" },
  { id: "expression", label: "Expression & eye contact" },
  { id: "sharpness", label: "Sharpness & image quality" },
  { id: "color", label: "Color & skin tone" },
  { id: "professionalism", label: "Professionalism" },
] as const;

const USE_CASES = ["linkedin", "resume", "company", "social"] as const;

function analyzePrompt(photoCount: number): string {
  return `You are a professional headshot and personal-branding reviewer. Compare these ${photoCount} photos of the same person for LinkedIn, resume, company website, and professional social use.

Return JSON only. Be specific and detailed — cite what you actually see (light direction, crop, wardrobe, expression, color cast, background clutter). Do not write one-word answers. Each insight must be 1-2 full sentences. Summary must be 3-5 sentences. Each photo needs its own 2-4 sentence analysis.

Required JSON shape:
{
  "overallScore": 0-100,
  "overallLabel": "Poor|Fair|Good|Excellent",
  "summary": "3-5 sentence overall analysis covering which photo wins, why, and what to fix",
  "comparison": "2-4 sentences comparing the photos against each other",
  "recommendation": "1-2 sentences: which photo to use as the primary professional headshot and why",
  "bestPhotoReason": "2-3 sentences explaining why bestIndex is the strongest photo",
  "strengths": ["detailed overall strength", "another"],
  "weaknesses": ["detailed overall weakness", "another"],
  "improvementTips": ["actionable tip with enough detail to follow", "another"],
  "metrics": [
    {"id":"lighting","label":"Lighting","score":0-100,"rating":"Poor|Fair|Good|Excellent","insight":"1-2 sentences"}
  ],
  "useCases": {
    "linkedin": {"photoIndex":0,"reason":"1-2 sentences"},
    "resume": {"photoIndex":0,"reason":"1-2 sentences"},
    "company": {"photoIndex":0,"reason":"1-2 sentences"},
    "social": {"photoIndex":0,"reason":"1-2 sentences"}
  },
  "photos": [
    {
      "index": 0,
      "score": 0-100,
      "rating": "Poor|Fair|Good|Excellent",
      "verdict": "short headline e.g. Best professional option",
      "summary": "2-4 sentence detailed analysis of this photo",
      "factors": ["lighting","composition"],
      "strengths": ["detailed strength", "another"],
      "weaknesses": ["detailed weakness", "another"],
      "improvementTips": ["specific actionable tip", "another"],
      "recommendedFor": ["linkedin","resume"],
      "metrics": [
        {"id":"lighting","label":"Lighting","score":0-100,"rating":"Poor|Fair|Good|Excellent","insight":"1-2 sentences"}
      ]
    }
  ],
  "bestIndex": 0,
  "bestScore": 0
}

metrics id values MUST be exactly: lighting, composition, background, clothing, expression, sharpness, color, professionalism. Include all 8 for overall metrics AND for every photo.`;
}

export class ProfileReviewService {
  constructor(
    private readonly config: AppConfig,
    private readonly credits: CreditsService,
    private readonly gemini: GeminiClient,
    private readonly storage: LocalStorage,
  ) {}

  async analyze(uid: string, uploadIds: string[], idempotencyKey?: string) {
    if (uploadIds.length < 2) throw errors.validation("Minimum 2 photos required");
    const can = await this.credits.canProceed(uid, CREDIT_COSTS.profile_review);
    if (!can.allowed) throw errors.insufficientCredits(CREDIT_COSTS.profile_review, can.spendableCredits);
    await rejectIfDuplicate(uid, "profile-review.analyze", idempotencyKey, this.config.IDEMPOTENCY_TTL_HOURS);
    const uploads = await UploadModel.find({ uid, uploadId: { $in: uploadIds } });
    if (uploads.length !== uploadIds.length) throw errors.notFound("Upload not found");
    const byId = new Map(uploads.map((u) => [u.uploadId, u]));
    const ordered = uploadIds.map((id) => {
      const upload = byId.get(id);
      if (!upload) throw errors.notFound("Upload not found");
      return upload;
    });
    if (ordered.some((u) => {
      const exp = asDate(u.expiresAt);
      return !exp || exp.getTime() <= Date.now();
    })) throw errors.notFound("Upload expired");
    const images = await Promise.all(
      ordered.map(async (u) => ({
        mimeType: u.mimeType,
        data: (await this.storage.readBytes(u.path)).toString("base64"),
      })),
    );
    const vision = await this.gemini.visionJson(analyzePrompt(images.length), images);
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

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter(Boolean);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function normalizeMetrics(raw: unknown, fallbackScore: number): Array<{
  id: string;
  label: string;
  score: number;
  rating: string;
  insight: string;
}> {
  const rows = Array.isArray(raw) ? raw : [];
  const byId = new Map<string, Record<string, unknown>>();
  for (const row of rows) {
    const obj = asRecord(row);
    const id = asString(obj.id).toLowerCase();
    if (id) byId.set(id, obj);
  }
  return METRIC_DEFS.map((def, i) => {
    const row = byId.get(def.id) ?? {};
    const score = clampScore(row.score) || Math.max(40, fallbackScore - i * 2);
    return {
      id: def.id,
      label: asString(row.label) || def.label,
      score,
      rating: asString(row.rating) || ratingFromScore(score),
      insight: asString(row.insight) || asString(row.analysis) || `${def.label} scores ${score}/100 for this set.`,
    };
  });
}

function normalizeUseCases(raw: unknown, bestIndex: number, photoCount: number) {
  const obj = asRecord(raw);
  const out: Record<string, { photoIndex: number; reason: string }> = {};
  for (const key of USE_CASES) {
    const row = asRecord(obj[key]);
    const idx = Number.isInteger(Number(row.photoIndex)) ? Number(row.photoIndex) : bestIndex;
    out[key] = {
      photoIndex: idx >= 0 && idx < photoCount ? idx : bestIndex,
      reason: asString(row.reason) || `Photo ${bestIndex + 1} is the strongest professional option.`,
    };
  }
  return out;
}

function normalizeProfileReview(raw: unknown, photoCount: number) {
  const obj = asRecord(raw);
  const photosIn = Array.isArray(obj.photos) ? obj.photos : [];
  const photos = Array.from({ length: photoCount }, (_, index) => {
    const row = asRecord(photosIn[index]);
    const score = clampScore(row.score) || clampScore(obj.bestScore);
    const strengths = asStringArray(row.strengths);
    const weaknesses = asStringArray(row.weaknesses);
    const improvementTips = asStringArray(row.improvementTips ?? row.tips);
    const summary =
      asString(row.summary) ||
      asString(row.analysis) ||
      [strengths[0], weaknesses[0]].filter(Boolean).join(" ") ||
      `Photo ${index + 1} scores ${score}/100.`;
    return {
      index,
      score,
      rating: asString(row.rating) || ratingFromScore(score),
      verdict: asString(row.verdict) || ratingFromScore(score),
      summary,
      factors: asStringArray(row.factors),
      strengths,
      weaknesses,
      improvementTips,
      recommendedFor: asStringArray(row.recommendedFor),
      metrics: normalizeMetrics(row.metrics, score),
    };
  });
  const rankedBest = photos.reduce((best, photo, i) => (photo.score > (photos[best]?.score ?? 0) ? i : best), 0);
  const bestIndex = Number.isInteger(Number(obj.bestIndex)) && Number(obj.bestIndex) >= 0 && Number(obj.bestIndex) < photoCount
    ? Number(obj.bestIndex)
    : rankedBest;
  const bestScore = photos[bestIndex]?.score ?? 0;
  const overallScore = clampScore(obj.overallScore) || bestScore;
  const improvementTips = asStringArray(obj.improvementTips);
  const extraTips = photos.flatMap((p) => p.improvementTips);
  const strengths = asStringArray(obj.strengths);
  const weaknesses = asStringArray(obj.weaknesses);
  const summary =
    asString(obj.summary) ||
    `Photo ${bestIndex + 1} is the strongest option at ${bestScore}/100. ${photos.map((p) => p.summary).filter(Boolean).join(" ")}`.trim();
  return {
    photos,
    bestIndex,
    bestScore,
    overallScore,
    overallLabel: asString(obj.overallLabel) || ratingFromScore(overallScore),
    summary,
    comparison: asString(obj.comparison) || `Photo ${bestIndex + 1} outperforms the others on professional presentation.`,
    recommendation: asString(obj.recommendation) || `Use photo ${bestIndex + 1} as the primary professional headshot.`,
    bestPhotoReason: asString(obj.bestPhotoReason) || photos[bestIndex]?.summary || `Photo ${bestIndex + 1} has the highest score.`,
    improvementTips: improvementTips.length ? improvementTips : extraTips.slice(0, 8),
    strengths: strengths.length ? strengths : photos.flatMap((p) => p.strengths).slice(0, 8),
    weaknesses: weaknesses.length ? weaknesses : photos.flatMap((p) => p.weaknesses).slice(0, 8),
    metrics: normalizeMetrics(obj.metrics, overallScore),
    useCases: normalizeUseCases(obj.useCases, bestIndex, photoCount),
  };
}
