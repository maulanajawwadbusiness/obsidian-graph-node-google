import { AI_MODELS } from "../../config/aiModels";
import { LLM_LIMITS } from "./limits";

export type ValidationError = {
  ok: false;
  status: number;
  code: "bad_request" | "too_large";
  error: string;
};

export type PaperAnalyzeInput = {
  text: string;
  nodeCount: number;
  model: string;
};

export type ChatInput = {
  userPrompt: string;
  model: string;
  systemPrompt?: string;
  context: {
    nodeLabel?: string | null;
    documentText?: string | null;
    documentTitle?: string | null;
    recentHistory?: Array<{ role: "user" | "ai"; text: string }>;
  };
};

export type PrefillInput = {
  nodeLabel: string;
  model: string;
  miniChatMessages?: Array<{ role: "user" | "ai"; text: string }>;
  content?: { title: string; summary: string } | null;
};

const ALLOWED_MODELS = new Set<string>([
  AI_MODELS.ANALYZER,
  AI_MODELS.CHAT,
  AI_MODELS.PREFILL
]);

function resolveModel(requested: unknown, fallback: string): string | ValidationError {
  if (requested !== undefined && requested !== null) {
    if (!isString(requested) || !ALLOWED_MODELS.has(requested)) {
      return invalidType("model");
    }
  }
  return fallback;
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function invalidType(field: string): ValidationError {
  return { ok: false, status: 400, code: "bad_request", error: `invalid ${field}` };
}

export function validatePaperAnalyze(body: any): PaperAnalyzeInput | ValidationError {
  if (!body || typeof body !== "object") return invalidType("body");
  if (!isString(body.text)) return invalidType("text");
  if (body.text.length === 0) return invalidType("text");
  if (body.text.length > LLM_LIMITS.paperAnalyzeTextMax) {
    return { ok: false, status: 413, code: "too_large", error: "text too large" };
  }

  const nodeCountRaw = body.nodeCount ?? LLM_LIMITS.paperAnalyzeNodeCountMin;
  const nodeCount = Number(nodeCountRaw);
  if (!Number.isFinite(nodeCount)) return invalidType("nodeCount");
  if (nodeCount < LLM_LIMITS.paperAnalyzeNodeCountMin || nodeCount > LLM_LIMITS.paperAnalyzeNodeCountMax) {
    return {
      ok: false,
      status: 400,
      code: "bad_request",
      error: "nodeCount out of range"
    };
  }

  const resolvedModel = resolveModel(body.model, AI_MODELS.ANALYZER);
  if (typeof resolvedModel !== "string") return resolvedModel;

  return { text: body.text, nodeCount, model: resolvedModel };
}

export function validateChat(body: any): ChatInput | ValidationError {
  if (!body || typeof body !== "object") return invalidType("body");
  if (!isString(body.userPrompt) || body.userPrompt.length === 0) return invalidType("userPrompt");
  if (body.userPrompt.length > LLM_LIMITS.chatUserPromptMax) {
    return { ok: false, status: 413, code: "too_large", error: "userPrompt too large" };
  }

  const resolvedModel = resolveModel(body.model, AI_MODELS.CHAT);
  if (typeof resolvedModel !== "string") return resolvedModel;

  const context = body.context && typeof body.context === "object" ? body.context : {};
  const systemPrompt = isString(body.systemPrompt) ? body.systemPrompt : undefined;
  if (systemPrompt && systemPrompt.length > LLM_LIMITS.chatSystemPromptMax) {
    return { ok: false, status: 413, code: "too_large", error: "systemPrompt too large" };
  }

  const nodeLabel = isString(context.nodeLabel) ? context.nodeLabel : null;
  if (nodeLabel && nodeLabel.length > LLM_LIMITS.nodeLabelMax) {
    return { ok: false, status: 413, code: "too_large", error: "nodeLabel too large" };
  }

  const documentText = isString(context.documentText) ? context.documentText : null;
  if (documentText && documentText.length > LLM_LIMITS.chatDocumentTextMax) {
    return { ok: false, status: 413, code: "too_large", error: "documentText too large" };
  }

  const recentHistory = Array.isArray(context.recentHistory) ? context.recentHistory : [];
  if (recentHistory.length > LLM_LIMITS.chatRecentHistoryMax) {
    return { ok: false, status: 413, code: "too_large", error: "recentHistory too large" };
  }
  for (const entry of recentHistory) {
    if (!entry || typeof entry !== "object") return invalidType("recentHistory");
    if (entry.role !== "user" && entry.role !== "ai") return invalidType("recentHistory.role");
    if (!isString(entry.text)) return invalidType("recentHistory.text");
    if (entry.text.length > LLM_LIMITS.chatMessageMax) {
      return { ok: false, status: 413, code: "too_large", error: "recentHistory text too large" };
    }
  }

  return {
    userPrompt: body.userPrompt,
    model: resolvedModel,
    systemPrompt,
    context: {
      nodeLabel,
      documentText,
      documentTitle: isString(context.documentTitle) ? context.documentTitle : null,
      recentHistory
    }
  };
}

export function validatePrefill(body: any): PrefillInput | ValidationError {
  if (!body || typeof body !== "object") return invalidType("body");
  if (!isString(body.nodeLabel) || body.nodeLabel.length === 0) return invalidType("nodeLabel");
  if (body.nodeLabel.length > LLM_LIMITS.nodeLabelMax) {
    return { ok: false, status: 413, code: "too_large", error: "nodeLabel too large" };
  }

  const resolvedModel = resolveModel(body.model, AI_MODELS.PREFILL);
  if (typeof resolvedModel !== "string") return resolvedModel;

  const content = body.content && typeof body.content === "object" ? body.content : null;
  if (content) {
    if (!isString(content.title) || !isString(content.summary)) return invalidType("content");
    if (content.summary.length > LLM_LIMITS.prefillContentMax) {
      return { ok: false, status: 413, code: "too_large", error: "content too large" };
    }
  }

  const miniChatMessages = Array.isArray(body.miniChatMessages) ? body.miniChatMessages : [];
  if (miniChatMessages.length > LLM_LIMITS.prefillMessagesMax) {
    return { ok: false, status: 413, code: "too_large", error: "miniChatMessages too large" };
  }
  for (const entry of miniChatMessages) {
    if (!entry || typeof entry !== "object") return invalidType("miniChatMessages");
    if (entry.role !== "user" && entry.role !== "ai") return invalidType("miniChatMessages.role");
    if (!isString(entry.text)) return invalidType("miniChatMessages.text");
    if (entry.text.length > LLM_LIMITS.chatMessageMax) {
      return { ok: false, status: 413, code: "too_large", error: "miniChatMessages text too large" };
    }
  }

  return {
    nodeLabel: body.nodeLabel,
    model: resolvedModel,
    miniChatMessages,
    content: content ?? null
  };
}
