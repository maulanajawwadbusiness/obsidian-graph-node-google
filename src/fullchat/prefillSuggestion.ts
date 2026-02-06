import { getAiMode } from '../config/aiMode';
import { AI_MODELS } from '../config/aiModels';
import { t } from '../i18n/t';
import { getLang } from '../i18n/lang';
import { apiPost } from '../api';

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
        return t('ai.seedPromptNew', { label: nodeLabel });
    }

    return t('ai.seedPromptContinue', { label: nodeLabel });
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
        return getLang() === 'id'
            ? `Analisis "${nodeLabel}" dan jelaskan koneksinya dalam kerangka grafik.`
            : `Analyze "${nodeLabel}" and explain its connections within the graph framework.`;
    }

    const lastMsg = miniChatMessages[miniChatMessages.length - 1];
    const words = lastMsg.text.split(' ');
    const shortSummary = words.slice(0, 8).join(' ') + (words.length > 8 ? '...' : '');

    return getLang() === 'id'
        ? `Sintesis diskusi mengenai "${nodeLabel}", berfokus pada poin: "${shortSummary}"`
        : `Synthesize the discussion regarding "${nodeLabel}", focusing on the point: "${shortSummary}"`;
}

// =============================================================================
// REAL IMPLEMENTATION (gpt-4o)
// =============================================================================

const REAL_TIMEOUT_MS = 2500;

async function refinePromptWithReal(context: PrefillContext, options: { signal?: AbortSignal }): Promise<string> {
    try {
        const res = await withTimeoutAndAbort(
            apiPost('/api/llm/prefill', {
                model: AI_MODELS.PREFILL,
                nodeLabel: context.nodeLabel,
                miniChatMessages: context.miniChatMessages,
                content: context.content ?? null
            }),
            REAL_TIMEOUT_MS,
            options.signal
        );

        if (res.status === 401 || res.status === 403) {
            console.warn('[PrefillAI] unauthorized; please log in');
            return refinePromptMock(context, options);
        }

        if (!res.ok || !res.data || typeof res.data !== 'object') {
            console.warn('[PrefillAI] server response error, falling back to mock');
            return refinePromptMock(context, options);
        }

        const payload = res.data as { ok?: boolean; prompt?: string; text?: string };
        if (!payload.ok) {
            console.warn('[PrefillAI] server error, falling back to mock');
            return refinePromptMock(context, options);
        }

        const rawOutput = payload.prompt || payload.text || '';

        // Sanitize Output
        console.log(`[PrefillAI] raw_out len=${rawOutput?.length}`);
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
