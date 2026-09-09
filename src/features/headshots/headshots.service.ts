import type { AppConfig } from "../../config/index.js";
import { CREDIT_COSTS } from "../../config/credits.js";
import { errors } from "../../lib/errors.js";
import { GeminiClient, BflClient } from "../../lib/ai-providers.js";
import { LocalStorage } from "../../lib/storage.js";
import { stripGpsExif } from "../../lib/exif.js";
import { promptFromSelections } from "../../lib/prompt-catalog.js";
import { rejectIfDuplicate } from "../../lib/idempotency.js";
import { AiJobModel, UploadModel } from "../../models/index.js";
import { MemoryQueue } from "../../queue/index.js";
import { CreditsService } from "../credits/credits.service.js";
import { pageMeta } from "../../lib/zod.js";

export class HeadshotsService {
  constructor(
    private readonly config: AppConfig,
    private readonly credits: CreditsService,
    private readonly queue: MemoryQueue,
    private readonly storage: LocalStorage,
    private readonly gemini: GeminiClient,
    private readonly bfl: BflClient,
  ) {
    this.queue.register("headshot.generate", (job) => this.process(job.payload as { jobId: string }));
  }

  async upload(uid: string, file: { buffer: Buffer; mimetype: string; filename?: string }, purpose: string) {
    const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!allowed.includes(file.mimetype)) throw errors.validation("Allowed MIME: jpeg, png, webp");
    const max = this.config.MAX_UPLOAD_MB * 1024 * 1024;
    if (file.buffer.length > max) throw errors.validation(`Max file size is ${this.config.MAX_UPLOAD_MB} MB`);
    const cleaned = stripGpsExif(file.buffer, file.mimetype);
    const uploadId = crypto.randomUUID();
    const ext = file.mimetype === "image/png" ? "png" : file.mimetype === "image/webp" ? "webp" : "jpg";
    const stored = await this.storage.saveUpload(uid, uploadId, cleaned, ext);
    const expiresAt = new Date(Date.now() + 24 * 3600_000);
    await UploadModel.create({
      uploadId,
      uid,
      purpose: purpose === "branding" || purpose === "profile_review" ? purpose : "headshot",
      mimeType: file.mimetype === "image/jpg" ? "image/jpeg" : file.mimetype,
      size: cleaned.length,
      path: stored,
      expiresAt,
    });
    return {
      uploadId,
      storageUrl: this.storage.url(stored, this.config),
      expiresAt: expiresAt.toISOString(),
    };
  }

  async generate(
    uid: string,
    input: {
      uploadId: string;
      toolType?: string;
      selections?: Record<string, { id?: string; prompt?: string }>;
      referencePrompts?: Array<{ id?: string; role?: string; visualReferencePrompt?: string }>;
      provider?: "gemini" | "bfl";
      idempotencyKey?: string;
    },
  ) {
    const upload = await UploadModel.findOne({ uploadId: input.uploadId, uid });
    if (!upload) throw errors.notFound("Upload not found");
    if (upload.expiresAt.getTime() <= Date.now()) throw errors.notFound("Upload expired");
    const can = await this.credits.canProceed(uid, CREDIT_COSTS.headshot_generation);
    if (!can.allowed) throw errors.insufficientCredits(CREDIT_COSTS.headshot_generation, can.spendableCredits);
    await rejectIfDuplicate(uid, "headshots.generate", input.idempotencyKey, this.config.IDEMPOTENCY_TTL_HOURS);

    const jobId = crypto.randomUUID();
    const provider = input.provider ?? this.config.HEADSHOT_AI_PROVIDER;
    const model = provider === "bfl" ? this.config.BFL_FLUX_MODEL : this.config.GEMINI_IMAGE_MODEL;
    await AiJobModel.create({
      jobId,
      uid,
      jobType: "headshot_generation",
      provider,
      model,
      status: "queued",
      credits: CREDIT_COSTS.headshot_generation,
      payload: {
        uploadId: input.uploadId,
        toolType: input.toolType ?? "headshot",
        selections: input.selections ?? {},
        referencePrompts: input.referencePrompts ?? [],
      },
    });
    this.queue.enqueue("headshot.generate", { jobId });
    return { jobId, status: "processing" as const };
  }

  async getJob(uid: string, jobId: string, asAdmin = false) {
    const job = await AiJobModel.findOne(asAdmin ? { jobId } : { jobId, uid });
    if (!job) throw errors.notFound("Job not found");
    return {
      jobId: job.jobId,
      status: job.status,
      provider: job.provider,
      model: job.model,
      imageUrl: job.result?.imageUrl ?? null,
      overallScore: job.result?.overallScore ?? null,
      overallLabel: job.result?.overallLabel ?? null,
      metrics: job.result?.metrics ?? null,
      improvementTips: job.result?.improvementTips ?? null,
      creditsDeducted: job.status === "completed" ? job.credits : 0,
      remainingSpendable: job.result?.remainingSpendable ?? null,
      error: job.error ?? null,
    };
  }

  async cancel(uid: string, jobId: string) {
    const job = await AiJobModel.findOne({ jobId, uid });
    if (!job) throw errors.notFound("Job not found");
    if (job.status !== "queued" && job.status !== "processing") {
      throw errors.conflict("Only queued/processing jobs can be cancelled");
    }
    job.status = "cancelled";
    await job.save();
    return { jobId: job.jobId, status: job.status, creditsDeducted: 0 };
  }

  async list(filter: { uid?: string; page: number; perPage: number; status?: string }) {
    const q: Record<string, unknown> = { jobType: "headshot_generation" };
    if (filter.uid) q.uid = filter.uid;
    if (filter.status) q.status = filter.status;
    const [items, total] = await Promise.all([
      AiJobModel.find(q)
        .sort({ createdAt: -1 })
        .skip((filter.page - 1) * filter.perPage)
        .limit(filter.perPage),
      AiJobModel.countDocuments(q),
    ]);
    return { items, meta: pageMeta(filter.page, filter.perPage, total) };
  }

  private async process(payload: { jobId: string }) {
    const job = await AiJobModel.findOne({ jobId: payload.jobId });
    if (!job || job.status === "cancelled" || job.status === "completed") return;
    job.status = "processing";
    await job.save();
    const started = Date.now();
    try {
      const uploadId = String(job.payload.uploadId ?? "");
      const upload = await UploadModel.findOne({ uploadId, uid: job.uid });
      if (!upload) throw errors.notFound("Upload missing");
      const bytes = await this.storage.readBytes(upload.path);
      const b64 = bytes.toString("base64");
      const selections = (job.payload.selections ?? {}) as Record<string, { id?: string; prompt?: string }>;
      const referencePrompts = (job.payload.referencePrompts ?? []) as Array<{
        id?: string;
        visualReferencePrompt?: string;
      }>;
      const prompt = promptFromSelections(selections, referencePrompts);
      let imageB64: string;
      if (job.provider === "bfl") imageB64 = await this.bfl.generate(prompt, b64);
      else imageB64 = await this.gemini.generateImage(prompt, b64, upload.mimeType);
      const out = await this.storage.saveGenerated(job.uid, job.jobId, Buffer.from(imageB64, "base64"));
      const consumed = await this.credits.consume(
        job.uid,
        CREDIT_COSTS.headshot_generation,
        "headshot_generation",
        job.jobId,
        `job:${job.jobId}`,
        { reuseIdempotency: true },
      );
      job.status = "completed";
      job.fromPassCredits = consumed.fromPassCredits;
      job.fromBonusCredits = consumed.fromBonusCredits;
      job.result = {
        imageUrl: this.storage.url(out, this.config),
        remainingSpendable: consumed.remainingSpendable,
      };
      job.durationMs = Date.now() - started;
      await job.save();
    } catch (err) {
      const latest = await AiJobModel.findOne({ jobId: payload.jobId });
      if (latest?.status === "cancelled") return;
      job.status = "failed";
      job.error = err instanceof Error ? err.message : "generate failed";
      job.durationMs = Date.now() - started;
      await job.save();
    }
  }
}
