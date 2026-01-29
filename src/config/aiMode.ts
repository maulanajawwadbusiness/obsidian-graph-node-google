/**
 * AI Mode Configuration
 * Determines whether to use real LLM APIs or mock simulations.
 */

export type AiMode = 'mock' | 'real';

/**
 * Get the current AI mode
 * Priority: 
 * 1. Runtime override (window.ARNVOID_AI_MODE)
 * 2. Environment variable (VITE_AI_MODE)
 * 3. Default ('mock')
 */
export function getAiMode(): AiMode {
    // 1. Runtime override (useful for devtools experiments)
    if (typeof window !== 'undefined' && (window as any).ARNVOID_AI_MODE) {
        return (window as any).ARNVOID_AI_MODE as AiMode;
    }

    // 2. Env Var
    const envMode = import.meta.env.VITE_AI_MODE;
    if (envMode === 'real') {
        return 'real';
    }

    // 3. Default
    return 'real';
}

/**
 * Get the default OpenAI model
 * Defaults to 'gpt-5' as it supports responses API + streaming + structured outputs
 */
export function getDefaultModel(): string {
    return import.meta.env.VITE_OPENAI_MODEL_DEFAULT || 'gpt-5';
}
