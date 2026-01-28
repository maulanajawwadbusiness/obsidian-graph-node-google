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
        opts?: { model?: string; maxCompletionTokens?: number }
    ): Promise<string> {
        const model = opts?.model || this.defaultModel;
        const maxCompletionTokens = opts?.maxCompletionTokens ?? 1000;

        // TODO: Implement OpenRouter API call
        // Use fetch() with OpenRouter headers (Authorization, HTTP-Referer, X-Title)
        console.log('[OpenRouterClient] generateText called:', { model, maxCompletionTokens });
        console.log('[OpenRouterClient] Prompt:', prompt);

        // Stub: return placeholder
        return `[OpenRouter ${model} response to: ${prompt.substring(0, 50)}...]`;
    }

    async generateStructured<T>(
        schema: object,
        prompt: string,
        opts?: { model?: string }
    ): Promise<T> {
        const model = opts?.model || this.defaultModel;

        // TODO: Implement OpenRouter API call with JSON schema
        console.log('[OpenRouterClient] generateStructured called:', { model });
        console.log('[OpenRouterClient] Schema:', schema);
        console.log('[OpenRouterClient] Prompt:', prompt);

        // Stub: return placeholder
        throw new Error('generateStructured not yet implemented');
    }
}
