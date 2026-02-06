import type { LlmStream, LlmStructuredResult, LlmTextResult } from "../llmClient";
import type { LogicalModel } from "../models/logicalModels";

export interface LlmProvider {
  name: "openai" | "openrouter";
  generateText(opts: { model: LogicalModel; input: string; timeoutMs?: number }): Promise<LlmTextResult>;
  generateTextStream(opts: { model: LogicalModel; input: string; timeoutMs?: number }): LlmStream;
  generateStructuredJson(opts: { model: LogicalModel; input: string; schema: object; timeoutMs?: number }): Promise<LlmStructuredResult>;
}
