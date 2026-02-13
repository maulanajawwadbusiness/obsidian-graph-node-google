import express from "express";
import { buildAnalyzeJsonSchema, validateAnalyzeJson } from "../llm/analyze/schema";
import { runOpenrouterAnalyze } from "../llm/analyze/openrouterAnalyze";
import { buildStructuredAnalyzeInput } from "../llm/analyze/prompt";
import { mapModel } from "../llm/models/modelMap";
import { pickProviderForRequest } from "../llm/providerRouter";
import { validatePaperAnalyze, validatePrefill, type ValidationError } from "../llm/validate";
import { requireAuth } from "../middleware/requireAuth";
import type { AuthContext } from "../app/deps";

const ALLOW_OPENROUTER_ANALYZE = process.env.ALLOW_OPENROUTER_ANALYZE === "true";
const OPENROUTER_ANALYZE_MODELS = new Set(
  String(process.env.OPENROUTER_ANALYZE_MODELS || "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean)
);

function isValidationError(value: unknown): value is ValidationError {
  return Boolean(value && typeof value === "object" && (value as ValidationError).ok === false);
}

function mapLlmErrorToStatus(error: any): number {
  if (typeof error?.status === "number") return error.status;
  if (error?.code === "bad_request") return 400;
  if (error?.code === "unauthorized") return 401;
  if (error?.code === "rate_limited") return 429;
  return 502;
}

function isOpenrouterAnalyzeAllowed(model: string): boolean {
  if (!ALLOW_OPENROUTER_ANALYZE) return false;
  if (OPENROUTER_ANALYZE_MODELS.size === 0) return true;
  return OPENROUTER_ANALYZE_MODELS.has(model);
}

function buildPrefillInput(body: {
  nodeLabel: string;
  miniChatMessages?: Array<{ role: "user" | "ai"; text: string }>;
  content?: { title: string; summary: string } | null;
}): string {
  const lines: string[] = [];
  lines.push(`Node: ${body.nodeLabel}`);
  if (body.content?.title) lines.push(`Content title: ${body.content.title}`);
  if (body.content?.summary) lines.push(`Content summary: ${body.content.summary}`);
  if (Array.isArray(body.miniChatMessages) && body.miniChatMessages.length > 0) {
    lines.push("Mini chat:");
    for (const item of body.miniChatMessages.slice(-8)) lines.push(`- ${item.role}: ${item.text}`);
  }
  lines.push("Task: write one concise follow-up prompt for the full chat panel.");
  return lines.join("\n");
}

export function registerLlmAnalyzePrefillRoutes(app: express.Express) {
  app.post("/api/llm/paper-analyze", requireAuth, async (req, res) => {
    const validation = validatePaperAnalyze(req.body);
    if (isValidationError(validation)) {
      res.status(validation.status).json(validation);
      return;
    }

    const user = res.locals.user as AuthContext;
    const input = buildStructuredAnalyzeInput({ text: validation.text, nodeCount: validation.nodeCount, lang: validation.lang });

    try {
      const picked = await pickProviderForRequest({ userId: String(user.id), endpointKind: "analyze" });
      const providerModelId = mapModel(picked.selectedProviderName, validation.model);

      if (picked.selectedProviderName === "openrouter" && isOpenrouterAnalyzeAllowed(validation.model)) {
        const result = await runOpenrouterAnalyze({
          provider: picked.provider,
          model: providerModelId as any,
          input: validation.text,
          nodeCount: validation.nodeCount,
          lang: validation.lang,
        });
        if (!result.ok) {
          res.status(mapLlmErrorToStatus((result as any).error)).json(result);
          return;
        }
        res.json({ ok: true, json: result.json });
        return;
      }

      const schema = buildAnalyzeJsonSchema(validation.nodeCount);
      const result = await picked.provider.generateStructuredJson({
        model: providerModelId as any,
        input,
        schema,
      });
      if (!result.ok) {
        res.status(mapLlmErrorToStatus(result)).json(result);
        return;
      }
      const parsed = validateAnalyzeJson(result.json, validation.nodeCount);
      if (!parsed.ok) {
        const errors = (parsed as any).errors || ["invalid analyze output"];
        res.status(502).json({ ok: false, error: errors.join(", ") });
        return;
      }
      res.json({ ok: true, request_id: result.request_id, json: parsed.value });
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e) });
    }
  });

  app.post("/api/llm/prefill", requireAuth, async (req, res) => {
    const validation = validatePrefill(req.body);
    if (isValidationError(validation)) {
      res.status(validation.status).json(validation);
      return;
    }

    const user = res.locals.user as AuthContext;
    try {
      const picked = await pickProviderForRequest({ userId: String(user.id), endpointKind: "prefill" });
      const providerModelId = mapModel(picked.selectedProviderName, validation.model);
      const input = buildPrefillInput(validation);
      const result = await picked.provider.generateText({ model: providerModelId as any, input });
      if (!result.ok) {
        res.status(mapLlmErrorToStatus(result)).json(result);
        return;
      }
      res.json({ ok: true, request_id: result.request_id, prompt: result.text });
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e) });
    }
  });
}
