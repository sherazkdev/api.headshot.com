import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadConfig } from "../config/index.js";
import { AIProvider } from "../lib/ai/index.js";
import { verifyTestJpeg } from "../lib/image-fixtures.js";

async function main() {
  const config = loadConfig();
  const ai = new AIProvider(config);
  const inputB64 = verifyTestJpeg().toString("base64");

  console.log(`Primary: ${ai.usesBytePlusPrimary() ? "byteplus" : "gemini"}`);
  console.log(`Model: ${ai.portraitModelId()}`);
  console.log("Generating (this may take 30–90s)...");

  const out = await ai.generatePortrait(
    "Professional LinkedIn headshot of the same person. Studio lighting, neutral background, sharp focus, natural skin.",
    inputB64,
    "image/jpeg",
  );

  const dir = join(process.cwd(), "output");
  mkdirSync(dir, { recursive: true });
  const inputPath = join(dir, "sample-input.jpg");
  const outputPath = join(dir, "sample-generated.png");
  writeFileSync(inputPath, verifyTestJpeg());
  writeFileSync(outputPath, Buffer.from(out.imageBase64, "base64"));

  console.log("");
  console.log("Done.");
  console.log(`  provider: ${out.meta.provider}`);
  console.log(`  model:    ${out.meta.model}`);
  if (out.meta.fallbackFrom) console.log(`  fallback: ${out.meta.fallbackFrom}`);
  console.log(`  input:    ${inputPath}`);
  console.log(`  output:   ${outputPath}`);
}

void main().catch((err) => {
  console.error(err);
  process.exit(1);
});
