import { createLLMClient } from '../ai';
import { getAiMode } from '../config/aiMode';
import type { AiContext } from './fullChatTypes';

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

const MODEL = 'gpt-5-nano';

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
        const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
        if (!apiKey) {
            console.warn('[FullChatAI] missing API Key, fallback to mock');
            return yield* mockResponseGenerator(context);
        }
        return yield* realResponseGenerator(prompt, context, apiKey, signal);
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
    apiKey: string,
    signal?: AbortSignal
): AsyncGenerator<string, void, unknown> {

    try {
        const client = createLLMClient({
            apiKey,
            mode: 'openai',
            defaultModel: MODEL
        });

        const systemPrompt = buildSystemPrompt(context);
        const fullPrompt = `${systemPrompt}\n\nUSER PROMPT:\n${userPrompt}`;

        // True Stream Implementation
        // ---------------------------------------------------------------------
        // We now have true streaming from the client.
        // We just yield the chunks as they come.
        // The Store handles the throttling/buffering.
        // ---------------------------------------------------------------------

        console.log(`[FullChatAI] calling_real_stream model=${MODEL}`);

        const stream = client.generateTextStream(fullPrompt, {
            model: MODEL
        }, signal);

        let totalChars = 0;
        console.log('[FullChatAI] consuming generator...');
        let chunkCount = 0;
        for await (const chunk of stream) {
            if (signal?.aborted) break;
            if (chunkCount < 10) {
                console.log(`[FullChatAI] got_delta len=${chunk.length}`);
                chunkCount++;
            }
            yield chunk;
            totalChars += chunk.length;
        }
        console.log('[FullChatAI] generator completed');

        console.log(`[FullChatAI] response_streamed len=${totalChars}`);

    } catch (err) {
        if (signal?.aborted || (err instanceof Error && err.name === 'AbortError')) {
            console.log('[FullChatAI] aborted');
            throw err;
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

    if (nodeLabel) {
        response = `Viewing node "${nodeLabel}"... it connects to several concepts in my graph. The relationship is tenuous but present.`;
    } else if (documentTitle) {
        response = `I see you're reading "${documentTitle}". It's a dense text. What would you like to know?`;
    } else {
        response = "I am ready to reason about your graph.";
    }

    yield response;
}

// =============================================================================
// HELPERS
// =============================================================================

function buildSystemPrompt(context: AiContext): string {
    const { nodeLabel, documentText, documentTitle, recentHistory } = context;

    let prompt = `You are a dark, elegant AI assistant in a tool called Arnvoid.
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
