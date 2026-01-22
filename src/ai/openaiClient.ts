/**
 * OpenAI Client Implementation
 * Uses OpenAI's Chat Completions API for text generation
 */

import type { LLMClient } from './clientTypes';

export class OpenAIClient implements LLMClient {
    private apiKey: string;
    private defaultModel: string;
    private baseUrl = 'https://api.openai.com/v1';

    constructor(apiKey: string, defaultModel: string = 'gpt-4o') {
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

        try {
            const response = await fetch(`${this.baseUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model,
                    messages: [
                        {
                            role: 'user',
                            content: prompt
                        }
                    ],
                    temperature,
                    max_tokens: maxTokens
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
            }

            const data = await response.json();
            const content = data.choices?.[0]?.message?.content;

            if (!content) {
                throw new Error('No content in OpenAI response');
            }

            return content;
        } catch (error) {
            console.error('[OpenAIClient] generateText failed:', error);
            throw error;
        }
    }

    async generateStructured<T>(
        schema: object,
        prompt: string,
        opts?: { model?: string; temperature?: number }
    ): Promise<T> {
        const model = opts?.model || this.defaultModel;
        const temperature = opts?.temperature ?? 0.7;

        // TODO: Implement OpenAI ChatCompletions API with JSON schema
        console.log('[OpenAIClient] generateStructured called:', { model, temperature });
        console.log('[OpenAIClient] Schema:', schema);
        console.log('[OpenAIClient] Prompt:', prompt);

        // Stub: return placeholder
        throw new Error('generateStructured not yet implemented');
    }
}
