import { errors } from "../errors.js";

export function parseModelJson(text: string): unknown {
  const cleaned = text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
  try {
    return JSON.parse(cleaned) as unknown;
  } catch {
    throw errors.server("AI returned invalid JSON");
  }
}
