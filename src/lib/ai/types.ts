export type AIProviderName = "byteplus" | "gemini";

export type AiJobProviderName = AIProviderName | "bfl";

export type VisionImageInput = { mimeType: string; data: string };

export type AIInvocationMeta = {
  provider: AIProviderName;
  model: string;
  /** Set when BytePlus failed and Gemini handled the request. */
  fallbackFrom?: AIProviderName;
};

export type PortraitGenerateResult = {
  imageBase64: string;
  meta: AIInvocationMeta;
};

export type VisionJsonResult = {
  data: unknown;
  meta: AIInvocationMeta;
};

export interface AIProviderBackend {
  readonly name: AIProviderName;
  generatePortrait(prompt: string, imageBase64: string, mimeType: string): Promise<string>;
  visionJson(prompt: string, images: VisionImageInput[]): Promise<unknown>;
  portraitModelId(): string;
  visionModelId(): string;
}
