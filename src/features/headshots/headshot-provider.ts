import type { AIProvider } from "../../lib/ai/index.js";
import type { AiJobProviderName } from "../../lib/ai/types.js";

/**
 * Resolves which AI backend runs headshot generation.
 * Legacy client values (`provider: "bfl"`, `HEADSHOT_AI_PROVIDER=bfl`) do not change routing.
 */
export function resolveHeadshotJobAi(ai: AIProvider): { provider: AiJobProviderName; model: string } {
  return {
    provider: ai.jobProviderLabel(),
    model: ai.portraitModelId(),
  };
}

/** Headshot generate never calls BFL/Flux (kept for explicit tests and docs). */
export function headshotGenerationUsesBfl(): boolean {
  return false;
}
