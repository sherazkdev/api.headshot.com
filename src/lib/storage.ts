import fs from "node:fs/promises";
import path from "node:path";
import { getStorage } from "firebase-admin/storage";
import type { AppConfig } from "../config/index.js";

export class LocalStorage {
  constructor(
    private readonly root = path.resolve("uploads"),
    private readonly generated = path.resolve("generated"),
  ) {}

  async saveUpload(uid: string, uploadId: string, bytes: Buffer, ext = "jpg"): Promise<string> {
    const contentType = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
    const cloud = await this.saveCloud(`uploads/${uid}/${uploadId}.${ext}`, bytes, contentType);
    if (cloud) return cloud;
    const dir = path.join(this.root, uid);
    await fs.mkdir(dir, { recursive: true });
    const filePath = path.join(dir, `${uploadId}.${ext}`);
    await fs.writeFile(filePath, bytes);
    return filePath;
  }

  async saveGenerated(uid: string, jobId: string, bytes: Buffer): Promise<string> {
    const cloud = await this.saveCloud(`generated/${uid}/${jobId}.png`, bytes, "image/png");
    if (cloud) return cloud;
    const dir = path.join(this.generated, uid);
    await fs.mkdir(dir, { recursive: true });
    const filePath = path.join(dir, `${jobId}.png`);
    await fs.writeFile(filePath, bytes);
    return filePath;
  }

  async deleteUserFiles(uid: string): Promise<void> {
    try {
      await getStorage().bucket().deleteFiles({ prefix: `uploads/${uid}` });
      await getStorage().bucket().deleteFiles({ prefix: `generated/${uid}` });
    } catch {
      /* bucket may be missing */
    }
    await fs.rm(path.join(this.root, uid), { recursive: true, force: true });
    await fs.rm(path.join(this.generated, uid), { recursive: true, force: true });
  }

  url(filePath: string, config: AppConfig): string {
    if (filePath.startsWith("http://") || filePath.startsWith("https://")) return filePath;
    const rel = filePath.replace(process.cwd(), "").replace(/\\/g, "/");
    const pathPart = rel.startsWith("/") ? rel : `/${rel}`;
    const base = config.PUBLIC_BASE_URL?.replace(/\/$/, "") || `http://127.0.0.1:${config.PORT}`;
    return `${base}${pathPart}`;
  }

  async readBytes(filePath: string): Promise<Buffer> {
    if (filePath.startsWith("http://") || filePath.startsWith("https://")) {
      const res = await fetch(filePath);
      if (!res.ok) throw new Error(`Upload fetch failed (${res.status})`);
      return Buffer.from(await res.arrayBuffer());
    }
    return fs.readFile(filePath);
  }

  private async saveCloud(objectPath: string, bytes: Buffer, contentType: string): Promise<string | null> {
    try {
      const bucket = getStorage().bucket();
      const file = bucket.file(objectPath);
      await file.save(bytes, { contentType, resumable: false, public: false });
      const [signed] = await file.getSignedUrl({
        action: "read",
        expires: Date.now() + 7 * 86400000,
      });
      return signed;
    } catch {
      return null;
    }
  }
}
