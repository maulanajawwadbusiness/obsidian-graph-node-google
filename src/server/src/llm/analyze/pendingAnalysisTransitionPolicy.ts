import type { AnalyzeMode } from "./seedSpawnPolicy";

export function shouldDelayPendingConsume(mode: AnalyzeMode): boolean {
  return mode === "skeleton_v1";
}

export function shouldConsumePendingAtStart(mode: AnalyzeMode): boolean {
  return !shouldDelayPendingConsume(mode);
}

export function shouldConsumePendingAfterAsync(mode: AnalyzeMode): boolean {
  return shouldDelayPendingConsume(mode);
}

export function shouldAllowZeroNodePendingAnalysis(mode: AnalyzeMode): boolean {
  return mode === "skeleton_v1";
}
