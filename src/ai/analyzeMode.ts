export type AnalyzeRequestMode = "classic" | "skeleton_v1";

const ENABLE_SKELETON_ANALYZE_MODE = false;

export function resolveAnalyzeRequestMode(): AnalyzeRequestMode {
  return ENABLE_SKELETON_ANALYZE_MODE ? "skeleton_v1" : "classic";
}
