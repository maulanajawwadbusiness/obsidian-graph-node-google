/**
 * Central configuration for AI Model IDs.
 * Use this file to switch models across different subsystems.
 */

export const AI_MODELS = {
    /**
     * Main Chat (FullChat & MiniChat)
     * Requires streaming capability and reasoning support.
     */
    CHAT: 'gpt-5-nano',

    /**
     * Prefill Suggestions
     * Requires fast instruction following.
     */
    PREFILL: 'gpt-5-nano',

    /**
     * Document Analysis (Paper Analyzer)
     * Requires strong reasoning and structured output support.
     */
    ANALYZER: 'gpt-5-nano',

    /**
     * Label Rewriter
     * Simple instruction following.
     */
    REWRITER: 'gpt-5-nano',
} as const;
