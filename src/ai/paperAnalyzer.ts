/**
 * Paper Analyzer - Extracts 5 key points from document text using AI
 */

import { AI_MODELS } from '../config/aiModels';
import { apiPost } from '../api';
import { refreshBalance } from '../store/balanceStore';
import { ensureSufficientBalance } from '../money/ensureSufficientBalance';
import { estimateIdrCost } from '../money/estimateCost';
import { showShortage } from '../money/shortageStore';
import { pushMoneyNotice } from '../money/moneyNotices';

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
    const estimatedCost = estimateIdrCost('analysis', safeText);
    const okToProceed = await ensureSufficientBalance({ requiredIdr: estimatedCost, context: 'analysis' });
    if (!okToProceed) {
        throw new Error('insufficient_balance');
    }

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
            if ((payload as { code?: string }).code === 'insufficient_rupiah') {
                const p = payload as {
                    balance_idr?: number;
                    needed_idr?: number;
                    shortfall_idr?: number;
                };
                const needed = typeof p.needed_idr === 'number' ? p.needed_idr : estimatedCost;
                const balance = typeof p.balance_idr === 'number' ? p.balance_idr : null;
                const shortfall = typeof p.shortfall_idr === 'number'
                    ? p.shortfall_idr
                    : Math.max(0, needed - (balance ?? 0));
                showShortage({
                    balanceIdr: balance,
                    requiredIdr: needed,
                    shortfallIdr: shortfall,
                    context: 'analysis'
                });
                pushMoneyNotice({
                    kind: 'deduction',
                    status: 'warning',
                    title: 'Saldo tidak cukup',
                    message: 'Perkiraan biaya lebih kecil dari biaya akhir. Saldo tidak berubah.'
                });
                throw new Error('insufficient_balance');
            }
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
    } finally {
        void refreshBalance();
    }
}
