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
        defaultModel: 'gpt-4o-mini'
    });

    const prompt = `Analyze the following document text and extract exactly 5 distinct key points to describe its content.
    
    Structure your answer as 5 blocks. 
    For each block, provide:
    1. A short title (3-5 words)
    2. A summary paragraph (2-3 sentences)

    Output Format (Strict JSON):
    [
      { "title": "...", "summary": "..." },
      ...
    ]

    Rules:
    - The first point MUST be the "Main Topic".
    - The other 4 points should be supporting arguments or key details.
    - JSON only. No markdown formatting.

    Document Excerpt:
    """${safeText}"""...`;

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000); // 15s timeout

        const responseText = await client.generateText(prompt, {
            model: 'gpt-4o-mini',
            temperature: 0.3, // Low temp for structural stability
            maxCompletionTokens: 1000
        });

        clearTimeout(timeout);

        // Parse JSON
        let jsonStr = responseText.trim();
        // Remove markdown code blocks if present
        if (jsonStr.startsWith('```json')) {
            jsonStr = jsonStr.replace(/^```json/, '').replace(/```$/, '').trim();
        } else if (jsonStr.startsWith('```')) {
            jsonStr = jsonStr.replace(/^```/, '').replace(/```$/, '').trim();
        }

        const points = JSON.parse(jsonStr) as AnalysisPoint[];

        if (!Array.isArray(points) || points.length !== 5) {
            throw new Error(`Invalid JSON structure or count: ${points.length}`);
        }

        return { points };

    } catch (err) {
        console.error('[PaperAnalyzer] Analysis failed:', err);
        const words = text.split(/\s+/).slice(0, 20); // Fallback source
        return { points: createFallbackPoints(words) };
    }
}
