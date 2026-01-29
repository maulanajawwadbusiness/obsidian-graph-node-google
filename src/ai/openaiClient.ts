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
        this.defaultModel = defaultModel || 'gpt-5';
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
                    ...(model.startsWith('gpt-5') ? {} : { temperature }),
                    max_output_tokens: maxTokens,
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

            let eventCount = 0;
            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    const chunkStr = decoder.decode(value, { stream: true });
                    buffer += chunkStr;

                    // Split by double newline to get identifying frames
                    const frames = buffer.split('\n\n');
                    buffer = frames.pop() || '';

                    for (const frame of frames) {
                        const lines = frame.split('\n');
                        let eventName = '';
                        let dataBuffer = '';

                        for (const line of lines) {
                            const trimmed = line.trim();
                            if (trimmed.startsWith('event: ')) {
                                eventName = trimmed.slice(7).trim();
                            } else if (trimmed.startsWith('data: ')) {
                                dataBuffer += trimmed.slice(6);
                            }
                        }

                        if (!dataBuffer) continue;
                        if (dataBuffer === '[DONE]') return;

                        try {
                            const event = JSON.parse(dataBuffer);

                            // Debug Log (First 20)
                            if (eventCount < 20) {
                                console.log(`[ResponsesStream] evt#${eventCount} type=${event.type || eventName}`);
                                eventCount++;
                            }

                            if (event.type === 'response.output_text.delta') {
                                yield event.delta;
                            } else if (event.type === 'response.output_item.done') {
                                // Fallback: If no deltas were sent, extract text from the completed item
                                if (event.item?.type === 'message' && event.item.role === 'assistant') {
                                    if (Array.isArray(event.item.content)) {
                                        for (const content of event.item.content) {
                                            if (content.type === 'output_text' && content.text) {
                                                console.log('[ResponsesStream] yielding output_item.done text');
                                                yield content.text;
                                            }
                                        }
                                    }
                                }
                            } else if (event.type === 'response.incomplete') {
                                console.warn('[ResponsesStream] response.incomplete', event);
                            }

                        } catch (e) {
                            console.log('[ResponsesStream] parse_error', dataBuffer.substring(0, 50));
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
                    ...(model.startsWith('gpt-5') ? {} : { temperature }),
                    max_output_tokens: opts?.maxCompletionTokens,
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
                    ...(model.startsWith('gpt-5') ? {} : { temperature }),
                    text: {
                        format: {
                            type: 'json_schema',
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

            // 1. Debug Log (Deep Scan)
            console.log(`[OpenAIClient] structured response scan id=${data.id} status=${response.status}`);
            if (Array.isArray(data.output)) {
                data.output.forEach((item: any, i: number) => {
                    console.log(`[OpenAIClient] output[${i}] type=${item.type} role=${item.role} contentLen=${item.content?.length}`);
                    if (Array.isArray(item.content)) {
                        item.content.forEach((sub: any, j: number) => {
                            const keys = Object.keys(sub).join(',');
                            const preview = (sub.text || sub.value || sub.delta || '').substring(0, 50);
                            console.log(`[OpenAIClient] .. content[${j}] type=${sub.type} keys=[${keys}] preview="${preview}"`);
                        });
                    }
                });
            }

            // 2. Refusal / Error Handling
            if (data.refusal) throw new Error(`Model Refusal: ${data.refusal}`);
            if (data.error) throw new Error(`API Error: ${JSON.stringify(data.error)}`);

            // 3. Robust Extraction (Helper Logic Inline)
            let jsonString = '';

            const extractText = (obj: any) => {
                if (!obj) return;
                // Priority keys for text content
                if (typeof obj.text === 'string') jsonString += obj.text;
                else if (typeof obj.value === 'string') jsonString += obj.value;
                else if (typeof obj.delta === 'string') jsonString += obj.delta;
            };

            // Path A: Top-level output_text
            if (typeof data.output_text === 'string') {
                jsonString = data.output_text;
            }
            // Path B: Scan output array
            else if (Array.isArray(data.output)) {
                for (const item of data.output) {
                    // 1. Check item itself (flat text block)
                    if (item.type === 'text' || item.type === 'output_text') {
                        extractText(item);
                    }
                    // 2. Check content array (message style)
                    if (Array.isArray(item.content)) {
                        for (const sub of item.content) {
                            extractText(sub);
                        }
                    }
                    // 3. Check nested text value (some shapes)
                    if (item.text && typeof item.text === 'object') {
                        extractText(item.text); // e.g. text.value
                    }
                }
            }

            if (!jsonString) {
                console.error('[OpenAIClient] Failed to extract JSON. Dump:', JSON.stringify(data.output || data).substring(0, 1000));
                throw new Error(`No content in structured response. ID: ${data.id} OutputLen: ${data.output?.length}`);
            }

            return JSON.parse(jsonString) as T;

        } catch (error) {
            console.error('[OpenAIClient] generateStructured failed:', error);
            throw error;
        }
    }
}
