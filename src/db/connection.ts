import mongoose from "mongoose";
import type { AppConfig } from "../config/index.js";

export async function connectDb(config: AppConfig): Promise<typeof mongoose> {
  mongoose.set("strictQuery", true);
  await mongoose.connect(config.MONGODB_URI, {
    maxPoolSize: 100,
    minPoolSize: 10,
    serverSelectionTimeoutMS: 8_000,
    maxIdleTimeMS: 30_000,
  });
  return mongoose;
}

export async function disconnectDb(): Promise<void> {
  await mongoose.disconnect();
}
