import type { AIInvocationMeta } from "./types.js";

export function aiTrace(meta: AIInvocationMeta): Record<string, unknown> {
  return {
    aiProvider: meta.provider,
    aiModel: meta.model,
    ...(meta.fallbackFrom ? { aiFallbackFrom: meta.fallbackFrom } : {}),
  };
}
