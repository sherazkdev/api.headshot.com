const path = require("node:path");

const appDir = process.env.APP_DIR || path.resolve(__dirname, "..");

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
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
