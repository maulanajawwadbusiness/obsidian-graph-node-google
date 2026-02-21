import type { AnalyzeRequestMode } from "../ai/analyzeMode";

export type SeedSpawnDecisionArgs = {
  mode: AnalyzeRequestMode;
  hasPendingAnalysis: boolean;
  hasPendingRestore: boolean;
  hasRestoredSuccessfully: boolean;
};

export function shouldSpawnSeedGraphOnInit(args: SeedSpawnDecisionArgs): boolean {
  if (args.hasPendingRestore || args.hasRestoredSuccessfully) {
    return false;
  }

  if (args.hasPendingAnalysis && args.mode === "skeleton_v1") {
    return false;
  }

  return true;
}
