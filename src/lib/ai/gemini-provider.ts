import type { AppConfig } from "../../config/index.js";
import { errors } from "../errors.js";
import { TINY_PNG_B64 } from "../image-fixtures.js";
import { IDENTITY_INSTRUCTION } from "../prompt-catalog.js";
import { MOCK_BRANDING, mockProfileReview } from "./dev-mocks.js";
import { parseModelJson } from "./json.js";
import type { AIProviderBackend, VisionImageInput } from "./types.js";

const GEMINI_TIMEOUT_MS = 120_000;

export class GeminiProvider implements AIProviderBackend {
  readonly name = "gemini" as const;

  constructor(private readonly config: AppConfig) {}

  portraitModelId(): string {
    return this.config.GEMINI_IMAGE_MODEL;
  }

  visionModelId(): string {
    return this.config.GEMINI_VISION_MODEL;
  }

  async generatePortrait(
    prompt: string,
    imageBase64: string,
    mimeType: string,
    systemInstruction = IDENTITY_INSTRUCTION,
  ): Promise<string> {
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

  async visionJson(prompt: string, images: VisionImageInput[]): Promise<unknown> {
    if (!this.config.GEMINI_API_KEY) {
      if (this.config.isProd) throw errors.server("GEMINI_API_KEY is not configured");
      if (images.length > 1) return mockProfileReview(images);
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
