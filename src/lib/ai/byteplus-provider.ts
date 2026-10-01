import type { AppConfig } from "../../config/index.js";
import { errors } from "../errors.js";
import { TINY_PNG_B64 } from "../image-fixtures.js";
import { IDENTITY_INSTRUCTION } from "../prompt-catalog.js";
import { MOCK_BRANDING, mockProfileReview } from "./dev-mocks.js";
import { parseModelJson } from "./json.js";
import type { AIProviderBackend, VisionImageInput } from "./types.js";

const BYTEPLUS_TIMEOUT_MS = 180_000;

function apiBase(config: AppConfig): string {
  return config.BYTEPLUS_BASE_URL.replace(/\/$/, "");
}

function authHeaders(config: AppConfig): Record<string, string> {
  return {
    "content-type": "application/json",
    authorization: `Bearer ${config.BYTEPLUS_API_KEY}`,
  };
}

function toDataUri(mimeType: string, imageBase64: string): string {
  return imageBase64.startsWith("data:") ? imageBase64 : `data:${mimeType};base64,${imageBase64}`;
}

function extractResponsesText(json: unknown): string {
  const root = json as {
    output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
    choices?: Array<{ message?: { content?: string } }>;
  };
  for (const block of root.output ?? []) {
    for (const part of block.content ?? []) {
      if ((part.type === "output_text" || part.type === "text") && part.text) return part.text;
    }
  }
  const chat = root.choices?.[0]?.message?.content;
  if (chat) return chat;
  return "";
}

export class BytePlusProvider implements AIProviderBackend {
  readonly name = "byteplus" as const;

  constructor(private readonly config: AppConfig) {}

  portraitModelId(): string {
    return this.config.BYTEPLUS_MODEL;
  }

  visionModelId(): string {
    return this.config.BYTEPLUS_VISION_MODEL;
  }

  async generatePortrait(prompt: string, imageBase64: string, mimeType: string): Promise<string> {
    if (!this.config.BYTEPLUS_API_KEY) {
      if (this.config.isProd) throw errors.server("BYTEPLUS_API_KEY is not configured");
      return TINY_PNG_B64;
    }
    const url = `${apiBase(this.config)}/images/generations`;
    const fullPrompt = `${IDENTITY_INSTRUCTION}\n\n${prompt}`;
    const image = toDataUri(mimeType, imageBase64);

    const res = await fetch(url, {
      method: "POST",
      headers: authHeaders(this.config),
      body: JSON.stringify({
        model: this.config.BYTEPLUS_MODEL,
        prompt: fullPrompt,
        image,
        response_format: "b64_json",
        size: "2K",
        output_format: "png",
        watermark: false,
      }),
      signal: AbortSignal.timeout(BYTEPLUS_TIMEOUT_MS),
    });
    if (res.status === 429) throw errors.aiBusy();
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw errors.server(`BytePlus Seedream failed (${res.status})${detail ? `: ${detail.slice(0, 200)}` : ""}`);
    }
    const json = (await res.json()) as {
      data?: Array<{ b64_json?: string; url?: string }>;
      error?: { message?: string };
    };
    if (json.error?.message) throw errors.server(json.error.message);
    const item = json.data?.[0];
    if (item?.b64_json) return item.b64_json;
    if (item?.url) {
      const imgRes = await fetch(item.url, { signal: AbortSignal.timeout(60_000) });
      if (!imgRes.ok) throw errors.server("BytePlus image download failed");
      return Buffer.from(await imgRes.arrayBuffer()).toString("base64");
    }
    throw errors.server("BytePlus returned no image");
  }

  async visionJson(prompt: string, images: VisionImageInput[]): Promise<unknown> {
    if (!this.config.BYTEPLUS_API_KEY) {
      if (this.config.isProd) throw errors.server("BYTEPLUS_API_KEY is not configured");
      if (images.length > 1) return mockProfileReview(images);
      return MOCK_BRANDING;
    }

    const jsonPrompt = `${prompt}\n\nReturn valid JSON only. No markdown fences.`;
    const content: Array<Record<string, string>> = [];
    for (const img of images) {
      content.push({
        type: "input_image",
        image_url: toDataUri(img.mimeType, img.data),
      });
    }
    content.push({ type: "input_text", text: jsonPrompt });

    const chatUrl = `${apiBase(this.config)}/chat/completions`;
    const chatContent: Array<Record<string, unknown>> = images.map((img) => ({
      type: "image_url",
      image_url: { url: toDataUri(img.mimeType, img.data) },
    }));
    chatContent.push({ type: "text", text: jsonPrompt });
    let res = await fetch(chatUrl, {
      method: "POST",
      headers: authHeaders(this.config),
      body: JSON.stringify({
        model: this.config.BYTEPLUS_VISION_MODEL,
        messages: [{ role: "user", content: chatContent }],
      }),
      signal: AbortSignal.timeout(BYTEPLUS_TIMEOUT_MS),
    });

    if (!res.ok) {
      const responsesUrl = `${apiBase(this.config)}/responses`;
      res = await fetch(responsesUrl, {
        method: "POST",
        headers: authHeaders(this.config),
        body: JSON.stringify({
          model: this.config.BYTEPLUS_VISION_MODEL,
          input: [{ role: "user", content }],
        }),
        signal: AbortSignal.timeout(BYTEPLUS_TIMEOUT_MS),
      });
    }

    if (res.status === 429) throw errors.aiBusy();
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw errors.server(`BytePlus vision failed (${res.status})${detail ? `: ${detail.slice(0, 200)}` : ""}`);
    }
    const json = await res.json();
    const text = extractResponsesText(json);
    if (!text.trim()) throw errors.server("BytePlus vision returned empty text");
    return parseModelJson(text);
  }
}
