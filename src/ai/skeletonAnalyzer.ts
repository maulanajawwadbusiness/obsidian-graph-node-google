import { AI_MODELS } from "../config/aiModels";
import type { KnowledgeSkeletonV1 } from "../server/src/llm/analyze/knowledgeSkeletonV1";
import { assertSemanticKnowledgeSkeletonV1, parseKnowledgeSkeletonV1Response } from "./knowledgeSkeletonV1Parser";

const SKELETON_API_TIMEOUT_MS = 120_000;
const ENABLE_SKELETON_DEBUG_STORAGE = false;

type SkeletonSseResult = {
  ok: boolean;
  status: number;
  data: Record<string, unknown> | null;
};

export class SkeletonAnalyzeError extends Error {
  public readonly status: number;
  public readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "SkeletonAnalyzeError";
    this.status = status;
    this.code = code;
  }
}

function resolveAnalyzeUrl(path: string): string {
  const base = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();
  if (!base) throw new Error("VITE_API_BASE_URL is missing or empty");
  const trimmedBase = base.replace(/\/+$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${trimmedBase}${normalizedPath}`;
}

async function fetchAnalyzeSse(url: string, body: object, timeoutMs: number): Promise<SkeletonSseResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal
    });

    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      let parsed: Record<string, unknown> | null = null;
      try {
        parsed = (await response.json()) as Record<string, unknown>;
      } catch {
        parsed = null;
      }
      return { ok: response.ok, status: response.status, data: parsed };
    }

    if (!response.body) return { ok: false, status: 502, data: null };
    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) buffer += decoder.decode(value, { stream: true });
    }
    buffer += decoder.decode();

    const lines = buffer.split("\n");
    let lastData: string | null = null;
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (line.startsWith("data:")) {
        lastData = line.slice(5).trimStart();
      }
    }
    if (!lastData) return { ok: false, status: 502, data: null };
    const parsed = JSON.parse(lastData) as Record<string, unknown>;
    const embeddedStatus = typeof parsed._status === "number" ? parsed._status : 200;
    const status = Number.isFinite(embeddedStatus) ? embeddedStatus : 200;
    const isOk = status >= 200 && status < 300 && parsed.ok === true;
    return { ok: isOk, status, data: parsed };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new SkeletonAnalyzeError("skeleton analyze timeout", 504, "timeout");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function storeDebugSkeleton(skeleton: KnowledgeSkeletonV1): void {
  if (!ENABLE_SKELETON_DEBUG_STORAGE || typeof window === "undefined") return;
  (window as unknown as { __ARNVOID_SKELETON_DEBUG?: KnowledgeSkeletonV1 }).__ARNVOID_SKELETON_DEBUG = skeleton;
  const topNode = [...skeleton.nodes].sort((a, b) => b.pressure - a.pressure)[0];
  console.log("[SkeletonDebug] nodes=%d edges=%d top=%s", skeleton.nodes.length, skeleton.edges.length, topNode?.id ?? "none");
}

export async function analyzeDocumentToSkeletonV1(text: string): Promise<KnowledgeSkeletonV1> {
  const url = resolveAnalyzeUrl("/api/llm/paper-analyze");
  const result = await fetchAnalyzeSse(
    url,
    {
      text,
      mode: "skeleton_v1",
      model: AI_MODELS.ANALYZER
    },
    SKELETON_API_TIMEOUT_MS
  );
  if (!result.ok || !result.data) {
    const code = typeof result.data?.code === "string" ? result.data.code : undefined;
    throw new SkeletonAnalyzeError("skeleton analyze failed", result.status, code);
  }
  const skeletonRaw = (result.data as { skeleton?: unknown }).skeleton;
  const parsed = parseKnowledgeSkeletonV1Response(skeletonRaw);
  assertSemanticKnowledgeSkeletonV1(parsed);
  storeDebugSkeleton(parsed);
  return parsed;
}
