/**
 * AI Client Types
 * Defines the interface for LLM clients and configuration
 */

export type LLMMode = 'openai' | 'openrouter';

/**
 * Unified LLM client interface
 * Supports both OpenAI and OpenRouter modes
 */
export interface LLMClient {
    /**
     * Generate text completion
     * @param prompt - The prompt to send to the LLM
     * @param opts - Optional generation parameters
     */
    generateText(
        prompt: string,
        opts?: {
            model?: string;
            temperature?: number;
            maxCompletionTokens?: number;
        }
    ): Promise<string>;

    /**
     * Generate text completion as a stream
     * @param prompt - The prompt to send to the LLM
     * @param opts - Optional generation parameters
     */
    generateTextStream(
        prompt: string,
        opts?: {
            model?: string;
            temperature?: number;
            maxCompletionTokens?: number;
        },
        signal?: AbortSignal
    ): AsyncGenerator<string, void, unknown>;

    /**
     * Generate structured output (JSON)
     * @param schema - JSON schema for structured output
     * @param prompt - The prompt to send to the LLM
     * @param opts - Optional generation parameters
     */
    generateStructured<T>(
        schema: object,
        prompt: string,
        opts?: {
            model?: string;
        }
    ): Promise<T>;
}

/**
 * Client configuration
 */
export interface LLMClientConfig {
    apiKey: string;
    mode: LLMMode;
    defaultModel?: string;
}
