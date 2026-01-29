/**
 * Label Rewriter - AI-powered 3-word sentence generation
 * Turns 5 words into 5 evocative 3-word sentences using OpenAI
 */

import { createLLMClient } from './index';

/**
 * Convert 5 words into 5 three-word sentences using AI
 * @param words - Array of 5 words to transform
 * @returns Array of 5 three-word sentences (or original words on failure)
 */
export async function makeThreeWordLabels(words: string[]): Promise<string[]> {
    // Validate input
    if (words.length !== 5) {
        console.warn('[LabelRewriter] Expected 5 words, got', words.length);
        return words;
    }

    try {
        // Get API key from environment
        const apiKey = import.meta.env.VITE_OPENAI_API_KEY as string;
        if (!apiKey) {
            console.error('[LabelRewriter] Missing VITE_OPENAI_API_KEY in environment');
            return words;
        }

        // Create OpenAI client with gpt-4o-nano model
        const client = createLLMClient({
            apiKey,
            mode: 'openai',
            defaultModel: 'gpt-4o' // Using gpt-4o as gpt-4o-nano equivalent
        });

        // Build prompt
        const prompt = buildPrompt(words);

        // Call AI with timeout protection (10s)
        const controller = new AbortController();
        const timeout = setTimeout(() => {
            controller.abort();
            console.warn('[LabelRewriter] Request timeout after 10s');
        }, 10000);

        let output: string;
        try {
            output = await client.generateText(prompt, {
                model: 'gpt-4o',
                temperature: 0.3,
                maxCompletionTokens: 100
            });
            clearTimeout(timeout);
        } catch (innerError) {
            clearTimeout(timeout);
            throw innerError;
        }

        // Validate and parse output
        const labels = validateAndParseLabels(output, words);

        if (labels.length === 5) {
            console.log('[LabelRewriter] Successfully generated AI labels:', labels);
            return labels;
        } else {
            console.warn('[LabelRewriter] Validation failed, using original words');
            return words;
        }
    } catch (error) {
        // Check if it was an abort error (timeout)
        if (error instanceof Error && error.name === 'AbortError') {
            console.error('[LabelRewriter] Request timed out, using original words');
        } else {
            console.error('[LabelRewriter] Error generating labels:', error);
        }
        return words; // Graceful fallback
    }
}

/**
 * Build the prompt for 3-word sentence generation
 */
function buildPrompt(words: string[]): string {
    return `Turn each of these 5 words into a 3-word evocative sentence.
Rules:
- Output exactly 5 lines
- Each line exactly 3 words
- No numbering, no punctuation, no quotes
- Creative but coherent
- Separate lines with newline only

Words:
1. ${words[0]}
2. ${words[1]}
3. ${words[2]}
4. ${words[3]}
5. ${words[4]}

Output format (example):
word becomes phrase
another short sentence
three word line
creative thought spark
simple poetic expression`;
}

/**
 * Validate AI output and parse into exactly 5 three-word labels
 */
function validateAndParseLabels(output: string, originalWords: string[]): string[] {
    // Strip markdown code blocks if AI adds them
    const cleanOutput = output.replace(/```[\s\S]*?```/g, '').trim();

    // Split into lines and filter empty
    const lines = cleanOutput.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);

    // Must have exactly 5 lines
    if (lines.length !== 5) {
        console.warn('[LabelRewriter] Expected 5 lines, got', lines.length);
        return originalWords;
    }

    // Validate each line is exactly 3 words
    const labels: string[] = [];
    for (const line of lines) {
        // Remove any leading numbers or punctuation (e.g., "1. " or "- ")
        const cleaned = line.replace(/^[\d\.\-\s]+/, '').trim();
        const wordCount = cleaned.split(/\s+/).length;

        if (wordCount !== 3) {
            console.warn(`[LabelRewriter] Line "${cleaned}" has ${wordCount} words, expected 3`);
            return originalWords;
        }

        labels.push(cleaned);
    }

    return labels;
}
