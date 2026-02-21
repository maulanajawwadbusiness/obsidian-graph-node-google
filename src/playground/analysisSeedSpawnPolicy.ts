import type { AnalyzeRequestMode } from "../ai/analyzeMode";
import { shouldSpawnSeedGraph } from "../server/src/llm/analyze/seedSpawnPolicy";

export type SeedSpawnDecisionArgs = {
  mode: AnalyzeRequestMode;
  hasPendingAnalysis: boolean;
  hasPendingRestore: boolean;
  hasRestoredSuccessfully: boolean;
};

export function shouldSpawnSeedGraphOnInit(args: SeedSpawnDecisionArgs): boolean {
  return shouldSpawnSeedGraph(args);
}
