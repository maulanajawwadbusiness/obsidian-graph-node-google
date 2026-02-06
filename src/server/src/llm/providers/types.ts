import type { LlmStream, LlmStructuredResult, LlmTextResult } from "../llmClient";

export interface LlmProvider {
  name: "openai" | "openrouter";
  generateText(opts: { model: string; input: string; timeoutMs?: number }): Promise<LlmTextResult>;
  generateTextStream(opts: { model: string; input: string; timeoutMs?: number }): LlmStream;
  generateStructuredJson(opts: { model: string; input: string; schema: object; timeoutMs?: number }): Promise<LlmStructuredResult>;
}
