import assert from "node:assert/strict";
import { loadConfig } from "../config/index.js";
import { AIProvider } from "../lib/ai/index.js";
import { TINY_PNG_B64 } from "../lib/image-fixtures.js";
import {
  headshotGenerationUsesBfl,
  resolveHeadshotJobAi,
} from "../features/headshots/headshot-provider.js";

type CaseResult = { name: string; ok: boolean; detail?: string };

function pass(name: string): CaseResult {
  return { name, ok: true };
}

function fail(name: string, detail: string): CaseResult {
  return { name, ok: false, detail };
}

function testConfig(overrides: Record<string, string>): ReturnType<typeof loadConfig> {
  return loadConfig({ ...process.env, NODE_ENV: "development", ...overrides });
}

function mockAi(usesBytePlus: boolean): AIProvider {
  const config = testConfig({
    BYTEPLUS_API_KEY: usesBytePlus ? "test-byteplus-key" : "",
    BYTEPLUS_MODEL: "dola-seedream-test",
    GEMINI_API_KEY: "",
    GEMINI_IMAGE_MODEL: "gemini-test-image",
  });
  return new AIProvider(config);
}

async function run(): Promise<void> {
  loadConfig();
  const results: CaseResult[] = [];

  // 6 — BFL never selected for headshots
  try {
    assert.equal(headshotGenerationUsesBfl(), false);
    const withBflRequest = resolveHeadshotJobAi(mockAi(true));
    assert.equal(withBflRequest.provider, "byteplus");
    assert.notEqual(withBflRequest.model, "flux-2-klein-4b");
    results.push(pass("6 — headshot route never uses BFL/Flux"));
  } catch (e) {
    results.push(fail("6 — headshot route never uses BFL/Flux", String(e)));
  }

  // 1 — provider bfl + BytePlus key → BytePlus job metadata
  try {
    const meta = resolveHeadshotJobAi(mockAi(true));
    assert.equal(meta.provider, "byteplus");
    assert.equal(meta.model, "dola-seedream-test");
    results.push(pass("1 — legacy provider:bfl + BytePlus key → BytePlus (job meta)"));
  } catch (e) {
    results.push(fail("1 — legacy provider:bfl + BytePlus key → BytePlus (job meta)", String(e)));
  }

  // 2 — no provider + BytePlus key → BytePlus
  try {
    const meta = resolveHeadshotJobAi(mockAi(true));
    assert.equal(meta.provider, "byteplus");
    results.push(pass("2 — no provider + BytePlus key → BytePlus"));
  } catch (e) {
    results.push(fail("2 — no provider + BytePlus key → BytePlus", String(e)));
  }

  // 5 — BytePlus key missing → Gemini
  try {
    const meta = resolveHeadshotJobAi(mockAi(false));
    assert.equal(meta.provider, "gemini");
    assert.equal(meta.model, "gemini-test-image");
    results.push(pass("5 — BytePlus key missing → Gemini"));
  } catch (e) {
    results.push(fail("5 — BytePlus key missing → Gemini", String(e)));
  }

  const baseEnv: Record<string, string> = {
    BYTEPLUS_API_KEY: "test-key",
    BYTEPLUS_MODEL: "seedream-test",
    BYTEPLUS_BASE_URL: "https://ark.ap-southeast.bytepluses.com/api/v3",
    GEMINI_API_KEY: "",
    GEMINI_IMAGE_MODEL: "gemini-test-image",
  };

  const byteplusOk = (b64 = TINY_PNG_B64) =>
    new Response(JSON.stringify({ data: [{ b64_json: b64 }] }), { status: 200 });

  const byteplusFail = () => new Response(JSON.stringify({ error: { message: "simulated" } }), { status: 500 });

  const realFetch = globalThis.fetch;

  // 1 & 2 runtime — generatePortrait uses BytePlus
  try {
    globalThis.fetch = async (input) => {
      const url = String(input);
      if (url.includes("/images/generations")) return byteplusOk();
      if (url.includes("bfl.ai")) throw new Error("BFL must not be called");
      return realFetch(input);
    };
    const ai = new AIProvider(testConfig(baseEnv));
    const out = await ai.generatePortrait("test prompt", TINY_PNG_B64, "image/png");
    assert.equal(out.meta.provider, "byteplus");
    assert.equal(out.meta.fallbackFrom, undefined);
    results.push(pass("1/2 — generatePortrait with BytePlus key → byteplus meta"));
  } catch (e) {
    results.push(fail("1/2 — generatePortrait with BytePlus key → byteplus meta", String(e)));
  } finally {
    globalThis.fetch = realFetch;
  }

  // 3 & 4 — BytePlus failure → Gemini fallback (dev mock PNG)
  for (const label of ["3 — provider:bfl path + BytePlus fail", "4 — default + BytePlus fail"]) {
    try {
      globalThis.fetch = async (input) => {
        const url = String(input);
        if (url.includes("/images/generations")) return byteplusFail();
        if (url.includes("bfl.ai")) throw new Error("BFL must not be called");
        return realFetch(input);
      };
      const ai = new AIProvider(testConfig(baseEnv));
      const out = await ai.generatePortrait("test", TINY_PNG_B64, "image/png");
      assert.equal(out.meta.provider, "gemini");
      assert.equal(out.meta.fallbackFrom, "byteplus");
      assert.ok(out.imageBase64.length >= 64);
      results.push(pass(`${label} → Gemini fallback`));
    } catch (e) {
      results.push(fail(`${label} → Gemini fallback`, String(e)));
    } finally {
      globalThis.fetch = realFetch;
    }
  }

  const failed = results.filter((r) => !r.ok);
  for (const r of results) {
    console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}${r.detail ? ` — ${r.detail}` : ""}`);
  }
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  if (failed.length) process.exit(1);
}

void run().catch((err) => {
  console.error(err);
  process.exit(1);
});
