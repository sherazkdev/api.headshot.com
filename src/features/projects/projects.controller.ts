import type { FastifyRequest } from "fastify";
import { z } from "zod";
import { parseBody, paginationQuery } from "../../lib/zod.js";
import { ok } from "../../lib/errors.js";
import { AuthValidator } from "../../plugins/auth-validator.js";
import { ProjectsService } from "./projects.service.js";

const createSchema = z.object({
  name: z.string().min(1),
  toolType: z.string().min(1),
  styleId: z.string().optional(),
  outfitId: z.string().optional(),
  backgroundId: z.string().optional(),
  poseId: z.string().optional(),
  gender: z.string().optional(),
  purpose: z.string().optional(),
  sourcePhotoUrl: z.string().optional(),
  resultImageUrl: z.string().optional(),
  brandingScore: z.number().optional(),
  brandingStrengths: z.array(z.string()).optional(),
  profileReviewData: z.record(z.unknown()).optional(),
  isFavorite: z.boolean().optional(),
});

export class ProjectsController {
  constructor(
    private readonly service: ProjectsService,
    private readonly auth: AuthValidator,
  ) {}

  list = async (req: FastifyRequest) => {
    const { uid } = this.auth.requireUser(req);
    const query = paginationQuery.parse(req.query);
    return ok(await this.service.list(uid, query.page, query.per_page));
  };

  get = async (req: FastifyRequest) => {
    const { uid } = this.auth.requireUser(req);
    return ok(await this.service.get(uid, (req.params as { id: string }).id));
  };

  create = async (req: FastifyRequest) => {
    const { uid } = this.auth.requireUser(req);
    const body = parseBody(createSchema, req.body);
    return ok(await this.service.create(uid, body));
  };

  patch = async (req: FastifyRequest) => {
    const { uid } = this.auth.requireUser(req);
    const body = parseBody(z.object({ name: z.string().optional(), isFavorite: z.boolean().optional() }), req.body);
    return ok(await this.service.patch(uid, (req.params as { id: string }).id, body));
  };

  remove = async (req: FastifyRequest) => {
    const { uid } = this.auth.requireUser(req);
    return ok(await this.service.remove(uid, (req.params as { id: string }).id));
  };

  adminList = async (req: FastifyRequest) => {
    this.auth.requireAdmin(req);
    const query = paginationQuery.parse(req.query);
    return ok(await this.service.list(undefined, query.page, query.per_page));
  };
}
