export type AnalyzeRequestMode = "classic" | "skeleton_v1";

const ENABLE_SKELETON_ANALYZE_MODE = false;
const ACK_PHASE3_SKELETON_WIRING_COMPLETE = false;

export function resolveAnalyzeRequestMode(): AnalyzeRequestMode {
  if (ENABLE_SKELETON_ANALYZE_MODE && ACK_PHASE3_SKELETON_WIRING_COMPLETE) {
    return "skeleton_v1";
  }
  if (ENABLE_SKELETON_ANALYZE_MODE && !ACK_PHASE3_SKELETON_WIRING_COMPLETE && import.meta.env.DEV) {
    console.warn("[AnalyzeMode] skeleton_v1 blocked: phase3 wiring ack is disabled; forcing classic mode");
  }
  return "classic";
}
