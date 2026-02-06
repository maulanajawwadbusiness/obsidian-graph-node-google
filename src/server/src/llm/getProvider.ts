import type { LlmProvider } from "./providers/types";
import { openaiProvider } from "./providers/openaiProvider";

export function getProvider(providerName: "openai" | "openrouter"): LlmProvider {
  if (providerName === "openai") return openaiProvider;
  throw new Error("OpenRouter provider not implemented");
}
