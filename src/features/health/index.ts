import type { FastifyInstance } from "fastify";
import { ok } from "../../lib/errors.js";
import { STYLE_CATALOG } from "../../lib/prompt-catalog.js";
import type { MemoryQueue } from "../../queue/index.js";

export async function registerHealthRoutes(app: FastifyInstance, queue: MemoryQueue) {
  app.get("/health", async () => ok({ status: "ok", time: new Date().toISOString(), queue: queue.stats() }));
  app.get("/styles", async () => ok(STYLE_CATALOG));
}
