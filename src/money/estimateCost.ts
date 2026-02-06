export type CostContext = 'analysis' | 'chat' | 'prefill';

function countWords(text: string): number {
    return text.trim().split(/\s+/).filter(Boolean).length;
}

export function estimateIdrCost(context: CostContext, text: string): number {
    const words = countWords(text);

    if (context === 'analysis') {
        return Math.max(150, Math.min(4500, words * 3));
    }

    if (context === 'prefill') {
        return Math.max(50, Math.min(800, words * 2));
    }

    return Math.max(120, Math.min(3000, words * 2));
}
