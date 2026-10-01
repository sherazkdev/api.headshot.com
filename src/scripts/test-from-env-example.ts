import { existsSync, readFileSync } from "node:fs";
import { loadConfig } from "../config/index.js";
import { AIProvider } from "../lib/ai/index.js";
import { TINY_PNG_B64 } from "../lib/image-fixtures.js";
import { headshotGenerationUsesBfl, resolveHeadshotJobAi } from "../features/headshots/headshot-provider.js";

function parseEnvFile(path: string): Record<string, string> {
  if (!existsSync(path)) return {};
  const out: Record<string, string> = {};
  for (const raw of readFileSync(path, "utf8").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 1) continue;
    out[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
  }
  return out;
}

/** Config as documented in .env.example, with secrets filled from .env where example is empty. */
function envFromExamplePlusSecrets(): Record<string, string> {
  const example = parseEnvFile(".env.example");
  const local = parseEnvFile(".env");
  const merged: Record<string, string> = { ...process.env } as Record<string, string>;
  for (const [k, v] of Object.entries(example)) merged[k] = v;
  for (const [k, v] of Object.entries(local)) {
    if (v) merged[k] = v;
  }
  return merged;
}

async function samplePortraitB64(): Promise<string> {
  const res = await fetch("https://picsum.photos/256/256.jpg", { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`sample image fetch failed (${res.status})`);
  return Buffer.from(await res.arrayBuffer()).toString("base64");
}

async function main() {
  const env = envFromExamplePlusSecrets();
  const config = loadConfig(env);

  console.log("=== Config source: .env.example (+ secrets from .env) ===");
  console.log(`BYTEPLUS_BASE_URL: ${config.BYTEPLUS_BASE_URL}`);
  console.log(`BYTEPLUS_MODEL: ${config.BYTEPLUS_MODEL}`);
  console.log(`BYTEPLUS_VISION_MODEL: ${config.BYTEPLUS_VISION_MODEL}`);
  console.log(`BYTEPLUS_API_KEY: ${config.BYTEPLUS_API_KEY ? "SET" : "MISSING"}`);
  console.log(`Primary AI: ${config.BYTEPLUS_API_KEY ? "byteplus" : "gemini"}`);
  console.log("");

  const ai = new AIProvider(config);
  let pass = 0;
  const expect = config.BYTEPLUS_API_KEY ? 3 : 2;

  const meta = resolveHeadshotJobAi(ai);
  if (config.BYTEPLUS_API_KEY && meta.provider === "byteplus" && meta.model === config.BYTEPLUS_MODEL) {
    console.log("PASS  job meta matches .env.example BYTEPLUS_MODEL");
    pass += 1;
  } else if (!config.BYTEPLUS_API_KEY && meta.provider === "gemini") {
    console.log("PASS  no BytePlus key → gemini (per example template)");
    pass += 1;
  } else {
    console.log(`FAIL  job meta provider=${meta.provider} model=${meta.model}`);
  }

  if (!headshotGenerationUsesBfl()) {
    console.log("PASS  headshots never use BFL");
    pass += 1;
  } else {
    console.log("FAIL  BFL routing enabled");
  }

  if (config.BYTEPLUS_API_KEY) {
    const sample = await samplePortraitB64();
    const out = await ai.generatePortrait("Professional headshot, same person.", sample, "image/jpeg");
    const ok =
      out.meta.provider === "byteplus" &&
      out.meta.model === config.BYTEPLUS_MODEL &&
      out.imageBase64.length >= 64;
    console.log(
      `${ok ? "PASS" : "FAIL"}  live Seedream — provider=${out.meta.provider} model=${out.meta.model} bytes=${out.imageBase64.length}`,
    );
    if (ok) pass += 1;
  } else {
    const out = await ai.generatePortrait("test", TINY_PNG_B64, "image/png");
    const ok = out.meta.provider === "gemini" && out.imageBase64.length >= 64;
    console.log(`${ok ? "PASS" : "FAIL"}  gemini/mock without BYTEPLUS_API_KEY`);
    if (ok) pass += 1;
  }

  console.log(`\n${pass}/${expect} passed`);
  process.exit(pass === expect ? 0 : 1);
}

void main().catch((err) => {
  console.error(err);
  process.exit(1);
});
