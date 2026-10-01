import type { AppConfig } from "../../config/index.js";
import { TINY_PNG_B64 } from "../image-fixtures.js";
import { BytePlusProvider } from "./byteplus-provider.js";
import { MOCK_BRANDING, mockProfileReview } from "./dev-mocks.js";
import { GeminiProvider } from "./gemini-provider.js";
import type {
  AIInvocationMeta,
  AIProviderName,
  PortraitGenerateResult,
  VisionImageInput,
  VisionJsonResult,
} from "./types.js";

export type AILogger = {
  info: (obj: Record<string, unknown>, msg?: string) => void;
  warn: (obj: Record<string, unknown>, msg?: string) => void;
};

export class AIProvider {
  private readonly byteplus: BytePlusProvider;
  private readonly gemini: GeminiProvider;

  constructor(
    private readonly config: AppConfig,
    private readonly log: AILogger = console,
  ) {
    this.byteplus = new BytePlusProvider(config);
    this.gemini = new GeminiProvider(config);
  }

  usesBytePlusPrimary(): boolean {
    return Boolean(this.config.BYTEPLUS_API_KEY);
  }

  portraitModelId(): string {
    return this.usesBytePlusPrimary() ? this.byteplus.portraitModelId() : this.gemini.portraitModelId();
  }

  visionModelId(): string {
    return this.usesBytePlusPrimary() ? this.byteplus.visionModelId() : this.gemini.visionModelId();
  }

  jobProviderLabel(): AIProviderName {
    return this.usesBytePlusPrimary() ? "byteplus" : "gemini";
  }

  async generatePortrait(prompt: string, imageBase64: string, mimeType: string): Promise<PortraitGenerateResult> {
    if (this.usesBytePlusPrimary()) {
      try {
        const image = await this.byteplus.generatePortrait(prompt, imageBase64, mimeType);
        const meta: AIInvocationMeta = { provider: "byteplus", model: this.byteplus.portraitModelId() };
        this.log.info({ ai: meta, op: "generatePortrait" }, "AI portrait generated");
        return { imageBase64: image, meta };
      } catch (err) {
        this.log.warn(
          { err: err instanceof Error ? err.message : err, op: "generatePortrait" },
          "BytePlus failed — falling back to Gemini",
        );
        try {
          const image = await this.gemini.generatePortrait(prompt, imageBase64, mimeType);
          const meta: AIInvocationMeta = {
            provider: "gemini",
            model: this.gemini.portraitModelId(),
            fallbackFrom: "byteplus",
          };
          this.log.info({ ai: meta, op: "generatePortrait" }, "AI portrait generated (fallback)");
          return { imageBase64: image, meta };
        } catch (geminiErr) {
          if (this.config.isProd) throw geminiErr;
          this.log.warn(
            { err: geminiErr instanceof Error ? geminiErr.message : geminiErr, op: "generatePortrait" },
            "Gemini portrait fallback failed — using development placeholder image",
          );
          const meta: AIInvocationMeta = {
            provider: "gemini",
            model: this.gemini.portraitModelId(),
            fallbackFrom: "byteplus",
          };
          return { imageBase64: TINY_PNG_B64, meta };
        }
      }
    }
    const image = await this.gemini.generatePortrait(prompt, imageBase64, mimeType);
    const meta: AIInvocationMeta = { provider: "gemini", model: this.gemini.portraitModelId() };
    this.log.info({ ai: meta, op: "generatePortrait" }, "AI portrait generated");
    return { imageBase64: image, meta };
  }

  async visionJson(prompt: string, images: VisionImageInput[]): Promise<VisionJsonResult> {
    if (this.usesBytePlusPrimary()) {
      try {
        const data = await this.byteplus.visionJson(prompt, images);
        const meta: AIInvocationMeta = { provider: "byteplus", model: this.byteplus.visionModelId() };
        this.log.info({ ai: meta, op: "visionJson", imageCount: images.length }, "AI vision completed");
        return { data, meta };
      } catch (err) {
        this.log.warn(
          { err: err instanceof Error ? err.message : err, op: "visionJson", imageCount: images.length },
          "BytePlus vision failed — falling back to Gemini",
        );
        try {
          const data = await this.gemini.visionJson(prompt, images);
          const meta: AIInvocationMeta = {
            provider: "gemini",
            model: this.gemini.visionModelId(),
            fallbackFrom: "byteplus",
          };
          this.log.info({ ai: meta, op: "visionJson", imageCount: images.length }, "AI vision completed (fallback)");
          return { data, meta };
        } catch (geminiErr) {
          if (this.config.isProd) throw geminiErr;
          this.log.warn(
            { err: geminiErr instanceof Error ? geminiErr.message : geminiErr, op: "visionJson", imageCount: images.length },
            "Gemini vision fallback failed — using development analysis mock",
          );
          const data = images.length > 1 ? mockProfileReview(images) : MOCK_BRANDING;
          const meta: AIInvocationMeta = {
            provider: "gemini",
            model: this.gemini.visionModelId(),
            fallbackFrom: "byteplus",
          };
          return { data, meta };
        }
      }
    }
    const data = await this.gemini.visionJson(prompt, images);
    const meta: AIInvocationMeta = { provider: "gemini", model: this.gemini.visionModelId() };
    this.log.info({ ai: meta, op: "visionJson", imageCount: images.length }, "AI vision completed");
    return { data, meta };
  }
}
