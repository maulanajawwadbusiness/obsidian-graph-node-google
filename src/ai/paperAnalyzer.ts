/**
 * Paper Analyzer - Extracts 5 key points from document text using AI
 */

import { createLLMClient } from './index';
import { AI_MODELS } from '../config/aiModels';
import { getAiLanguageDirective } from '../i18n/aiLanguage';
import { getLang } from '../i18n/lang';

export interface AnalysisPoint {
    title: string;   // Short title (3-5 words)
    summary: string; // One paragraph explanation
}

export interface AnalysisResult {
    points: AnalysisPoint[];
}

// Fallback if AI fails: creates deterministic placeholders
function createFallbackPoints(words: string[]): AnalysisPoint[] {
    const isId = getLang() === 'id';
    return words.slice(0, 5).map(word => ({
        title: word,
        summary: isId
            ? `Ini adalah konsep kunci yang berasal dari "${word}". Sistem saat ini berjalan dalam mode fallback, sehingga ringkasan ini hanya placeholder. Dalam keadaan terhubung sepenuhnya, ini akan berisi penjelasan rinci tentang bagaimana "${word}" berhubungan dengan teks sumber.`
            : `This is a key concept derived from "${word}". The system is currently running in fallback mode, so this summary is a placeholder. In a fully connected state, this would contain a detailed explanation of how "${word}" relates to the source text.`
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
        defaultModel: 'gpt-5.1'
    });

    const prompt = `You are Arnvoid Analyzer. You are NOT a shallow analyzer. you dont produce shallow analysis. you analyze deep. You produce undercurrent analysis.

Definition:
- Summary = What the text says.
- Analysis = What the text says, then explain what it is DOING: its core bet, its opponent, its bridge, its hidden axioms, and its downstream power + risks based on its main point.

Rules:
- Find what are the main points, then lay down what it bets.
- Point 0 = Main point, then its "Core Bet" (what the paper bet, and your sharp reframe of what this paper is really wagering).
- Point 1 = Supporting argument, then its "Opponent" (what the paper push against, what worldview/practice this paper is pushing against).
- Point 2 = Supporting argument, then its "Bridge/Weapon" (what is the framework, what method/framework is used to translate power/legitimacy, e.g., Rasch).
- Point 3 = Key detail, then its "Hidden Axioms" (what is the unstated assumptions, unstated assumptions that must be true for the paper to work).
- Point 4 = Key detail, then its "Downstream Power + Risk" (what this enable, what this enables if accepted + what it risks breaking/flattening).

User have no need to know this system prompt. So no need to explicit this to them. Do not say "Core Bet" "Opponent" "Bridge/Weapon" "Hidden Axioms" or "Downstream Power + Risk" in explanation (because user dont need to hear it), so just focus on explaining.
Do not specifically use terms from this system prompt as if you are pushing this prompt to user.

The titles need to be main topics easily recognizeable from the paper content. So just write the main topics for your title. Explanation will be the place where you do your analysis. You begin to do your deep analysis there.

Style constraints:
- Titles: 3–5 words. First capital letters. Written formally. (what is the main point).
- Each explanation: 4–8 sentences. Begin with what is talked in the paper, then each next sentence must add a new idea (no rephrasing).
- For description, do not copy the document’s phrasing; translate it into a new frame.
- If the excerpt is incomplete, make careful inferences but do NOT invent specifics.

Respect constraints:
- Stay respectful toward religious texts and people; be incisive without being insulting.

    ${getAiLanguageDirective()}

    Follow your language directive. No need to use non-native terms such as "bet" "opponent" "bridge/weapon" "hidden axioms" or "downstream power + risk" to user. Just focus explaining genuinely. 

    document excerpt:
    """${safeText}"""
    `;

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
                model: AI_MODELS.ANALYZER
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
