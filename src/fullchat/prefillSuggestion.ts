
export interface MiniChatHistory {
    role: 'user' | 'ai';
    text: string;
}

export interface PrefillContext {
    nodeLabel: string;
    miniChatMessages: MiniChatHistory[];
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
    const { nodeLabel, miniChatMessages } = context;

    // Simulate network/processing delay (150-400ms range)
    const delay = 150 + Math.random() * 250;

    // Check signal before starting delay
    if (options.signal?.aborted) {
        throw new Error('Aborted');
    }

    await new Promise(resolve => setTimeout(resolve, delay));

    // Check signal after delay
    if (options.signal?.aborted) {
        throw new Error('Aborted');
    }

    // Mock refinement logic: create a more structured prompts
    if (!miniChatMessages || miniChatMessages.length === 0) {
        return `Analyze "${nodeLabel}" and explain its connections within the graph framework.`;
    }

    const lastMsg = miniChatMessages[miniChatMessages.length - 1];
    const words = lastMsg.text.split(' ');
    const shortSummary = words.slice(0, 8).join(' ') + (words.length > 8 ? '...' : '');

    return `Synthesize the discussion regarding "${nodeLabel}", focusing on the point: "${shortSummary}"`;
}
