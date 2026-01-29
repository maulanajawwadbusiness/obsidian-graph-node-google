/**
 * OpenAI Client Implementation
 * Uses OpenAI's Chat Completions API for text generation
 */

import type { LLMClient } from './clientTypes';

export class OpenAIClient implements LLMClient {
    private apiKey: string;
    private defaultModel: string;
    private baseUrl = 'https://api.openai.com/v1';

    constructor(apiKey: string, defaultModel?: string) {
        this.apiKey = apiKey;
        this.defaultModel = defaultModel || 'gpt-5-nano';
    }

    async * generateTextStream(
        prompt: string,
        opts?: { model?: string; temperature?: number; maxCompletionTokens?: number },
        signal?: AbortSignal
    ): AsyncGenerator<string, void, unknown> {
        const model = opts?.model || this.defaultModel;
        const temperature = opts?.temperature ?? 0.7;
        const maxTokens = opts?.maxCompletionTokens;

        console.log(`[responsesStream] start model=${model}`);

        try {
            const response = await fetch(`${this.baseUrl}/responses`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model,
                    input: [{ role: 'user', content: prompt }],
                    temperature,
                    max_completion_tokens: maxTokens,
                    stream: true,
                    store: false
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
                            const event = JSON.parse(data);
                            // New Responses API streaming shape:
                            // event: "response.output_text.delta"
                            // data: { delta: "..." }

                            // Check for event type inside standard SSE data wrapping if any, 
                            // OR if OpenAI uses standard SSE "event: type" lines.
                            // Currently, Chat Completions puts everything in data payload.
                            // Let's assume Responses API does similar or standard SSE.
                            // Documentation says: listen for `response.output_text.delta`.

                            if (event.type === 'response.output_text.delta') {
                                yield event.delta;
                            }
                        } catch (e) {
                            // Ignore malformed
                        }
                    }
                }
            } finally {
                reader.releaseLock();
            }

            // RE-IMPLEMENTING ROBUST LOOP ABOVE TO AVOID 'buffer' SCOPE ISSUES IN PATCH
            // We'll use a robust reader loop here.

        } catch (error) {
            if (signal?.aborted || (error instanceof Error && error.name === 'AbortError')) {
                console.log('[responsesStream] abort');
                return;
            }
            console.error('[responsesStream] error', error);
            throw error;
        }
    }

    // Re-implementing methods fully to ensure clean state

    async generateText(
        prompt: string,
        opts?: { model?: string; temperature?: number; maxCompletionTokens?: number }
    ): Promise<string> {
        const model = opts?.model || this.defaultModel;
        const temperature = opts?.temperature ?? 0.7;

        try {
            const response = await fetch(`${this.baseUrl}/responses`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model,
                    input: [{ role: 'user', content: prompt }],
                    temperature,
                    max_completion_tokens: opts?.maxCompletionTokens,
                    store: false
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
            }

            const data = await response.json();
            // Responses API: output is an array. We usually want the first text output.
            // Adjust based on actural response shape: { output: [{ content: [{ type: 'text', text: '...' }] }] }
            // Simplifying assumption: data.output[0].content[0].text exists

            // Check for output_text at top level or nested
            // As per recon notes: traverse output[] and concat output_text

            // Safe traversal stub:
            let content = '';
            if (data.output_text) {
                content = data.output_text;
            } else if (Array.isArray(data.output)) {
                for (const item of data.output) {
                    if (item.content) {
                        for (const sub of item.content) {
                            if (sub.type === 'text') content += sub.text;
                        }
                    }
                }
            }

            if (!content && !data.output_text) {
                // Fallback if shape is different (e.g. choice[0] style from legacy?)
                // Responses API should be consistent.
                console.warn('[OpenAIClient] Unexpected response shape', data);
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
        const temperature = opts?.temperature ?? 0.3; // Lower temp for logic

        console.log('[OpenAIClient] generateStructured', { model });

        try {
            const response = await fetch(`${this.baseUrl}/responses`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model,
                    input: [{ role: 'user', content: prompt }],
                    temperature,
                    response_format: {
                        type: 'json_schema',
                        json_schema: {
                            name: 'structured_response',
                            schema: schema,
                            strict: true
                        }
                    },
                    store: false
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
            }

            const data = await response.json();

            // Extract usage of structured output
            // Should be in output[0].content[0].text as a JSON string
            let jsonString = '';
            if (Array.isArray(data.output)) {
                for (const item of data.output) {
                    if (item.content) {
                        for (const sub of item.content) {
                            if (sub.type === 'text') jsonString += sub.text;
                        }
                    }
                }
            }

            if (!jsonString) throw new Error('No content in structured response');

            return JSON.parse(jsonString) as T;

        } catch (error) {
            console.error('[OpenAIClient] generateStructured failed:', error);
            throw error;
        }
    }
}


