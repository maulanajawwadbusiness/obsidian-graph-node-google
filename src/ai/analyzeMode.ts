import {
  DEFAULT_ANALYZE_MODE_FLAGS,
  isSkeletonAnalyzeModeAllowedForFlags,
  resolveAnalyzeRequestModeForFlags as resolveAnalyzeRequestModeForSharedFlags,
  type AnalyzeModeFlags,
  type AnalyzeRequestMode
} from "../server/src/llm/analyze/skeletonModeGuards";

export type { AnalyzeRequestMode };

export function isSkeletonAnalyzeModeAllowed(flags: AnalyzeModeFlags = DEFAULT_ANALYZE_MODE_FLAGS): boolean {
  return isSkeletonAnalyzeModeAllowedForFlags(flags);
}

export function resolveAnalyzeRequestModeForFlags(
  flags: AnalyzeModeFlags = DEFAULT_ANALYZE_MODE_FLAGS
): AnalyzeRequestMode {
  return resolveAnalyzeRequestModeForSharedFlags(flags);
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
