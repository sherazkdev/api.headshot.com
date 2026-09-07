const fs = require("node:fs");
const path = require("node:path");

const appDir = process.env.APP_DIR || path.resolve(__dirname, "..");

function loadEnvFile(envPath) {
  const env = { NODE_ENV: "production" };
  if (!fs.existsSync(envPath)) return env;
  for (const raw of fs.readFileSync(envPath, "utf8").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

const envFromFile = loadEnvFile(path.join(appDir, ".env"));

module.exports = {
  apps: [
    {
      name: "headshot-api",
      cwd: appDir,
      script: "dist/server.js",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "1500M",
      time: true,
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      error_file: path.join(appDir, "logs/pm2-error.log"),
      out_file: path.join(appDir, "logs/pm2-out.log"),
      merge_logs: true,
      env: envFromFile,
    },
  ],
};
