import type { FastifyRequest } from "fastify";
import { z } from "zod";
import { parseBody, paginationQuery } from "../../lib/zod.js";
import { errors, ok } from "../../lib/errors.js";
import { rateGuard } from "../../lib/rate-guard.js";
import { AuthValidator } from "../../plugins/auth-validator.js";
import { HeadshotsService } from "./headshots.service.js";

const generateSchema = z.object({
  uploadId: z.string().min(1),
  toolType: z.string().default("headshot"),
  provider: z.enum(["gemini", "bfl"]).optional(),
  selections: z.record(z.object({ id: z.string(), prompt: z.string().optional() })).optional(),
  referencePrompts: z
    .array(
      z.object({
        id: z.string().optional(),
        role: z.string().optional(),
        visualReferencePrompt: z.string().optional(),
      }),
    )
    .optional(),
});

export class HeadshotsController {
  constructor(
    private readonly service: HeadshotsService,
    private readonly auth: AuthValidator,
  ) {}

  upload = async (req: FastifyRequest) => {
    const { uid } = this.auth.requireUser(req);
    const file = await req.file();
    if (!file) throw errors.badRequest("photo is required");
    const buffer = await file.toBuffer();
    const purpose = String((file.fields.purpose as { value?: string } | undefined)?.value ?? "headshot");
    return ok(await this.service.upload(uid, { buffer, mimetype: file.mimetype, filename: file.filename }, purpose));
  };

  generate = async (req: FastifyRequest) => {
    const { uid } = this.auth.requireUser(req);
    rateGuard.hit("headshots.generate", uid, 10, 3600_000);
    const body = parseBody(generateSchema, req.body);
    const key = req.headers["idempotency-key"];
    return ok(
      await this.service.generate(uid, {
        ...body,
        idempotencyKey: Array.isArray(key) ? key[0] : key,
      }),
    );
  };

  job = async (req: FastifyRequest) => {
    const { uid } = this.auth.requireUser(req);
    const jobId = (req.params as { jobId: string }).jobId;
    return ok(await this.service.getJob(uid, jobId));
  };

  cancel = async (req: FastifyRequest) => {
    const { uid } = this.auth.requireUser(req);
    const jobId = (req.params as { jobId: string }).jobId;
    return ok(await this.service.cancel(uid, jobId));
  };

  results = async (req: FastifyRequest) => {
    const { uid } = this.auth.requireUser(req);
    const query = paginationQuery.parse(req.query);
    return ok(await this.service.list({ uid, page: query.page, perPage: query.per_page }));
  };

  adminList = async (req: FastifyRequest) => {
    this.auth.requireAdmin(req);
    const query = paginationQuery.parse(req.query);
    const status = (req.query as { status?: string }).status;
    return ok(await this.service.list({ page: query.page, perPage: query.per_page, status }));
  };

  adminJob = async (req: FastifyRequest) => {
    this.auth.requireAdmin(req);
    const jobId = (req.params as { jobId: string }).jobId;
    return ok(await this.service.getJob("admin", jobId, true));
  };
}
