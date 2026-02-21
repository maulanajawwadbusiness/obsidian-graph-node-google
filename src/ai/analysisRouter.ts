import { isSkeletonAnalyzeModeAllowed, resolveAnalyzeRequestMode, type AnalyzeRequestMode } from "./analyzeMode";
import { analyzeDocument, type AnalysisResult } from "./paperAnalyzer";
import type { KnowledgeSkeletonV1 } from "../server/src/llm/analyze/knowledgeSkeletonV1";
import { normalizeRouterErrorPayload } from "../server/src/llm/analyze/routerError";
import { analyzeDocumentToSkeletonV1, SkeletonAnalyzeError } from "./skeletonAnalyzer";

export type AnalysisRouterMode = AnalyzeRequestMode;

export type AnalysisRouterErrorCode =
  | "MODE_DISABLED"
  | "mode_guard_blocked"
  | "skeleton_analyze_failed"
  | "analysis_failed"
  | string;

export type AnalysisRouterError = {
  code: AnalysisRouterErrorCode;
  message: string;
  status?: number;
  details?: unknown;
};

export type AnalysisRouterResult =
  | {
      kind: "classic";
      json: AnalysisResult;
      meta: { mode: "classic" };
    }
  | {
      kind: "skeleton_v1";
      skeleton: KnowledgeSkeletonV1;
      meta: { mode: "skeleton_v1" };
    }
  | {
      kind: "error";
      error: AnalysisRouterError;
      meta: { mode: AnalysisRouterMode };
    };

export function normalizeRouterError(
  error: unknown,
  fallbackCode: AnalysisRouterErrorCode
): AnalysisRouterError {
  return normalizeRouterErrorPayload(error, fallbackCode);
}

export async function runAnalysis(args: {
  text: string;
  nodeCount: number;
}): Promise<AnalysisRouterResult> {
  const mode = resolveAnalyzeRequestMode();

  if (mode !== "classic") {
    if (!isSkeletonAnalyzeModeAllowed()) {
      if (import.meta.env.DEV) {
        console.warn("[AnalysisRouter] skeleton_v1 blocked by local analyze mode guard");
      }
      return {
        kind: "error",
        error: {
          code: "mode_guard_blocked",
          message: "skeleton_v1 blocked until phase3 topology wiring is explicitly enabled",
          status: 400
        },
        meta: { mode }
      };
    }

    try {
      const skeleton = await analyzeDocumentToSkeletonV1(args.text);
      return { kind: "skeleton_v1", skeleton, meta: { mode: "skeleton_v1" } };
    } catch (error) {
      if (error instanceof SkeletonAnalyzeError) {
        if (error.code === "MODE_DISABLED") {
          return {
            kind: "error",
            error: {
              code: "MODE_DISABLED",
              message: error.message,
              status: error.status
            },
            meta: { mode }
          };
        }
        if (error.code === "mode_guard_blocked") {
          return {
            kind: "error",
            error: {
              code: "mode_guard_blocked",
              message: error.message,
              status: error.status
            },
            meta: { mode }
          };
        }
        return {
          kind: "error",
          error: {
            code: "skeleton_analyze_failed",
            message: error.message,
            status: error.status
          },
          meta: { mode }
        };
      }

      return {
        kind: "error",
        error: normalizeRouterError(error, "skeleton_analyze_failed"),
          meta: { mode }
        };
      }
  }

  try {
    const json = await analyzeDocument(args.text, { nodeCount: args.nodeCount });
    return { kind: "classic", json, meta: { mode: "classic" } };
  } catch (error) {
    return {
      kind: "error",
      error: normalizeRouterError(error, "analysis_failed"),
      meta: { mode: "classic" }
    };
  }
}
