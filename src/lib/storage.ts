import fs from "node:fs/promises";
import path from "node:path";
import type { AppConfig } from "../config/index.js";

export class LocalStorage {
  constructor(
    private readonly root = path.resolve("uploads"),
    private readonly generated = path.resolve("generated"),
  ) {}

  async saveUpload(uid: string, uploadId: string, bytes: Buffer, ext = "jpg"): Promise<string> {
    const dir = path.join(this.root, uid);
    await fs.mkdir(dir, { recursive: true });
    const filePath = path.join(dir, `${uploadId}.${ext}`);
    await fs.writeFile(filePath, bytes);
    return filePath;
  }

  async saveGenerated(uid: string, jobId: string, bytes: Buffer): Promise<string> {
    const dir = path.join(this.generated, uid);
    await fs.mkdir(dir, { recursive: true });
    const filePath = path.join(dir, `${jobId}.png`);
    await fs.writeFile(filePath, bytes);
    return filePath;
  }

  async deleteUserFiles(uid: string): Promise<void> {
    await fs.rm(path.join(this.root, uid), { recursive: true, force: true });
    await fs.rm(path.join(this.generated, uid), { recursive: true, force: true });
  }

  url(filePath: string, config: AppConfig): string {
    const rel = filePath.replace(process.cwd(), "").replace(/\\/g, "/");
    return `http://127.0.0.1:${config.PORT}${rel.startsWith("/") ? rel : `/${rel}`}`;
  }
}
