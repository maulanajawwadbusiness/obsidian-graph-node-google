import type { LlmProvider } from "./types";
import { generateStructuredJson, generateText, generateTextStream } from "../llmClient";
import { mapModel } from "../models/modelMap";

export const openaiProvider: LlmProvider = {
  name: "openai",
  generateText: (opts) => generateText({ ...opts, model: mapModel("openai", opts.model) }),
  generateTextStream: (opts) => generateTextStream({ ...opts, model: mapModel("openai", opts.model) }),
  generateStructuredJson: (opts) => generateStructuredJson({ ...opts, model: mapModel("openai", opts.model) })
};
