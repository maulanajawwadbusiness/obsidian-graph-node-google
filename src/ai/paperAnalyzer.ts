/**
 * Paper Analyzer - Extracts 5 key points from document text using AI
 */

import { AI_MODELS } from '../config/aiModels';
import { apiPost } from '../api';
import { createLLMClient } from './index';
import { refreshBalance } from '../store/balanceStore';
import { ensureSufficientBalance } from '../money/ensureSufficientBalance';
import { estimateIdrCost } from '../money/estimateCost';
import { showShortage } from '../money/shortageStore';
import { pushMoneyNotice } from '../money/moneyNotices';
import { getLang } from '../i18n/lang';
import { buildStructuredAnalyzeInput, type AnalyzePromptLang } from '../server/src/llm/analyze/prompt';

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

type AnalyzeMainPoint = {
    index: number;
    title: string;
    explanation: string;
};

type AnalyzeLink = {
    from_index: number;
    to_index: number;
    type: string;
    weight: number;
    rationale: string;
};

type AnalyzeJson = {
    paper_title: string;
    main_points: AnalyzeMainPoint[];
    links: AnalyzeLink[];
};

function normalizeNodeCount(nodeCount: number): number {
    return Math.max(2, Math.min(12, Math.floor(nodeCount)));
}

function normalizeText(value: string): string {
    return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function assertSemanticAnalyzeJson(root: Record<string, unknown>, nodeCountRaw: number): void {
    const nodeCount = normalizeNodeCount(nodeCountRaw);
    const mainPoints = root.main_points as unknown[];
    const links = root.links as unknown[];
    const seenPointIndices = new Set<number>();
    const seenPairs = new Set<string>();
    const minLinks = Math.max(1, nodeCount - 1);

    if ((root.paper_title as string).trim().length === 0) {
        throw new Error('analysis failed');
    }

    if (mainPoints.length !== nodeCount) {
        throw new Error('analysis failed');
    }
    for (let i = 0; i < mainPoints.length; i += 1) {
        const point = mainPoints[i] as Record<string, unknown>;
        const index = point.index as number;
        const title = point.title as string;
        const explanation = point.explanation as string;
        if (!Number.isInteger(index) || index < 0 || index >= nodeCount) throw new Error('analysis failed');
        if (seenPointIndices.has(index)) throw new Error('analysis failed');
        seenPointIndices.add(index);
        if (title.trim().length < 6) throw new Error('analysis failed');
        if (explanation.trim().length < 80) throw new Error('analysis failed');
        if (normalizeText(title) === normalizeText(explanation)) throw new Error('analysis failed');
    }
    for (let expected = 0; expected < nodeCount; expected += 1) {
        if (!seenPointIndices.has(expected)) throw new Error('analysis failed');
    }

    if (links.length < minLinks) throw new Error('analysis failed');
    for (let i = 0; i < links.length; i += 1) {
        const link = links[i] as Record<string, unknown>;
        const fromIndex = link.from_index as number;
        const toIndex = link.to_index as number;
        const type = link.type as string;
        const rationale = link.rationale as string;
        const weight = link.weight as number;
        if (!Number.isInteger(fromIndex) || fromIndex < 0 || fromIndex >= nodeCount) throw new Error('analysis failed');
        if (!Number.isInteger(toIndex) || toIndex < 0 || toIndex >= nodeCount) throw new Error('analysis failed');
        if (fromIndex === toIndex) throw new Error('analysis failed');
        const key = `${fromIndex}->${toIndex}`;
        if (seenPairs.has(key)) throw new Error('analysis failed');
        seenPairs.add(key);
        if (type.trim().length < 2) throw new Error('analysis failed');
        if (!Number.isFinite(weight) || weight < 0 || weight > 1) throw new Error('analysis failed');
        if (rationale.trim().length < 20) throw new Error('analysis failed');
    }
}

function isDevDirectAnalyzeEnabled(): boolean {
    const apiKey = (import.meta.env.VITE_OPENAI_API_KEY as string | undefined)?.trim();
    return import.meta.env.DEV && Boolean(apiKey);
}

function getDevOpenAiKey(): string {
    const apiKey = (import.meta.env.VITE_OPENAI_API_KEY as string | undefined)?.trim();
    if (!apiKey) {
        throw new Error('analysis failed');
    }
    return apiKey;
}

function buildAnalyzeJsonSchema(nodeCount: number): object {
    return {
        type: 'object',
        properties: {
            paper_title: { type: 'string' },
            main_points: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        index: { type: 'integer' },
                        title: { type: 'string' },
                        explanation: { type: 'string' }
                    },
                    required: ['index', 'title', 'explanation'],
                    additionalProperties: false
                },
                minItems: nodeCount,
                maxItems: nodeCount
            },
            links: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        from_index: { type: 'integer' },
                        to_index: { type: 'integer' },
                        type: { type: 'string' },
                        weight: { type: 'number' },
                        rationale: { type: 'string' }
                    },
                    required: ['from_index', 'to_index', 'type', 'weight', 'rationale'],
                    additionalProperties: false
                }
            }
        },
        required: ['paper_title', 'main_points', 'links'],
        additionalProperties: false
    };
}

function parseDirectAnalyzeJson(value: unknown, nodeCount: number): AnalyzeJson {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error('analysis failed');
    }
    const root = value as Record<string, unknown>;
    if (typeof root.paper_title !== 'string' || !Array.isArray(root.main_points) || !Array.isArray(root.links)) {
        throw new Error('analysis failed');
    }

    const mainPoints = root.main_points as unknown[];
    const links = root.links as unknown[];
    if (mainPoints.length !== nodeCount) {
        throw new Error('analysis failed');
    }

    const parsedPoints: AnalyzeMainPoint[] = mainPoints.map((item) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('analysis failed');
        const point = item as Record<string, unknown>;
        if (!Number.isInteger(point.index)) throw new Error('analysis failed');
        if (typeof point.title !== 'string') throw new Error('analysis failed');
        if (typeof point.explanation !== 'string') throw new Error('analysis failed');
        return {
            index: point.index as number,
            title: point.title,
            explanation: point.explanation
        };
    });

    const parsedLinks: AnalyzeLink[] = links.map((item) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('analysis failed');
        const link = item as Record<string, unknown>;
        if (!Number.isInteger(link.from_index)) throw new Error('analysis failed');
        if (!Number.isInteger(link.to_index)) throw new Error('analysis failed');
        if (typeof link.type !== 'string') throw new Error('analysis failed');
        if (typeof link.weight !== 'number' || !Number.isFinite(link.weight)) throw new Error('analysis failed');
        if (typeof link.rationale !== 'string') throw new Error('analysis failed');
        return {
            from_index: link.from_index as number,
            to_index: link.to_index as number,
            type: link.type,
            weight: link.weight,
            rationale: link.rationale
        };
    });

    assertSemanticAnalyzeJson(root, nodeCount);

    return {
        paper_title: root.paper_title,
        main_points: parsedPoints,
        links: parsedLinks
    };
}

async function analyzeViaDevOpenAI(text: string, nodeCount: number): Promise<AnalysisResult> {
    const client = createLLMClient({
        apiKey: getDevOpenAiKey(),
        mode: 'openai',
        defaultModel: AI_MODELS.ANALYZER
    });
    const promptLang: AnalyzePromptLang = getLang() === 'en' ? 'en' : 'id';
    const prompt = buildStructuredAnalyzeInput({
        text,
        nodeCount,
        lang: promptLang
    });
    const schema = buildAnalyzeJsonSchema(nodeCount);
    const raw = await client.generateStructured<AnalyzeJson>(schema, prompt, { model: AI_MODELS.ANALYZER });
    const structured = parseDirectAnalyzeJson(raw, nodeCount);

    const points: AnalysisPoint[] = structured.main_points.map((p) => ({
        index: p.index,
        title: p.title,
        summary: p.explanation
    }));

    const links: AnalysisLink[] = structured.links.map((link) => ({
        fromIndex: link.from_index,
        toIndex: link.to_index,
        type: link.type,
        weight: link.weight,
        rationale: link.rationale
    }));

    return { paperTitle: structured.paper_title, points, links };
}

export async function analyzeDocument(text: string, opts?: { nodeCount?: number }): Promise<AnalysisResult> {
    const nodeCount = Math.max(2, Math.min(12, opts?.nodeCount ?? 5));
    const useDevDirectAnalyze = isDevDirectAnalyzeEnabled();
    const lang: AnalyzePromptLang = getLang() === 'en' ? 'en' : 'id';

    // Safety truncation (keep costs low while maintaining context)
    // Take first 6000 chars (approx 1500 tokens) - usually covers abstract + intro
    const safeText = text.slice(0, 6000);

    let estimatedCost = 0;
    if (!useDevDirectAnalyze) {
        estimatedCost = estimateIdrCost('analysis', safeText);
        const okToProceed = await ensureSufficientBalance({ requiredIdr: estimatedCost, context: 'analysis' });
        if (!okToProceed) {
            throw new Error('insufficient_balance');
        }
    }

    try {
        if (useDevDirectAnalyze) {
            console.log('[PaperAnalyzer] dev_direct_openai enabled');
            return await analyzeViaDevOpenAI(safeText, nodeCount);
        }

        const result = await apiPost('/api/llm/paper-analyze', {
            text: safeText,
            nodeCount,
            model: AI_MODELS.ANALYZER,
            lang
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
        if (
            !structured ||
            typeof structured !== 'object' ||
            !Array.isArray((structured as { main_points?: unknown[] }).main_points) ||
            !Array.isArray((structured as { links?: unknown[] }).links)
        ) {
            throw new Error('analysis failed');
        }
        assertSemanticAnalyzeJson(structured as Record<string, unknown>, nodeCount);

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
        if (!useDevDirectAnalyze) {
            void refreshBalance();
        }
    }
}
