import { loadConfig } from "../config/index.js";
import { AIProvider } from "../lib/ai/index.js";

const PORTRAIT_APIS = [
  "POST /v1/headshots/generate",
  "POST /v1/branding/improve",
];

const VISION_APIS = ["POST /v1/branding/analyze", "POST /v1/profile-review/analyze"];

async function samplePortraitB64(): Promise<string> {
  const res = await fetch("https://picsum.photos/256/256.jpg", { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`sample image fetch failed (${res.status})`);
  return Buffer.from(await res.arrayBuffer()).toString("base64");
}

async function main() {
  console.log("=== Image generation APIs (AIProvider.generatePortrait) ===");
  for (const line of PORTRAIT_APIS) console.log(`  • ${line}`);
  console.log("=== Vision / analysis APIs (AIProvider.visionJson) ===");
  for (const line of VISION_APIS) console.log(`  • ${line}`);
  console.log("");

  const config = loadConfig();
  const ai = new AIProvider(config);
  console.log(`Primary: ${ai.usesBytePlusPrimary() ? "byteplus" : "gemini"}`);
  console.log("Headshots: provider:bfl is legacy-ignored — always BytePlus → Gemini (no BFL).");
  console.log(`Portrait model: ${ai.portraitModelId()}`);
  console.log(`Vision model: ${ai.visionModelId()}`);
  console.log("");

  const sample = await samplePortraitB64();
  let pass = 0;

  if (config.BYTEPLUS_API_KEY) {
    const out = await ai.generatePortrait("Professional headshot, same person.", sample, "image/jpeg");
    const ok = out.imageBase64.length >= 64;
    console.log(`${ok ? "PASS" : "FAIL"}  BytePlus portrait — provider=${out.meta.provider} model=${out.meta.model}`);
    if (ok) pass += 1;
  } else {
    console.log("SKIP  BytePlus portrait — BYTEPLUS_API_KEY empty");
  }

  const geminiCfg = loadConfig({ ...process.env, BYTEPLUS_API_KEY: "", GEMINI_API_KEY: "" });
  const geminiAi = new AIProvider(geminiCfg);
  const mock = await geminiAi.generatePortrait("test", sample, "image/jpeg");
  const mockOk = mock.imageBase64.length >= 64 && mock.meta.provider === "gemini";
  console.log(`${mockOk ? "PASS" : "FAIL"}  Gemini dev mock fallback — provider=${mock.meta.provider}`);
  if (mockOk) pass += 1;

  console.log(`\nResults: ${pass}/${config.BYTEPLUS_API_KEY ? 2 : 1} passed`);
  process.exit(pass >= (config.BYTEPLUS_API_KEY ? 2 : 1) ? 0 : 1);
}

void main().catch((err) => {
  console.error(err);
  process.exit(1);
});
