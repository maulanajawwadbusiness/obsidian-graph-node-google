/**
 * OpenRouter Client Implementation
 * Uses OpenRouter's unified API (compatible with OpenAI format)
 */

import type { LLMClient } from './clientTypes';

export class OpenRouterClient implements LLMClient {
    private apiKey: string;
    private defaultModel: string;
    private baseUrl = 'https://openrouter.ai/api/v1';

    constructor(apiKey: string, defaultModel: string = 'openai/gpt-4o') {
        this.apiKey = apiKey;
        this.defaultModel = defaultModel;
    }

    async generateText(
        prompt: string,
        opts?: { model?: string; temperature?: number; maxCompletionTokens?: number }
    ): Promise<string> {
        // For now, let's just make sure the signautre matches the new interface
        return "OpenRouter not fully implemented in this migration";
    }

    async * generateTextStream(
        prompt: string,
        opts?: { model?: string; temperature?: number; maxCompletionTokens?: number },
        signal?: AbortSignal
    ): AsyncGenerator<string, void, unknown> {
        // Stub for now as we are focusing on OpenAI migration
        yield "OpenRouter streaming not implemented yet.";
    }

    async generateStructured<T>(
        schema: object,
        prompt: string,
        opts?: { model?: string; temperature?: number }
    ): Promise<T> {
        throw new Error("OpenRouter structured output not implemented");
    }
}
