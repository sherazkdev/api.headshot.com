import cluster from "node:cluster";
import os from "node:os";
import { loadConfig } from "./config/index.js";
import { connectDb } from "./db/index.js";
import { buildApp } from "./app.js";

async function boot() {
  const config = loadConfig();
  await connectDb(config);
  const app = await buildApp(config);
  await app.listen({ port: config.PORT, host: "0.0.0.0" });
  app.log.info(`Headshot API listening on :${config.PORT}${config.API_BASE_PATH}`);
}

function main() {
  const config = loadConfig();
  const workers = config.CLUSTER_WORKERS || 0;
  if (workers > 0 && cluster.isPrimary) {
    const count = workers === 0 ? os.cpus().length : workers;
    for (let i = 0; i < count; i += 1) cluster.fork();
    cluster.on("exit", () => cluster.fork());
    return;
  }
  void boot();
}

main();
