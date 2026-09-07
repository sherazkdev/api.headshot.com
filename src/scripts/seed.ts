import { loadConfig } from "../config/index.js";
import { connectDb, disconnectDb } from "../db/index.js";
import { RemoteConfigService } from "../features/remote-config/index.js";
import { ApiKeysService } from "../features/api-keys/index.js";
import { MemoryCache } from "../cache/index.js";

async function seed() {
  const config = loadConfig();
  await connectDb(config);
  await new RemoteConfigService().ensure();
  const keys = new ApiKeysService(new MemoryCache());
  const created = await keys.generate({
    name: "Production Mobile App",
    role: "admin",
    ownerEmail: config.ADMIN_EMAIL,
    ownerName: "Admin User",
    env: "live",
  });
  console.log("Seeded remote config + first API key (copy once):");
  console.log(created.plaintext);
  console.log("");
  console.log("Admin portal login (.env se — DB mein user create nahi hota):");
  console.log(`  email:    ${config.ADMIN_EMAIL}`);
  console.log("  password: value of ADMIN_PASSWORD in .env");
  console.log("");
  console.log("API start:");
  console.log("  pm2 start deploy/ecosystem.config.cjs");
  console.log("  # ya: npm start");
  await disconnectDb();
}

void seed();
