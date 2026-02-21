export type AnalyzeMode = "classic" | "skeleton_v1";

export type SeedSpawnDecisionArgs = {
  mode: AnalyzeMode;
  hasPendingAnalysis: boolean;
  hasPendingRestore: boolean;
  hasRestoredSuccessfully: boolean;
};

export function shouldSpawnSeedGraph(args: SeedSpawnDecisionArgs): boolean {
  if (args.hasPendingRestore || args.hasRestoredSuccessfully) {
    return false;
  }

  if (args.hasPendingAnalysis && args.mode === "skeleton_v1") {
    return false;
  }

  return true;
}
