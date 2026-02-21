import { isSkeletonAnalyzeModeAllowed, resolveAnalyzeRequestMode, type AnalyzeRequestMode } from "./analyzeMode";
import { analyzeDocument, type AnalysisResult } from "./paperAnalyzer";
import type { KnowledgeSkeletonV1 } from "../server/src/llm/analyze/knowledgeSkeletonV1";

export type AnalysisRouterMode = AnalyzeRequestMode;

export type AnalysisRouterErrorCode =
  | "MODE_DISABLED"
  | "mode_guard_blocked"
  | "analysis_failed";

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
      error: {
        code: AnalysisRouterErrorCode;
        message: string;
        status?: number;
      };
      meta: { mode: AnalysisRouterMode };
    };

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

    return {
      kind: "error",
      error: {
        code: "MODE_DISABLED",
        message: "skeleton_v1 route path is not wired in phase3 step1",
        status: 400
      },
      meta: { mode }
    };
  }

  try {
    const json = await analyzeDocument(args.text, { nodeCount: args.nodeCount });
    return { kind: "classic", json, meta: { mode: "classic" } };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      kind: "error",
      error: {
        code: "analysis_failed",
        message
      },
      meta: { mode: "classic" }
    };
  }
}
