const path = require("node:path");

const appDir = process.env.APP_DIR || path.resolve(__dirname, "..");

module.exports = {
  apps: [
    {
      name: "headshot-api",
      cwd: appDir,
      script: "dist/server.js",
      instances: 1,
      autorestart: true,
      max_memory_restart: "1500M",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
