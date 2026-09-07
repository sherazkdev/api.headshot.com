import type { AppConfig } from "../config/index.js";
import { errors } from "./errors.js";
import { TINY_PNG_B64 } from "./image-fixtures.js";
import { IDENTITY_INSTRUCTION } from "./prompt-catalog.js";

function parseModelJson(text: string): unknown {
  const cleaned = text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
  try {
    return JSON.parse(cleaned) as unknown;
  } catch {
    throw errors.server("AI returned invalid JSON");
  }
}

const MOCK_BRANDING = {
  overallScore: 72,
  overallLabel: "Good",
  percentileLabel: "Top 40%",
  metrics: [
    { id: "clarity", score: 75, rating: "Good", insight: "Subject is sharp and well framed." },
    { id: "professionalism", score: 70, rating: "Good", insight: "Outfit reads professional." },
    { id: "composition", score: 68, rating: "Fair", insight: "Slightly more headroom would help." },
    { id: "lighting", score: 74, rating: "Good", insight: "Even studio light, mild shadow on one side." },
    { id: "approachability", score: 73, rating: "Good", insight: "Expression is confident and open." },
  ],
  improvementTips: ["Soften the background", "Lift shadows under the chin"],
  strengths: ["Eye contact", "Clean clothing"],
  enhancementPrompt: "Keep the same person. Improve lighting evenness, clean the background, sharpen eyes.",
};

const GEMINI_TIMEOUT_MS = 120_000;

export class GeminiClient {
  constructor(private readonly config: AppConfig) {}

  async generateImage(prompt: string, imageBase64: string, mimeType: string, systemInstruction = IDENTITY_INSTRUCTION): Promise<string> {
    if (!this.config.GEMINI_API_KEY) {
      if (this.config.isProd) throw errors.server("GEMINI_API_KEY is not configured");
      return TINY_PNG_B64;
    }
    const model = this.config.GEMINI_IMAGE_MODEL;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": this.config.GEMINI_API_KEY,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemInstruction }] },
        contents: [
          {
            parts: [
              { inline_data: { mime_type: mimeType, data: imageBase64 } },
              { text: prompt },
            ],
          },
        ],
        generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
      }),
      signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
    });
    if (res.status === 429) throw errors.aiBusy();
    if (!res.ok) throw errors.server(`Gemini generate failed (${res.status})`);
    const json = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { data?: string }; inline_data?: { data?: string } }> } }>;
    };
    const parts = json.candidates?.[0]?.content?.parts ?? [];
    const data = parts.find((p) => p.inlineData?.data || p.inline_data?.data)?.inlineData?.data
      ?? parts.find((p) => p.inline_data?.data)?.inline_data?.data;
    if (!data) throw errors.server("Gemini returned no image");
    return data;
  }

  async visionJson(prompt: string, images: Array<{ mimeType: string; data: string }>): Promise<unknown> {
    if (!this.config.GEMINI_API_KEY) {
      if (this.config.isProd) throw errors.server("GEMINI_API_KEY is not configured");
      if (images.length > 1) {
        return {
          photos: images.map((_, index) => ({
            index,
            score: 80 - index * 4,
            factors: ["lighting", "expression"],
            strengths: ["Clear face"],
            weaknesses: ["Minor crop"],
          })),
          bestIndex: 0,
          bestScore: 80,
        };
      }
      return MOCK_BRANDING;
    }
    const model = this.config.GEMINI_VISION_MODEL;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": this.config.GEMINI_API_KEY,
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [...images.map((img) => ({ inline_data: { mime_type: img.mimeType, data: img.data } })), { text: prompt }],
          },
        ],
        generationConfig: { responseMimeType: "application/json" },
      }),
      signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
    });
    if (res.status === 429) throw errors.aiBusy();
    if (!res.ok) throw errors.server(`Gemini vision failed (${res.status})`);
    const json = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
    return parseModelJson(text);
  }
}

export class BflClient {
  constructor(private readonly config: AppConfig) {}

  async generate(prompt: string, imageBase64: string): Promise<string> {
    if (!this.config.BFL_API_KEY) {
      if (this.config.isProd) throw errors.server("BFL_API_KEY is not configured");
      return TINY_PNG_B64;
    }
    const res = await fetch(`https://api.bfl.ai/v1/${this.config.BFL_FLUX_MODEL}`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-key": this.config.BFL_API_KEY },
      body: JSON.stringify({ prompt, input_image: imageBase64, output_format: "png" }),
    });
    if (res.status === 429) throw errors.aiBusy();
    if (!res.ok) throw errors.server(`BFL generate failed (${res.status})`);
    const json = (await res.json()) as { polling_url?: string; id?: string };
    if (!json.polling_url) throw errors.server("BFL missing polling_url");
    for (let i = 0; i < 40; i += 1) {
      await new Promise((r) => setTimeout(r, 1500));
      const poll = await fetch(json.polling_url, { headers: { "x-key": this.config.BFL_API_KEY } });
      const body = (await poll.json()) as { status?: string; result?: { sample?: string } };
      if (body.status === "Ready" && body.result?.sample) return this.toBase64(body.result.sample);
      if (body.status === "Error") throw errors.server("BFL job failed");
    }
    throw errors.aiBusy();
  }

  private async toBase64(sample: string): Promise<string> {
    if (sample.startsWith("http://") || sample.startsWith("https://")) {
      const res = await fetch(sample);
      if (!res.ok) throw errors.server("BFL result download failed");
      return Buffer.from(await res.arrayBuffer()).toString("base64");
    }
    return sample;
  }
}
