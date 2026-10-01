import type { AppConfig } from "../../config/index.js";
import { errors } from "../errors.js";
import { TINY_PNG_B64 } from "../image-fixtures.js";

export class BflProvider {
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
    const json = (await res.json()) as { polling_url?: string };
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
