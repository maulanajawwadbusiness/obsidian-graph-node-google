import { DEFAULT_LOGICAL_MODELS, type LogicalModel } from "./models/logicalModels";
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
  mode: "classic" | "skeleton_v1";
  model: LogicalModel;
  lang?: "id" | "en";
  submitted_word_count?: number;
};

export type ChatInput = {
  userPrompt: string;
  model: LogicalModel;
  systemPrompt?: string;
  submitted_word_count?: number;
  context: {
    nodeLabel?: string | null;
    documentText?: string | null;
    documentTitle?: string | null;
    recentHistory?: Array<{ role: "user" | "ai"; text: string }>;
  };
};

export type PrefillInput = {
  nodeLabel: string;
  model: LogicalModel;
  submitted_word_count?: number;
  miniChatMessages?: Array<{ role: "user" | "ai"; text: string }>;
  content?: { title: string; summary: string } | null;
};

const ALLOWED_MODELS = new Set<LogicalModel>([
  DEFAULT_LOGICAL_MODELS.analyze,
  DEFAULT_LOGICAL_MODELS.chat,
  DEFAULT_LOGICAL_MODELS.prefill
]);

function resolveModel(requested: unknown, fallback: LogicalModel): LogicalModel | ValidationError {
  if (requested !== undefined && requested !== null) {
    if (!isString(requested)) return invalidType("model");
    if (!ALLOWED_MODELS.has(requested as LogicalModel)) return invalidType("model");
    return requested as LogicalModel;
  }
  return fallback;
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function invalidType(field: string): ValidationError {
  return { ok: false, status: 400, code: "bad_request", error: `invalid ${field}` };
}

function parseSubmittedWordCount(body: any): number | ValidationError | undefined {
  if (body?.submitted_word_count === undefined) return undefined;
  const parsed = Number(body.submitted_word_count);
  if (!Number.isFinite(parsed)) return invalidType("submitted_word_count");
  if (!Number.isInteger(parsed)) return invalidType("submitted_word_count");
  if (parsed < 0) return invalidType("submitted_word_count");
  return parsed;
}

export function validatePaperAnalyze(body: any): PaperAnalyzeInput | ValidationError {
  if (!body || typeof body !== "object") return invalidType("body");
  if (!isString(body.text)) return invalidType("text");
  if (body.text.length === 0) return invalidType("text");
  if (body.text.length > LLM_LIMITS.paperAnalyzeTextMax) {
    return { ok: false, status: 413, code: "too_large", error: "text too large" };
  }

  let mode: "classic" | "skeleton_v1" = "classic";
  if (body.mode !== undefined) {
    if (!isString(body.mode)) return invalidType("mode");
    if (body.mode !== "classic" && body.mode !== "skeleton_v1") return invalidType("mode");
    mode = body.mode;
  }

  const nodeCountRaw = body.nodeCount ?? LLM_LIMITS.paperAnalyzeNodeCountMin;
  const nodeCount = Number(nodeCountRaw);
  if (mode === "classic") {
    if (!Number.isFinite(nodeCount)) return invalidType("nodeCount");
    if (nodeCount < LLM_LIMITS.paperAnalyzeNodeCountMin || nodeCount > LLM_LIMITS.paperAnalyzeNodeCountMax) {
      return {
        ok: false,
        status: 400,
        code: "bad_request",
        error: "nodeCount out of range"
      };
    }
  }

  const resolvedModel = resolveModel(body.model, DEFAULT_LOGICAL_MODELS.analyze);
  if (typeof resolvedModel !== "string") return resolvedModel;

  let lang: "id" | "en" | undefined;
  if (body.lang !== undefined) {
    if (!isString(body.lang)) return invalidType("lang");
    if (body.lang !== "id" && body.lang !== "en") return invalidType("lang");
    lang = body.lang;
  }

  const submittedWordCountParsed = parseSubmittedWordCount(body);
  if (submittedWordCountParsed !== undefined && typeof submittedWordCountParsed !== "number") {
    return submittedWordCountParsed;
  }
  const submittedWordCount = submittedWordCountParsed as number | undefined;

  return {
    text: body.text,
    nodeCount: Number.isFinite(nodeCount) ? nodeCount : LLM_LIMITS.paperAnalyzeNodeCountMin,
    mode,
    model: resolvedModel,
    lang,
    submitted_word_count: submittedWordCount
  };
}

export function validateChat(body: any): ChatInput | ValidationError {
  if (!body || typeof body !== "object") return invalidType("body");
  if (!isString(body.userPrompt) || body.userPrompt.length === 0) return invalidType("userPrompt");
  if (body.userPrompt.length > LLM_LIMITS.chatUserPromptMax) {
    return { ok: false, status: 413, code: "too_large", error: "userPrompt too large" };
  }

  const resolvedModel = resolveModel(body.model, DEFAULT_LOGICAL_MODELS.chat);
  if (typeof resolvedModel !== "string") return resolvedModel;

  const context = body.context && typeof body.context === "object" ? body.context : {};
  const submittedWordCountParsed = parseSubmittedWordCount(body);
  if (submittedWordCountParsed !== undefined && typeof submittedWordCountParsed !== "number") {
    return submittedWordCountParsed;
  }
  const submittedWordCount = submittedWordCountParsed as number | undefined;
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
    submitted_word_count: submittedWordCount,
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

  const resolvedModel = resolveModel(body.model, DEFAULT_LOGICAL_MODELS.prefill);
  if (typeof resolvedModel !== "string") return resolvedModel;
  const submittedWordCountParsed = parseSubmittedWordCount(body);
  if (submittedWordCountParsed !== undefined && typeof submittedWordCountParsed !== "number") {
    return submittedWordCountParsed;
  }
  const submittedWordCount = submittedWordCountParsed as number | undefined;

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
    submitted_word_count: submittedWordCount,
    miniChatMessages,
    content: content ?? null
  };
}
