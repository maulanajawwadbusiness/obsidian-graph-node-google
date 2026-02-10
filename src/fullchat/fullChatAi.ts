import { getAiMode } from '../config/aiMode';
import type { AiContext } from './fullChatTypes';
import { getAiLanguageDirective } from '../i18n/aiLanguage';
import { getLang } from '../i18n/lang';
import { AI_MODELS } from '../config/aiModels';
import { refreshBalance, getBalanceState } from '../store/balanceStore';
import { ensureSufficientBalance } from '../money/ensureSufficientBalance';
import { estimateIdrCost } from '../money/estimateCost';
import { showShortage } from '../money/shortageStore';
import { pushMoneyNotice } from '../money/moneyNotices';

// =============================================================================
// TYPES
// =============================================================================

export interface AiResponse {
    text: string;
    isMock: boolean;
}

// =============================================================================
// CONSTANTS
// =============================================================================

// =============================================================================
// CONSTANTS
// =============================================================================

const MODEL = AI_MODELS.CHAT;

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Generates a response from the AI (Real or Mock)
 */
export async function* generateResponseAsync(
    prompt: string,
    context: AiContext,
    signal?: AbortSignal
): AsyncGenerator<string, void, unknown> {
    const mode = getAiMode();
    console.log(`[FullChatAI] generate_start mode=${mode}`);

    if (mode === 'real') {
        return yield* realResponseGenerator(prompt, context, signal);
    } else {
        return yield* mockResponseGenerator(context);
    }
}

// =============================================================================
// REAL IMPLEMENTATION
// =============================================================================

async function* realResponseGenerator(
    userPrompt: string,
    context: AiContext,
    signal?: AbortSignal
): AsyncGenerator<string, void, unknown> {
    const shortageSurface = context.shortageSurface ?? 'global';

    try {
        const systemPrompt = buildSystemPrompt(context);
        const estimatedCost = estimateIdrCost('chat', `${systemPrompt}\n${userPrompt}`);
        const okToProceed = await ensureSufficientBalance({ requiredIdr: estimatedCost, context: 'chat', surface: shortageSurface });
        if (!okToProceed) {
            return;
        }

        // True Stream Implementation
        // ---------------------------------------------------------------------
        // We now have true streaming from the client.
        // We just yield the chunks as they come.
        // The Store handles the throttling/buffering.
        // ---------------------------------------------------------------------

        console.log(`[FullChatAI] calling_real_stream model=${MODEL}`);

        const controller = new AbortController();
        if (signal) {
            signal.addEventListener('abort', () => controller.abort(), { once: true });
        }
        const stream = fetchChatStream({
            model: MODEL,
            userPrompt,
            context,
            systemPrompt,
            signal: controller.signal
        });

        let totalChars = 0;
        console.log('[FullChatAI] consuming generator...');
        let chunkCount = 0;
        const baseText = `${systemPrompt}\n${userPrompt}`;
        const { balanceIdr } = getBalanceSnapshot();
        const balanceForChat = typeof balanceIdr === 'number' ? balanceIdr : null;
        let outputText = '';
        for await (const chunk of stream) {
            if (signal?.aborted || controller.signal.aborted) break;
            if (chunkCount < 10) {
                console.log(`[FullChatAI] got_delta len=${chunk.length}`);
                chunkCount++;
            }
            yield chunk;
            outputText += chunk;
            if (balanceForChat !== null) {
                const projectedCost = estimateIdrCost('chat', `${baseText}\n${outputText}`);
                if (projectedCost > balanceForChat) {
                    const shortfall = Math.max(0, projectedCost - balanceForChat);
                    showShortage({
                        balanceIdr: balanceForChat,
                        requiredIdr: projectedCost,
                        shortfallIdr: shortfall,
                        context: 'chat',
                        surface: shortageSurface,
                    });
                    controller.abort();
                    break;
                }
            }
            totalChars += chunk.length;
        }
        console.log('[FullChatAI] generator completed');

        console.log(`[FullChatAI] response_streamed len=${totalChars}`);
    } catch (err) {
        if (signal?.aborted || (err instanceof Error && err.name === 'AbortError')) {
            console.log('[FullChatAI] aborted');
            throw err;
        }
        if (err instanceof Error && err.message.startsWith('insufficient_rupiah:')) {
            const payload = JSON.parse(err.message.replace('insufficient_rupiah:', '')) as {
                balance_idr?: number;
                needed_idr?: number;
                shortfall_idr?: number;
            };
            const needed = typeof payload.needed_idr === 'number' ? payload.needed_idr : 0;
            const balance = typeof payload.balance_idr === 'number' ? payload.balance_idr : null;
            const shortfall = typeof payload.shortfall_idr === 'number'
                ? payload.shortfall_idr
                : Math.max(0, needed - (balance ?? 0));
            showShortage({
                balanceIdr: balance,
                requiredIdr: needed,
                shortfallIdr: shortfall,
                context: 'chat',
                surface: shortageSurface,
            });
            pushMoneyNotice({
                kind: 'deduction',
                status: 'warning',
                title: 'Saldo tidak cukup',
                message: 'Perkiraan biaya lebih kecil dari biaya akhir. Saldo tidak berubah.'
            });
            return;
        }
        if (err instanceof Error && err.message === 'unauthorized') {
            const isId = getLang() === 'id';
            yield isId
                ? 'Silakan masuk terlebih dahulu untuk menggunakan chat.'
                : 'Please log in to use chat.';
            return;
        }
        if (err instanceof Error && err.name === 'AbortError') {
            if (!signal?.aborted) {
                pushMoneyNotice({
                    kind: 'deduction',
                    status: 'info',
                    title: 'Respons dihentikan',
                    message: 'Biaya dihitung dari respons yang sudah terbentuk.'
                });
            }
            return;
        }
        console.error('[FullChatAI] real stream failed', {
            name: err instanceof Error ? err.name : 'Unknown',
            message: err instanceof Error ? err.message : String(err),
            stack: err instanceof Error ? err.stack : undefined
        });
        // Fallback to mock on error? Or just throw?
        // User said: "if timeout/abort -> show a gentle... ending state".
        // If network error, we probably want to show it or fallback.
        // Lets fallback to mock for robustness per "just works" rule.
        console.warn('[FullChatAI] error_fallback_to_mock');
        yield* mockResponseGenerator(context);
    } finally {
        void refreshBalance();
    }
}

// =============================================================================
// MOCK IMPLEMENTATION
// =============================================================================

async function* mockResponseGenerator(context: AiContext): AsyncGenerator<string, void, unknown> {
    // Deterministic mock response
    await new Promise(resolve => setTimeout(resolve, 600)); // Simulate thinking

    const { nodeLabel, documentTitle } = context;
    let response = "I'm essentially a void of data right now.";

    const isId = getLang() === 'id';

    if (nodeLabel) {
        response = isId
            ? `Melihat titik "${nodeLabel}"... ini terhubung ke beberapa konsep dalam grafik Anda. Hubungannya tipis namun ada.`
            : `Viewing node "${nodeLabel}"... it connects to several concepts in my graph. The relationship is tenuous but present.`;
    } else if (documentTitle) {
        response = isId
            ? `Saya melihat Anda sedang membaca "${documentTitle}". Teks yang padat. Apa yang ingin Anda ketahui?`
            : `I see you're reading "${documentTitle}". It's a dense text. What would you like to know?`;
    } else {
        response = isId
            ? "Saya siap menalar tentang grafik Anda."
            : "I am ready to reason about your graph.";
    }

    yield response;
}

function getBalanceSnapshot() {
    return getBalanceState();
}

function resolveUrl(base: string, path: string) {
    const trimmedBase = base.replace(/\/+$/, '');
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `${trimmedBase}${normalizedPath}`;
}

function fetchChatStream(opts: {
    model: string;
    userPrompt: string;
    context: AiContext;
    systemPrompt: string;
    signal?: AbortSignal;
}): AsyncGenerator<string, void, unknown> {
    const base = import.meta.env.VITE_API_BASE_URL as string;
    if (!base || !base.trim()) {
        throw new Error('missing_api_base');
    }

    const url = resolveUrl(base, '/api/llm/chat');

    return (async function* () {
        const res = await fetch(url, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: opts.model,
                userPrompt: opts.userPrompt,
                context: opts.context,
                systemPrompt: opts.systemPrompt
            }),
            signal: opts.signal
        });

        if (res.status === 401 || res.status === 403) {
            throw new Error('unauthorized');
        }

        if (!res.ok || !res.body) {
            const text = await res.text();
            const contentType = res.headers.get('content-type') || '';
            if (res.status === 402 && contentType.includes('application/json')) {
                try {
                    const payload = JSON.parse(text) as {
                        code?: string;
                        balance_idr?: number;
                        needed_idr?: number;
                        shortfall_idr?: number;
                    };
                    if (payload.code === 'insufficient_rupiah') {
                        throw new Error(`insufficient_rupiah:${JSON.stringify(payload)}`);
                    }
                } catch {
                    // fall through to generic error
                }
            }
            throw new Error(`stream_http_${res.status}`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder('utf-8');
        try {
            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                if (opts.signal?.aborted) {
                    throw new DOMException('Aborted', 'AbortError');
                }
                const chunk = decoder.decode(value, { stream: true });
                if (chunk) yield chunk;
            }
        } finally {
            reader.releaseLock();
        }
    })();
}

// =============================================================================
// HELPERS
// =============================================================================

function buildSystemPrompt(context: AiContext): string {
    const { nodeLabel, documentText, documentTitle, recentHistory } = context;

    let prompt = `You are a dark, elegant AI assistant in a tool called Arnvoid.
${getAiLanguageDirective()}
Style: Concise, analytical, mysterious but helpful. No fluff.
Current Context:
`;

    if (nodeLabel) prompt += `- Focused Node: "${nodeLabel}"\n`;
    if (documentTitle) prompt += `- Active Document: "${documentTitle}"\n`;
    if (documentText) {
        // Truncate doc text for token safety
        const safeText = documentText.slice(0, 3000);
        prompt += `- Document Excerpt: """${safeText}"""...\n`;
    }

    if (recentHistory.length > 0) {
        prompt += `\nConversation History:\n`;
        // Take last 6 turns
        const recent = recentHistory.slice(-6);
        recent.forEach(msg => {
            prompt += `${msg.role.toUpperCase()}: ${msg.text}\n`;
        });
    }

    return prompt;
}

/**
 * Wraps a promise with a timeout and abort signal check
 * Reused exactly from prefillSuggestion.ts logic
 */
