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



    async * generateTextStream(
        prompt: string,
        opts?: { model?: string; temperature?: number; maxTokens?: number },
        signal?: AbortSignal
    ): AsyncGenerator<string, void, unknown> {
        const model = opts?.model || this.defaultModel;
        const isFixedTemperatureModel = isFixedTemperatureOnlyModel(model);
        let temperature = opts?.temperature ?? 0.7;
        if (isFixedTemperatureModel && temperature !== 1) {
            console.warn(`[OpenAIClient] Model ${model} only supports temperature=1; coercing.`);
            temperature = 1;
        }
        const maxTokens = opts?.maxTokens ?? 1000;

        console.log(`[chatStream] start model=${model}`);

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
                        { role: 'user', content: prompt }
                    ],
                    temperature,
                    max_completion_tokens: maxTokens,
                    stream: true
                }),
                signal
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
            }

            if (!response.body) throw new Error('No response body');

            const reader = response.body.getReader();
            const decoder = new TextDecoder('utf-8');
            let buffer = '';

            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split('\n\n');

                    // Keep the last partial chunk in the buffer
                    buffer = lines.pop() || '';

                    for (const line of lines) {
                        const trimmed = line.trim();
                        if (!trimmed.startsWith('data: ')) continue;

                        const data = trimmed.slice(6); // Remove 'data: '

                        if (data === '[DONE]') return;

                        try {
                            const json = JSON.parse(data);
                            const content = json.choices?.[0]?.delta?.content;
                            if (content) {
                                yield content;
                            }
                        } catch (e) {
                            // Ignore parse errors for individual chunks (resilience)
                            // Often caused by keep-alives or malformed frames
                        }
                    }
                }
            } finally {
                reader.releaseLock();
            }

            console.log('[chatStream] done');

        } catch (error) {
            if (signal?.aborted || (error instanceof Error && error.name === 'AbortError')) {
                console.log('[chatStream] abort');
                return; // Clean exit
            }
            console.error('[chatStream] error', error);
            throw error;
        }
    }

    async generateText(
        prompt: string,
        opts?: { model?: string; temperature?: number; maxTokens?: number }
    ): Promise<string> {
        // Optional Clean Move: Consume the stream to implement the blocking call
        // This ensures consistent logic for both modes.
        const generator = this.generateTextStream(prompt, opts);
        let fullText = '';
        for await (const chunk of generator) {
            fullText += chunk;
        }
        return fullText;
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

function isFixedTemperatureOnlyModel(model: string): boolean {
    const normalized = model.trim().toLowerCase();
    return normalized.startsWith('gpt-4o') || normalized.startsWith('o1') || normalized.startsWith('o3');
}
