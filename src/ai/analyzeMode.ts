export type AnalyzeRequestMode = "classic" | "skeleton_v1";

const ENABLE_SKELETON_ANALYZE_MODE = false;
const ACK_PHASE3_SKELETON_WIRING_COMPLETE = false;
const SKELETON_TOPOLOGY_WIRING_ENABLED = false;

type AnalyzeModeFlags = {
  enableSkeletonAnalyzeMode: boolean;
  ackPhase3SkeletonWiringComplete: boolean;
  skeletonTopologyWiringEnabled: boolean;
};

const DEFAULT_ANALYZE_MODE_FLAGS: AnalyzeModeFlags = {
  enableSkeletonAnalyzeMode: ENABLE_SKELETON_ANALYZE_MODE,
  ackPhase3SkeletonWiringComplete: ACK_PHASE3_SKELETON_WIRING_COMPLETE,
  skeletonTopologyWiringEnabled: SKELETON_TOPOLOGY_WIRING_ENABLED
};

export function isSkeletonAnalyzeModeAllowed(flags: AnalyzeModeFlags = DEFAULT_ANALYZE_MODE_FLAGS): boolean {
  return (
    flags.enableSkeletonAnalyzeMode &&
    flags.ackPhase3SkeletonWiringComplete &&
    flags.skeletonTopologyWiringEnabled
  );
}

export function resolveAnalyzeRequestModeForFlags(
  flags: AnalyzeModeFlags = DEFAULT_ANALYZE_MODE_FLAGS
): AnalyzeRequestMode {
  return isSkeletonAnalyzeModeAllowed(flags) ? "skeleton_v1" : "classic";
}

export function resolveAnalyzeRequestMode(): AnalyzeRequestMode {
  const mode = resolveAnalyzeRequestModeForFlags(DEFAULT_ANALYZE_MODE_FLAGS);
  if (
    mode !== "skeleton_v1" &&
    DEFAULT_ANALYZE_MODE_FLAGS.enableSkeletonAnalyzeMode &&
    import.meta.env.DEV
  ) {
    console.warn(
      "[AnalyzeMode] skeleton_v1 blocked: phase3 ack and topology wiring flags are required; forcing classic mode"
    );
  }
  return mode;
}
