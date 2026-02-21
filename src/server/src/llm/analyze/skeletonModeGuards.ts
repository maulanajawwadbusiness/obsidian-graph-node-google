export type AnalyzeRequestMode = "classic" | "skeleton_v1";

export type AnalyzeModeFlags = {
  enableSkeletonAnalyzeMode: boolean;
  ackPhase3SkeletonWiringComplete: boolean;
  skeletonTopologyWiringEnabled: boolean;
};

export const DEFAULT_ANALYZE_MODE_FLAGS: AnalyzeModeFlags = {
  enableSkeletonAnalyzeMode: false,
  ackPhase3SkeletonWiringComplete: false,
  skeletonTopologyWiringEnabled: false
};

export function isSkeletonAnalyzeModeAllowedForFlags(flags: AnalyzeModeFlags): boolean {
  return (
    flags.enableSkeletonAnalyzeMode &&
    flags.ackPhase3SkeletonWiringComplete &&
    flags.skeletonTopologyWiringEnabled
  );
}

export function resolveAnalyzeRequestModeForFlags(flags: AnalyzeModeFlags): AnalyzeRequestMode {
  return isSkeletonAnalyzeModeAllowedForFlags(flags) ? "skeleton_v1" : "classic";
}
