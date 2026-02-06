import type { LlmProvider } from "./types";
import { generateStructuredJson, generateText, generateTextStream } from "../llmClient";

export const openaiProvider: LlmProvider = {
  name: "openai",
  generateText: (opts) => generateText(opts),
  generateTextStream: (opts) => generateTextStream(opts),
  generateStructuredJson: (opts) => generateStructuredJson(opts)
};
