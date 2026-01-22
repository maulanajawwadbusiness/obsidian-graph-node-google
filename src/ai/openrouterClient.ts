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
        opts?: { model?: string; temperature?: number; maxTokens?: number }
    ): Promise<string> {
        const model = opts?.model || this.defaultModel;
        const temperature = opts?.temperature ?? 0.7;
        const maxTokens = opts?.maxTokens ?? 1000;
        const url = `${this.baseUrl}/chat/completions`;
        const hasApiKey = this.apiKey.length > 0;

        // TODO: Implement OpenRouter API call
        // Use fetch() with OpenRouter headers (Authorization, HTTP-Referer, X-Title)
        console.log('[OpenRouterClient] generateText called:', { model, temperature, maxTokens, url, hasApiKey });
        console.log('[OpenRouterClient] Prompt:', prompt);

        // Stub: return placeholder
        return `[OpenRouter ${model} response to: ${prompt.substring(0, 50)}...]`;
    }

    async generateStructured<T>(
        schema: object,
        prompt: string,
        opts?: { model?: string; temperature?: number }
    ): Promise<T> {
        const model = opts?.model || this.defaultModel;
        const temperature = opts?.temperature ?? 0.7;
        const url = `${this.baseUrl}/chat/completions`;
        const hasApiKey = this.apiKey.length > 0;

        // TODO: Implement OpenRouter API call with JSON schema
        console.log('[OpenRouterClient] generateStructured called:', { model, temperature, url, hasApiKey });
        console.log('[OpenRouterClient] Schema:', schema);
        console.log('[OpenRouterClient] Prompt:', prompt);

        // Stub: return placeholder
        throw new Error('generateStructured not yet implemented');
    }
}
