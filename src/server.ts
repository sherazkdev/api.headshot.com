import cluster from "node:cluster";
import os from "node:os";
import { loadConfig } from "./config/index.js";
import { connectDbWithRetry } from "./db/connect-retry.js";
import { buildApp } from "./app.js";
import { bindGracefulShutdown, bindProcessDiagnostics } from "./lib/runtime-guard.js";

async function boot() {
  const config = loadConfig();
  await connectDbWithRetry(config);
  const app = await buildApp(config);
  bindProcessDiagnostics(app.log);
  bindGracefulShutdown(app);
  await app.listen({ port: config.PORT, host: config.BIND_HOST });
  const publicUrl = config.PUBLIC_BASE_URL || `http://127.0.0.1:${config.PORT}`;
  app.log.info(
    `Headshot API on ${config.BIND_HOST}:${config.PORT}${config.API_BASE_PATH} | public ${publicUrl}`,
  );
}

function main() {
  const config = loadConfig();
  const workers = config.CLUSTER_WORKERS || 0;
  if (workers > 0 && cluster.isPrimary) {
    const count = workers;
    for (let i = 0; i < count; i += 1) cluster.fork();
    cluster.on("exit", (worker, code) => {
      console.error(`[cluster] worker ${worker.process.pid} exited (${code}) — restarting`);
      cluster.fork();
    });
    return;
  }
  void boot().catch((err) => {
    console.error("[boot] failed", err);
    setTimeout(() => process.exit(1), 500);
  });
}

main();
