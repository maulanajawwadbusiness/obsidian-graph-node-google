/**
 * Paper Analyzer - Extracts 5 key points from document text using AI
 */

import { AI_MODELS } from '../config/aiModels';
import { getLang } from '../i18n/lang';
import { apiPost } from '../api';

export interface AnalysisPoint {
    index: number;   // 0-based index (maps to node index)
    title: string;   // Short title (3-5 words)
    summary: string; // One paragraph explanation
}

export interface AnalysisLink {
    fromIndex: number;
    toIndex: number;
    type: string;
    weight: number;
    rationale: string;
}

export interface AnalysisResult {
    paperTitle?: string;
    points: AnalysisPoint[];
    links: AnalysisLink[];
}

// Fallback if AI fails: creates deterministic placeholders
function createFallbackPoints(words: string[]): AnalysisPoint[] {
    const isId = getLang() === 'id';
    return words.slice(0, 5).map((word, index) => ({
        index,
        title: word,
        summary: isId
            ? `Ini adalah konsep kunci yang berasal dari "${word}". Sistem saat ini berjalan dalam mode fallback, sehingga ringkasan ini hanya placeholder. Dalam keadaan terhubung sepenuhnya, ini akan berisi penjelasan rinci tentang bagaimana "${word}" berhubungan dengan teks sumber.`
            : `This is a key concept derived from "${word}". The system is currently running in fallback mode, so this summary is a placeholder. In a fully connected state, this would contain a detailed explanation of how "${word}" relates to the source text.`
    }));
}

export async function analyzeDocument(text: string, opts?: { nodeCount?: number }): Promise<AnalysisResult> {
    const nodeCount = Math.max(2, Math.min(12, opts?.nodeCount ?? 5));

    // Safety truncation (keep costs low while maintaining context)
    // Take first 6000 chars (approx 1500 tokens) - usually covers abstract + intro
    const safeText = text.slice(0, 6000);

    try {
        const result = await apiPost('/api/llm/paper-analyze', {
            text: safeText,
            nodeCount,
            model: AI_MODELS.ANALYZER
        });

        if (result.status === 401 || result.status === 403) {
            console.warn('[PaperAnalyzer] Unauthorized; please log in');
            const words = text.split(/\s+/).filter(w => w.length > 5);
            return { points: createFallbackPoints(words).slice(0, nodeCount), links: [] };
        }

        if (!result.ok || !result.data || typeof result.data !== 'object') {
            console.warn('[PaperAnalyzer] Server response error; using fallback');
            const words = text.split(/\s+/).filter(w => w.length > 5);
            return { points: createFallbackPoints(words).slice(0, nodeCount), links: [] };
        }

        const payload = result.data as {
            ok?: boolean;
            json?: {
                paper_title: string;
                main_points: { index: number; title: string; explanation: string }[];
                links: { from_index: number; to_index: number; type: string; weight: number; rationale: string }[];
            };
            paper_title?: string;
            main_points?: { index: number; title: string; explanation: string }[];
            links?: { from_index: number; to_index: number; type: string; weight: number; rationale: string }[];
        };

        if (!payload.ok) {
            console.warn('[PaperAnalyzer] Server error; using fallback');
            const words = text.split(/\s+/).filter(w => w.length > 5);
            return { points: createFallbackPoints(words).slice(0, nodeCount), links: [] };
        }

        const structured = payload.json || payload;

        const points: AnalysisPoint[] = (structured.main_points || []).map(p => ({
            index: p.index,
            title: p.title,
            summary: p.explanation
        }));

        const links: AnalysisLink[] = (structured.links || []).map(link => ({
            fromIndex: link.from_index,
            toIndex: link.to_index,
            type: link.type,
            weight: link.weight,
            rationale: link.rationale
        }));

        return { paperTitle: structured.paper_title, points, links };

    } catch (err) {
        console.error('[PaperAnalyzer] Analysis failed:', err);
        const words = text.split(/\s+/).slice(0, 20); // Fallback source
        return { points: createFallbackPoints(words).slice(0, nodeCount), links: [] };
    }
}
