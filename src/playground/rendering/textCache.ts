
/**
 * TextMetricsCache: Prevents "measureText storm" during high-load rendering.
 * Caches width (and potentially other metrics) keyed by content + font.
 */
export class TextMetricsCache {
    private cache: Map<string, number> = new Map();
    // Use a simpler cache key strategy: "font:text"
    // We assume DPR is handled by the caller (width is CSS pixels usually) 
    // OR we assume the cache is cleared on resize/DPR change.

    private maxCacheSize: number = 5000;

    /**
     * Get width of text. Uses cached value if available.
     */
    measureWidth(ctx: CanvasRenderingContext2D, text: string): number {
        // If text is empty, 0
        if (!text) return 0;

        // Key must include font to be correct
        const font = ctx.font;
        const key = `${font}:${text}`;

        const cached = this.cache.get(key);
        if (cached !== undefined) {
            return cached;
        }

        const width = ctx.measureText(text).width;
        this.cache.set(key, width);

        if (this.cache.size > this.maxCacheSize) {
            this.cache.clear(); // Simple flush strategy
        }

        return width;
    }

    /**
     * Clear cache. Should be called when DPR changes or font theme changes.
     */
    clear() {
        this.cache.clear();
    }
}

// Global singleton
export const textMetricsCache = new TextMetricsCache();
