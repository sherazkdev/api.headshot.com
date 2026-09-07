import bcrypt from "bcryptjs";
import type { FastifyInstance } from "fastify";
import type { AppConfig } from "../../config/index.js";
import { errors } from "../../lib/errors.js";

export class AdminAuthService {
  constructor(
    private readonly config: AppConfig,
    private readonly app: FastifyInstance,
  ) {}

  async login(email: string, password: string): Promise<{ token: string; email: string }> {
    if (email.toLowerCase() !== this.config.ADMIN_EMAIL.toLowerCase()) {
      throw errors.unauthorized("Invalid admin credentials");
    }
    const ok =
      password === this.config.ADMIN_PASSWORD ||
      (this.config.ADMIN_PASSWORD.startsWith("$2") && (await bcrypt.compare(password, this.config.ADMIN_PASSWORD)));
    if (!ok) throw errors.unauthorized("Invalid admin credentials");
    const token = this.app.jwt.sign(
      { sub: email, email, kind: "admin" },
      { expiresIn: "12h" },
    );
    return { token, email };
  }
}
