/**
 * Paper Analyzer - Extracts 5 key points from document text using AI
 */

import { createLLMClient } from './index';

export interface AnalysisPoint {
    title: string;   // Short title (3-5 words)
    summary: string; // One paragraph explanation
}

export interface AnalysisResult {
    points: AnalysisPoint[];
}

// Fallback if AI fails: creates deterministic placeholders
function createFallbackPoints(words: string[]): AnalysisPoint[] {
    return words.slice(0, 5).map(word => ({
        title: word,
        summary: `This is a key concept derived from "${word}". The system is currently running in fallback mode, so this summary is a placeholder. In a fully connected state, this would contain a detailed explanation of how "${word}" relates to the source text.`
    }));
}

export async function analyzeDocument(text: string): Promise<AnalysisResult> {
    const apiKey = import.meta.env.VITE_OPENAI_API_KEY as string;

    // Safety truncation (keep costs low while maintaining context)
    // Take first 6000 chars (approx 1500 tokens) - usually covers abstract + intro
    const safeText = text.slice(0, 6000);

    if (!apiKey) {
        console.warn('[PaperAnalyzer] Missing API Key, using fallback');
        const words = text.split(/\s+/).filter(w => w.length > 5); // Filter for "meaty" words
        return { points: createFallbackPoints(words) };
    }

    const client = createLLMClient({
        apiKey,
        mode: 'openai',
        defaultModel: 'gpt-4o'
    });

    const prompt = `Analyze the following document text and extract:
    1. A short "paper_title" for the document.
    2. Exactly 5 distinct "main_points" to describe its content.
    
    For each main point, provide:
    - A short "title" (3-5 words)
    - A "explanation" paragraph (2-3 sentences)

    Rules:
    - The first point should be the "Main Topic".
    - The other 4 points should be supporting arguments or key details.
    - Be concise and analytical.

    Document Excerpt:
    """${safeText}"""...`;

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000); // 15s timeout

        const schema = {
            type: "object",
            properties: {
                paper_title: { type: "string" },
                main_points: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            title: { type: "string" },
                            explanation: { type: "string" }
                        },
                        required: ["title", "explanation"],
                        additionalProperties: false
                    },
                    minItems: 5,
                    maxItems: 5
                }
            },
            required: ["paper_title", "main_points"],
            additionalProperties: false
        };

        const result = await client.generateStructured<{ paper_title: string; main_points: { title: string; explanation: string }[] }>(
            schema,
            prompt,
            {
                model: 'gpt-5-nano'
            }
        );

        clearTimeout(timeout);

        // Map to internal format
        const points: AnalysisPoint[] = result.main_points.map(p => ({
            title: p.title,
            summary: p.explanation
        }));

        return { points };

    } catch (err) {
        console.error('[PaperAnalyzer] Analysis failed:', err);
        const words = text.split(/\s+/).slice(0, 20); // Fallback source
        return { points: createFallbackPoints(words) };
    }
}
