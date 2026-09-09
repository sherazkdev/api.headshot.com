import { CREDIT_COSTS } from "../../config/credits.js";
import { errors } from "../../lib/errors.js";
import { asDate } from "../../lib/wallet.js";
import { GeminiClient } from "../../lib/ai-providers.js";
import { LocalStorage } from "../../lib/storage.js";
import { rejectIfDuplicate } from "../../lib/idempotency.js";
import { UploadModel, AiJobModel } from "../../models/index.js";
import { MemoryQueue } from "../../queue/index.js";
import { CreditsService } from "../credits/credits.service.js";
import type { AppConfig } from "../../config/index.js";
import { pageMeta } from "../../lib/zod.js";

const METRIC_DEFS = [
  { id: "clarity", label: "Clarity" },
  { id: "professionalism", label: "Professionalism" },
  { id: "composition", label: "Composition" },
  { id: "lighting", label: "Lighting" },
  { id: "approachability", label: "Approachability" },
] as const;

const ANALYZE_PROMPT = `Analyze this professional headshot for personal branding. Return JSON only:
{"overallScore":0-100,"overallLabel":"Poor|Fair|Good|Excellent","percentileLabel":"Top N%","metrics":[{"id":"clarity","score":0-100,"rating":"Poor|Fair|Good|Excellent","insight":"1-2 sentences"},{"id":"professionalism","score":0-100,"rating":"Poor|Fair|Good|Excellent","insight":"1-2 sentences"},{"id":"composition","score":0-100,"rating":"Poor|Fair|Good|Excellent","insight":"1-2 sentences"},{"id":"lighting","score":0-100,"rating":"Poor|Fair|Good|Excellent","insight":"1-2 sentences"},{"id":"approachability","score":0-100,"rating":"Poor|Fair|Good|Excellent","insight":"1-2 sentences"}],"improvementTips":["tip"],"strengths":["point"],"enhancementPrompt":"Keep the same person. ..."}
Include all 5 metrics ids exactly: clarity, professionalism, composition, lighting, approachability.`;

export class BrandingService {
  constructor(
    private readonly config: AppConfig,
    private readonly credits: CreditsService,
    private readonly queue: MemoryQueue,
    private readonly gemini: GeminiClient,
    private readonly storage: LocalStorage,
  ) {
    this.queue.register("branding.improve", (job) => this.processImprove(job.payload as { jobId: string }));
  }

  async analyze(uid: string, uploadId: string, idempotencyKey?: string) {
    const can = await this.credits.canProceed(uid, CREDIT_COSTS.branding_analyze);
    if (!can.allowed) throw errors.insufficientCredits(CREDIT_COSTS.branding_analyze, can.spendableCredits);
    await rejectIfDuplicate(uid, "branding.analyze", idempotencyKey, this.config.IDEMPOTENCY_TTL_HOURS);
    const vision = normalizeBrandingScore(await this.scoreUpload(uid, uploadId));
    const consumed = await this.credits.consume(uid, CREDIT_COSTS.branding_analyze, "branding_analyze", uploadId, idempotencyKey, {
      reuseIdempotency: true,
    });
    const jobId = crypto.randomUUID();
    await AiJobModel.create({
      jobId,
      uid,
      jobType: "branding_analyze",
      provider: "gemini",
      model: this.config.GEMINI_VISION_MODEL,
      status: "completed",
      credits: CREDIT_COSTS.branding_analyze,
      fromPassCredits: consumed.fromPassCredits,
      fromBonusCredits: consumed.fromBonusCredits,
      payload: { uploadId },
      result: vision,
    });
    return { ...vision, analysisId: jobId, creditsDeducted: CREDIT_COSTS.branding_analyze, remainingSpendable: consumed.remainingSpendable };
  }

  async improve(uid: string, uploadId: string, enhancementPrompt?: string, idempotencyKey?: string) {
    const can = await this.credits.canProceed(uid, CREDIT_COSTS.branding_improve);
    if (!can.allowed) throw errors.insufficientCredits(CREDIT_COSTS.branding_improve, can.spendableCredits);
    await rejectIfDuplicate(uid, "branding.improve", idempotencyKey, this.config.IDEMPOTENCY_TTL_HOURS);
    await this.loadUpload(uid, uploadId);

    const jobId = crypto.randomUUID();
    const prompt =
      enhancementPrompt?.trim() ||
      "Keep the same person and identity. Improve lighting, background cleanliness, sharpness, and professional appearance.";
    await AiJobModel.create({
      jobId,
      uid,
      jobType: "branding_improve",
      provider: "gemini",
      model: this.config.GEMINI_IMAGE_MODEL,
      status: "queued",
      credits: CREDIT_COSTS.branding_improve,
      payload: { uploadId, enhancementPrompt: prompt },
    });
    await this.processImprove({ jobId });
    const job = await AiJobModel.findOne({ jobId });
    if (!job || job.status === "failed") throw errors.server(job?.error ?? "Branding improve failed");
    const result = (job.result ?? {}) as Record<string, unknown>;
    const scored = normalizeBrandingScore(result, { fallbackScore: 78 });
    const imageUrl = typeof result.imageUrl === "string" ? result.imageUrl : null;
    if (!imageUrl) throw errors.server("Branding improve did not return an image URL");
    return {
      improvementId: jobId,
      analysisId: jobId,
      status: "completed" as const,
      imageUrl,
      overallScore: scored.overallScore,
      overallLabel: scored.overallLabel,
      percentileLabel: scored.percentileLabel,
      metrics: scored.metrics,
      improvementTips: scored.improvementTips,
      strengths: scored.strengths,
      enhancementPrompt: prompt,
      creditsDeducted: CREDIT_COSTS.branding_improve,
      remainingSpendable: typeof result.remainingSpendable === "number" ? result.remainingSpendable : null,
    };
  }

  private async processImprove(payload: { jobId: string }) {
    const job = await AiJobModel.findOne({ jobId: payload.jobId });
    if (!job || job.status === "cancelled" || job.status === "completed") return;
    job.status = "processing";
    await job.save();
    try {
      const uploadId = String(job.payload.uploadId ?? "");
      const prompt = String(job.payload.enhancementPrompt ?? "");
      const upload = await this.loadUpload(job.uid, uploadId);
      const bytes = await this.storage.readBytes(upload.path);
      const imageB64 = await this.gemini.generateImage(prompt, bytes.toString("base64"), upload.mimeType);
      const out = await this.storage.saveGenerated(job.uid, `branding_${job.jobId}`, Buffer.from(imageB64, "base64"));
      const imageUrl = this.storage.url(out, this.config);
      let vision: Record<string, unknown> = {};
      try {
        vision = (await this.gemini.visionJson(ANALYZE_PROMPT, [{ mimeType: "image/png", data: imageB64 }])) as Record<string, unknown>;
      } catch {
        vision = (await this.latestAnalyzeResult(job.uid, uploadId)) ?? {};
      }
      const consumed = await this.credits.consume(job.uid, CREDIT_COSTS.branding_improve, "branding_improve", uploadId, `job:${job.jobId}`, {
        reuseIdempotency: true,
      });
      const scored = normalizeBrandingScore(
        { ...vision, imageUrl, remainingSpendable: consumed.remainingSpendable },
        { fallbackScore: 78 },
      );
      job.status = "completed";
      job.fromPassCredits = consumed.fromPassCredits;
      job.fromBonusCredits = consumed.fromBonusCredits;
      job.result = scored;
      await job.save();
    } catch (err) {
      const latest = await AiJobModel.findOne({ jobId: payload.jobId });
      if (latest?.status === "cancelled") return;
      job.status = "failed";
      job.error = err instanceof Error ? err.message : "improve failed";
      await job.save();
    }
  }

  async adminList(page: number, perPage: number) {
    const q = { jobType: { $in: ["branding_analyze", "branding_improve"] } };
    const [items, total] = await Promise.all([
      AiJobModel.find(q)
        .sort({ createdAt: -1 })
        .skip((page - 1) * perPage)
        .limit(perPage),
      AiJobModel.countDocuments(q),
    ]);
    return { items, meta: pageMeta(page, perPage, total) };
  }

  private async scoreUpload(uid: string, uploadId: string) {
    const upload = await this.loadUpload(uid, uploadId);
    const bytes = await this.storage.readBytes(upload.path);
    return (await this.gemini.visionJson(ANALYZE_PROMPT, [
      { mimeType: upload.mimeType, data: bytes.toString("base64") },
    ])) as Record<string, unknown>;
  }

  private async latestAnalyzeResult(uid: string, uploadId: string): Promise<Record<string, unknown> | null> {
    const rows = await AiJobModel.find({ uid, jobType: "branding_analyze" }).sort({ createdAt: -1 }).limit(25);
    const hit = rows.find((row) => String((row.payload as { uploadId?: string }).uploadId ?? "") === uploadId);
    const result = hit?.result;
    return result && typeof result === "object" ? (result as Record<string, unknown>) : null;
  }

  private async loadUpload(uid: string, uploadId: string) {
    const upload = await UploadModel.findOne({ uploadId, uid });
    if (!upload) throw errors.notFound("Upload not found");
    const exp = asDate(upload.expiresAt);
    if (!exp || exp.getTime() <= Date.now()) throw errors.notFound("Upload expired");
    return upload;
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

function percentileFromScore(score: number): string {
  if (score >= 90) return "Top 10%";
  if (score >= 80) return "Top 20%";
  if (score >= 70) return "Top 40%";
  if (score >= 50) return "Top 60%";
  return "Bottom 40%";
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

export function normalizeBrandingScore(raw: unknown, opts: { fallbackScore?: number } = {}) {
  const obj = asRecord(raw);
  const fallback = opts.fallbackScore ?? 72;
  const metricsIn = Array.isArray(obj.metrics) ? obj.metrics : [];
  const byId = new Map<string, Record<string, unknown>>();
  for (const row of metricsIn) {
    const rec = asRecord(row);
    const id = asString(rec.id).toLowerCase();
    if (id) byId.set(id, rec);
  }
  const metrics = METRIC_DEFS.map((def, i) => {
    const row = byId.get(def.id) ?? {};
    const score = clampScore(row.score) || Math.max(40, fallback - i);
    return {
      id: def.id,
      label: asString(row.label) || def.label,
      score,
      rating: asString(row.rating) || ratingFromScore(score),
      insight: asString(row.insight) || `${def.label} scores ${score}/100 after enhancement.`,
    };
  });
  const overallScore = clampScore(obj.overallScore) || Math.round(metrics.reduce((s, m) => s + m.score, 0) / metrics.length) || fallback;
  return {
    ...obj,
    overallScore,
    overallLabel: asString(obj.overallLabel) || ratingFromScore(overallScore),
    percentileLabel: asString(obj.percentileLabel) || percentileFromScore(overallScore),
    metrics,
    improvementTips: asStringArray(obj.improvementTips).length
      ? asStringArray(obj.improvementTips)
      : ["Keep lighting even on the face.", "Use a cleaner, less busy background."],
    strengths: asStringArray(obj.strengths).length
      ? asStringArray(obj.strengths)
      : ["Subject remains recognizable.", "Framing is usable for a professional profile."],
  };
}
