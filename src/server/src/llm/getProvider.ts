import type { LlmProvider } from "./providers/types";
import { openaiProvider } from "./providers/openaiProvider";
import { openrouterProvider } from "./providers/openrouterProvider";

export function getProvider(providerName: "openai" | "openrouter"): LlmProvider {
  if (providerName === "openai") return openaiProvider;
  if (providerName === "openrouter") {
    if (!process.env.OPENROUTER_API_KEY) {
      throw new Error("OPENROUTER_API_KEY is not set");
    }
    return openrouterProvider;
  }
  throw new Error("Unknown provider");
}
