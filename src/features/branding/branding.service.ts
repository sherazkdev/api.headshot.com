import fs from "node:fs/promises";
import { CREDIT_COSTS } from "../../config/credits.js";
import { errors } from "../../lib/errors.js";
import { GeminiClient } from "../../lib/ai-providers.js";
import { LocalStorage } from "../../lib/storage.js";
import { rejectIfDuplicate } from "../../lib/idempotency.js";
import { UploadModel, AiJobModel } from "../../models/index.js";
import { MemoryQueue } from "../../queue/index.js";
import { CreditsService } from "../credits/credits.service.js";
import type { AppConfig } from "../../config/index.js";
import { pageMeta } from "../../lib/zod.js";

const ANALYZE_PROMPT = `Analyze this professional headshot for personal branding. Return JSON only:
{"overallScore":0-100,"overallLabel":"Poor|Fair|Good|Excellent","percentileLabel":"Top N%","metrics":[{"id":"clarity|professionalism|composition|lighting|approachability","score":0-100,"rating":"","insight":""}],"improvementTips":[],"strengths":[],"enhancementPrompt":""}`;

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
    const vision = await this.scoreUpload(uid, uploadId);
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
    this.queue.enqueue("branding.improve", { jobId });
    return { improvementId: jobId, status: "processing" as const, creditsDeducted: 0, enhancementPrompt: prompt };
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
      const bytes = await fs.readFile(upload.path);
      const imageB64 = await this.gemini.generateImage(prompt, bytes.toString("base64"), upload.mimeType);
      const out = await this.storage.saveGenerated(job.uid, `branding_${job.jobId}`, Buffer.from(imageB64, "base64"));
      const imageUrl = this.storage.url(out, this.config);
      const vision = (await this.gemini.visionJson(ANALYZE_PROMPT, [{ mimeType: "image/png", data: imageB64 }])) as Record<string, unknown>;
      const consumed = await this.credits.consume(job.uid, CREDIT_COSTS.branding_improve, "branding_improve", uploadId, `job:${job.jobId}`, {
        reuseIdempotency: true,
      });
      job.status = "completed";
      job.fromPassCredits = consumed.fromPassCredits;
      job.fromBonusCredits = consumed.fromBonusCredits;
      job.result = { ...vision, imageUrl, remainingSpendable: consumed.remainingSpendable };
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
    const bytes = await fs.readFile(upload.path);
    return (await this.gemini.visionJson(ANALYZE_PROMPT, [
      { mimeType: upload.mimeType, data: bytes.toString("base64") },
    ])) as Record<string, unknown>;
  }

  private async loadUpload(uid: string, uploadId: string) {
    const upload = await UploadModel.findOne({ uploadId, uid });
    if (!upload) throw errors.notFound("Upload not found");
    if (upload.expiresAt.getTime() <= Date.now()) throw errors.notFound("Upload expired");
    return upload;
  }
}
