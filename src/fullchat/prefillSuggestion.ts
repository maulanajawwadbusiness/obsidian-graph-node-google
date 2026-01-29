import { createLLMClient } from '../ai';
import { getAiMode } from '../config/aiMode';

export interface MiniChatHistory {
    role: 'user' | 'ai';
    text: string;
}

export interface PrefillContext {
    nodeLabel: string;
    miniChatMessages: MiniChatHistory[];
    content?: { title: string; summary: string } | null;
}

/**
 * Generates an instantaneous seed prompt based on local heuristics.
 * This MUST be fast (sync string ops only).
 */
export function makeSeedPrompt(context: PrefillContext): string {
    const { nodeLabel, miniChatMessages } = context;

    if (!miniChatMessages || miniChatMessages.length === 0) {
        return `Tell me more about "${nodeLabel}"`;
    }

    return `In context of "${nodeLabel}", continuing...`;
}

/**
 * Simulates an async refinement step (e.g. calling an LLM to summarize/contextualize).
 * Returns a "better" prompt.
 */
export async function refinePromptAsync(context: PrefillContext, options: { signal?: AbortSignal }): Promise<string> {
    const mode = getAiMode();

    if (mode === 'real') {
        console.log('[Prefill] refine_starting mode=real model=gpt-4o');
        return refinePromptWithReal(context, options);
    } else {
        console.log('[Prefill] refine_starting mode=mock');
        return refinePromptMock(context, options);
    }
}

// =============================================================================
// MOCK IMPLEMENTATION
// =============================================================================

async function refinePromptMock(context: PrefillContext, options: { signal?: AbortSignal }): Promise<string> {
    const { nodeLabel, miniChatMessages } = context;

    // Simulate network/processing delay (150-400ms range)
    const delay = 150 + Math.random() * 250;

    if (options.signal?.aborted) throw new Error('Aborted');
    await new Promise(resolve => setTimeout(resolve, delay));
    if (options.signal?.aborted) throw new Error('Aborted');

    // Mock refinement logic
    if (!miniChatMessages || miniChatMessages.length === 0) {
        return `Analyze "${nodeLabel}" and explain its connections within the graph framework.`;
    }

    const lastMsg = miniChatMessages[miniChatMessages.length - 1];
    const words = lastMsg.text.split(' ');
    const shortSummary = words.slice(0, 8).join(' ') + (words.length > 8 ? '...' : '');

    return `Synthesize the discussion regarding "${nodeLabel}", focusing on the point: "${shortSummary}"`;
}

// =============================================================================
// REAL IMPLEMENTATION (gpt-4o)
// =============================================================================

const REAL_TIMEOUT_MS = 2500;

async function refinePromptWithReal(context: PrefillContext, options: { signal?: AbortSignal }): Promise<string> {
    const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
    if (!apiKey) {
        console.warn('[PrefillAI] missing VITE_OPENAI_API_KEY, falling back to mock');
        return refinePromptMock(context, options);
    }

    try {
        const client = createLLMClient({
            apiKey,
            mode: 'openai',
            defaultModel: 'gpt-4o'
        });

        const prompt = buildRefinePacket(context);

        // System Prompt
        const systemPrompt = `You are generating ONE suggested prompt to prefill a chat input.
Rules:
- One line only.
- Actionable and specific to the node.
- No prefixes like "suggested prompt:".
- No quotes.
- Max 160 characters.
- Tone: calm, analytical, dark-elegant.
- Return ONLY the prompt text.`;

        // Execute with timeout and abort support
        const rawOutput = await withTimeoutAndAbort(
            client.generateText(
                `${systemPrompt}\n\nCONTEXT:\n${prompt}`,
                { model: 'gpt-4o', maxCompletionTokens: 60, temperature: 0.3 }
            ),
            REAL_TIMEOUT_MS,
            options.signal
        );

        // Sanitize Output
        const sanitized = sanitizeOutput(rawOutput);

        if (!sanitized) {
            console.warn('[PrefillAI] received empty output from AI, falling back to mock');
            return refinePromptMock(context, options);
        }

        return sanitized;

    } catch (err) {
        // If aborted, throw cleanly so Store ignores it
        if (options.signal?.aborted || (err instanceof Error && err.name === 'AbortError')) {
            throw err;
        }

        // On real errors (timeout, network), warn and fallback
        console.warn('[PrefillAI] real refine failed or timed out, falling back to mock', err);
        return refinePromptMock(context, options);
    }
}

/**
 * Packs context into a minimal string for the LLM
 */
function buildRefinePacket(context: PrefillContext): string {
    const { nodeLabel, miniChatMessages, content } = context;

    let packet = `Target Node: ${nodeLabel}\n`;
    if (content) {
        packet += `Node Knowledge: "${content.title}" - ${content.summary.slice(0, 150)}...\n`;
    }

    // Add recent history (last 4 turns)
    if (miniChatMessages && miniChatMessages.length > 0) {
        const recent = miniChatMessages.slice(-4);
        packet += `Recent Chat History:\n`;
        recent.forEach(msg => {
            const role = msg.role.toUpperCase();
            const text = msg.text.length > 300 ? msg.text.slice(0, 300) + '...' : msg.text;
            packet += `${role}: ${text}\n`;
        });
    } else {
        packet += `(No previous chat history)\n`;
    }

    return packet;
}

/**
 * Sanitizes LLM output to ensure it fits the UI contract
 */
function sanitizeOutput(text: string): string {
    if (!text) return '';

    // Remove quotes if the simple model adds them
    let clean = text.trim();
    if (clean.startsWith('"') && clean.endsWith('"')) {
        clean = clean.slice(1, -1);
    }

    // Collapse whitespace / newlines
    clean = clean.replace(/\s+/g, ' ');

    // Hard truncate
    if (clean.length > 160) {
        clean = clean.slice(0, 160).trim();
    }

    return clean;
}

/**
 * Wraps a promise with a timeout and abort signal check
 */
async function withTimeoutAndAbort<T>(promise: Promise<T>, timeoutMs: number, signal?: AbortSignal): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        // 1. Abort Check
        if (signal?.aborted) return reject(new DOMException('Aborted', 'AbortError'));

        // 2. Setup Timeout
        const timer = setTimeout(() => {
            reject(new Error('Timeout'));
        }, timeoutMs);

        // 3. Setup Abort Listener
        const onAbort = () => {
            clearTimeout(timer);
            reject(new DOMException('Aborted', 'AbortError'));
        };
        signal?.addEventListener('abort', onAbort);

        // 4. Run Promise
        promise.then(
            (res) => {
                clearTimeout(timer);
                signal?.removeEventListener('abort', onAbort);
                resolve(res);
            },
            (err) => {
                clearTimeout(timer);
                signal?.removeEventListener('abort', onAbort);
                reject(err);
            }
        );
    });
}
