import express from "express";
import { mapModel } from "../llm/models/modelMap";
import { pickProviderForRequest } from "../llm/providerRouter";
import type { AuthContext } from "../app/deps";
import { validateChat, type ChatInput, type ValidationError } from "../llm/validate";
import { requireAuth } from "../middleware/requireAuth";

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

function buildChatInput(validation: ChatInput): string {
  const pieces: string[] = [];
  if (validation.systemPrompt) pieces.push(`System: ${validation.systemPrompt}`);
  if (validation.context?.documentTitle) pieces.push(`Document title: ${validation.context.documentTitle}`);
  if (validation.context?.nodeLabel) pieces.push(`Focused node: ${validation.context.nodeLabel}`);
  if (validation.context?.documentText) pieces.push(`Document excerpt:\n${validation.context.documentText}`);
  if (Array.isArray(validation.context?.recentHistory) && validation.context.recentHistory.length > 0) {
    pieces.push("History:");
    for (const item of validation.context.recentHistory.slice(-8)) {
      pieces.push(`- ${item.role}: ${item.text}`);
    }
  }
  pieces.push(`User: ${validation.userPrompt}`);
  return pieces.join("\n\n");
}

export function registerLlmChatRoutes(app: express.Express) {
  app.post("/api/llm/chat", requireAuth, async (req, res) => {
    const validation = validateChat(req.body);
    if (isValidationError(validation)) {
      res.status(validation.status).json(validation);
      return;
    }

    try {
      const user = res.locals.user as AuthContext;
      const picked = await pickProviderForRequest({ userId: String(user.id), endpointKind: "chat" });
      const providerModelId = mapModel(picked.selectedProviderName, validation.model);
      const input = buildChatInput(validation);
      const stream = picked.provider.generateTextStream({ model: providerModelId as any, input });

      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      for await (const chunk of stream) {
        res.write(chunk);
      }
      res.end();
    } catch (e: any) {
      const status = mapLlmErrorToStatus(e?.info || e);
      if (!res.headersSent) {
        res.status(status).json({ ok: false, error: String(e?.message || e) });
      } else {
        res.end();
      }
    }
  });
}
