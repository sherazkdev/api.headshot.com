import type { FastifyInstance } from "fastify";

export function bindGracefulShutdown(app: FastifyInstance): void {
  let closing = false;
  const shutdown = async (signal: string) => {
    if (closing) return;
    closing = true;
    app.log.warn({ signal }, "graceful shutdown");
    try {
      await app.close();
    } catch (err) {
      app.log.error({ err }, "error during shutdown");
    }
    process.exit(0);
  };
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

export function bindProcessDiagnostics(log: Pick<FastifyInstance["log"], "error" | "fatal">): void {
  process.on("unhandledRejection", (reason) => {
    log.error({ reason }, "unhandled promise rejection");
  });
  process.on("uncaughtException", (err) => {
    log.fatal({ err }, "uncaught exception — exiting");
    process.exit(1);
  });
}
