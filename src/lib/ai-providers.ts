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
          overallScore: 82,
          overallLabel: "Good",
          summary:
            "Photo 1 is the stronger professional headshot: lighting is even, skin tones look natural, and the crop feels LinkedIn-ready. Photo 2 is usable but weaker on color and crop. Use photo 1 as the primary profile image and keep photo 2 as a backup.",
          comparison:
            "Photo 1 wins on lighting, color accuracy, and professional framing. Photo 2 has more mood but a stronger color cast and a tighter crop that feels less corporate.",
          recommendation: "Use photo 1 for LinkedIn, resume, and company profiles.",
          bestPhotoReason: "Photo 1 has cleaner light, natural skin tone, and a more professional expression.",
          strengths: ["Even lighting on the face", "Natural skin tones", "Clear subject focus"],
          weaknesses: ["Secondary photo has a cool color cast", "Background could be simpler"],
          improvementTips: [
            "Reduce colored gel or window spill so skin stays warm and natural.",
            "Leave a bit more headroom and keep eyes on the upper third.",
          ],
          metrics: [
            { id: "lighting", label: "Lighting", score: 84, rating: "Good", insight: "Key light is even on the face with only mild shadow." },
            { id: "composition", label: "Composition & framing", score: 80, rating: "Good", insight: "Head and shoulders sit comfortably in frame." },
            { id: "background", label: "Background", score: 78, rating: "Good", insight: "Background is mostly clean and not competing with the face." },
            { id: "clothing", label: "Clothing & grooming", score: 81, rating: "Good", insight: "Outfit reads professional and uncluttered." },
            { id: "expression", label: "Expression & eye contact", score: 83, rating: "Good", insight: "Expression is open and camera-facing." },
            { id: "sharpness", label: "Sharpness & image quality", score: 85, rating: "Excellent", insight: "Eyes and fabric detail are crisp." },
            { id: "color", label: "Color & skin tone", score: 76, rating: "Good", insight: "Primary photo is accurate; the alternate has a cool cast." },
            { id: "professionalism", label: "Professionalism", score: 82, rating: "Good", insight: "Overall look is suitable for LinkedIn and resume use." },
          ],
          useCases: {
            linkedin: { photoIndex: 0, reason: "Cleanest professional framing and natural color." },
            resume: { photoIndex: 0, reason: "Most conservative and employer-safe option." },
            company: { photoIndex: 0, reason: "Looks like a studio headshot for a team page." },
            social: { photoIndex: 1, reason: "Slightly more mood if you want a warmer personal brand." },
          },
          photos: images.map((_, index) => ({
            index,
            score: 80 - index * 4,
            rating: index === 0 ? "Good" : "Fair",
            verdict: index === 0 ? "Best professional option" : "Backup / moodier option",
            summary:
              index === 0
                ? "This frame has even light, natural skin tone, and a professional crop. It is the safest choice for LinkedIn and resume use."
                : "This frame is sharp but cooler in color and a bit tighter. It works as an alternate, not the primary corporate photo.",
            factors: ["lighting", "expression", "color"],
            strengths: ["Clear face", "Strong subject focus"],
            weaknesses: ["Minor crop", "Color cast on the secondary frame"],
            improvementTips: ["Soften colored light on the face", "Leave a little more space above the head"],
            recommendedFor: index === 0 ? ["linkedin", "resume", "company"] : ["social"],
            metrics: [
              { id: "lighting", score: 84 - index * 6, rating: "Good", insight: "Face is well lit with only small shadow under the chin." },
              { id: "composition", score: 80 - index * 4, rating: "Good", insight: "Head-and-shoulders crop is close to standard headshot framing." },
              { id: "background", score: 78 - index * 3, rating: "Good", insight: "Background stays secondary to the subject." },
              { id: "clothing", score: 81, rating: "Good", insight: "Wardrobe looks neat and professional." },
              { id: "expression", score: 83 - index * 2, rating: "Good", insight: "Eye contact is direct and approachable." },
              { id: "sharpness", score: 85, rating: "Excellent", insight: "Focus on the eyes is clean." },
              { id: "color", score: 88 - index * 12, rating: index === 0 ? "Excellent" : "Fair", insight: "Skin tone is more natural on the first frame." },
              { id: "professionalism", score: 82 - index * 5, rating: "Good", insight: "Reads as a professional profile photo." },
            ],
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
