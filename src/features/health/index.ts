import type { FastifyInstance } from "fastify";
import { firestore } from "../../db/connection.js";
import { withTimeout } from "../../lib/async.js";
import { errorEnvelope, errors, ok } from "../../lib/errors.js";
import { STYLE_CATALOG } from "../../lib/prompt-catalog.js";
import type { MemoryQueue } from "../../queue/index.js";

async function pingFirestore(timeoutMs: number): Promise<void> {
  await withTimeout(firestore().collection("users").limit(1).get(), timeoutMs, "firestore ping");
}

export async function registerHealthRoutes(app: FastifyInstance, queue: MemoryQueue) {
  const stats = () => ({
    status: "ok",
    time: new Date().toISOString(),
    queue: queue.stats(),
  });

  app.get("/health", async () => ok(stats()));

  /** Liveness — process is up; use for load balancer / PM2 (no dependency checks). */
  app.get("/health/live", async () => ok({ status: "live", time: new Date().toISOString() }));

  /** Readiness — Firestore reachable; 503 when DB is down so traffic can drain elsewhere. */
  app.get("/health/ready", async (_req, reply) => {
    try {
      await pingFirestore(4_000);
      return ok({ status: "ready", time: new Date().toISOString(), queue: queue.stats() });
    } catch {
      return reply.status(503).send(errorEnvelope(errors.notReady()));
    }
  });

  app.get("/styles", async () => ok(STYLE_CATALOG));
}
