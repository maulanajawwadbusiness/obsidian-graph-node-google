/**
 * Paper Analyzer - Extracts 5 key points from document text using AI
 */

import { AI_MODELS } from '../config/aiModels';
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
            throw new Error('unauthorized');
        }

        if (!result.ok || !result.data || typeof result.data !== 'object') {
            console.warn('[PaperAnalyzer] Server response error');
            throw new Error('analysis failed');
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
            console.warn('[PaperAnalyzer] Server error');
            throw new Error('analysis failed');
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
        throw err;
    }
}
