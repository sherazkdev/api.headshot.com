import type { FastifyRequest } from "fastify";
import { z } from "zod";
import { parseBody, paginationQuery } from "../../lib/zod.js";
import { ok } from "../../lib/errors.js";
import { AuthValidator } from "../../plugins/auth-validator.js";
import { ApiKeysService } from "./api-keys.service.js";

const createSchema = z.object({
  name: z.string().min(2).max(80),
  role: z.enum(["admin", "read_only", "developer"]).default("developer"),
  env: z.enum(["live", "test"]).default("live"),
});

export class ApiKeysController {
  constructor(
    private readonly service: ApiKeysService,
    private readonly auth: AuthValidator,
  ) {}

  list = async (req: FastifyRequest) => {
    this.auth.requireAdmin(req);
    const query = paginationQuery.parse(req.query);
    const status = (req.query as { status?: string }).status;
    return ok(await this.service.list(query.page, query.per_page, status));
  };

  stats = async (req: FastifyRequest) => {
    this.auth.requireAdmin(req);
    return ok(await this.service.stats());
  };

  create = async (req: FastifyRequest) => {
    this.auth.requireWriteAdmin(req);
    const body = parseBody(createSchema, req.body);
    const owner = this.owner(req);
    return ok(
      await this.service.generate({
        name: body.name,
        role: body.role ?? "developer",
        env: body.env ?? "live",
        ...owner,
      }),
    );
  };

  rotate = async (req: FastifyRequest) => {
    this.auth.requireWriteAdmin(req);
    const id = (req.params as { id: string }).id;
    return ok(await this.service.rotate(id, { email: this.owner(req).ownerEmail, name: this.owner(req).ownerName }));
  };

  revoke = async (req: FastifyRequest) => {
    this.auth.requireWriteAdmin(req);
    const id = (req.params as { id: string }).id;
    return ok(await this.service.revoke(id));
  };

  private owner(req: FastifyRequest) {
    const auth = req.auth;
    if (auth?.kind === "admin") return { ownerEmail: auth.email, ownerName: "Admin User" };
    if (auth?.kind === "api_key") return { ownerEmail: auth.ownerEmail, ownerName: "API Key" };
    return { ownerEmail: "admin@headshotai.com", ownerName: "Admin User" };
  }
}
