/**
 * AI Client Factory
 * Creates LLM clients based on mode (OpenAI or OpenRouter)
 */

import { OpenAIClient } from './openaiClient';
import { OpenRouterClient } from './openrouterClient';
import type { LLMClient, LLMMode, LLMClientConfig } from './clientTypes';

/**
 * Create an LLM client instance
 * @param config - Client configuration
 * @returns LLMClient instance
 */
export function createLLMClient(config: LLMClientConfig): LLMClient {
    const { apiKey, mode, defaultModel } = config;

    switch (mode) {
        case 'openai':
            return new OpenAIClient(apiKey, defaultModel);

        case 'openrouter':
            return new OpenRouterClient(apiKey, defaultModel);

        default:
            throw new Error(`Unknown LLM mode: ${mode}`);
    }
}

// Re-export types for convenience
export type { LLMClient, LLMMode, LLMClientConfig } from './clientTypes';
