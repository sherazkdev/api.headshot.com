import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const TINY_PNG_B64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

/** Legacy 1×1 placeholder — not valid for BytePlus Seedream (min 14px). */
export const TINY_JPEG_B64 =
  "/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAkGBwgHBgkIBwgKCgkLDRYPDQwMDRsUFRAWIB0iIiAdHx8kKDQsJCYxJx8fLT0tMTU3Ojo6Iys/RD84QzQ5OjcBCgoKDQwNGg8PGjclHyU3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3N//AABEIAAEAAQMBIgACEQEDEQH/xAAbAAABBQEBAAAAAAAAAAAAAAADAAECBAUGB//EABQBAQAAAAAAAAAAAAAAAAAAAAD/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAGf/8QAHBAAAgMBAQEBAAAAAAAAAAAAAQIAAxESBBMh/9oACAEBAAE/ALVq1rWta1rWv/Z";

const fixtureDir = dirname(fileURLToPath(import.meta.url));

let verifySelfieCache: Buffer | null = null;

/** 64×64 JPEG for E2E verify / env-proof (meets BytePlus minimum image size). */
export function verifyTestJpeg(): Buffer {
  if (!verifySelfieCache) {
    const candidates = [
      join(fixtureDir, "fixtures", "verify-selfie.jpg"),
      join(process.cwd(), "src/lib/fixtures/verify-selfie.jpg"),
    ];
    const path = candidates.find((p) => {
      try {
        readFileSync(p);
        return true;
      } catch {
        return false;
      }
    });
    if (!path) throw new Error("verify-selfie.jpg fixture missing (src/lib/fixtures/)");
    verifySelfieCache = readFileSync(path);
  }
  return verifySelfieCache;
}

export function tinyPng(): Buffer {
  return Buffer.from(TINY_PNG_B64, "base64");
}

export function tinyJpeg(): Buffer {
  return verifyTestJpeg();
}
