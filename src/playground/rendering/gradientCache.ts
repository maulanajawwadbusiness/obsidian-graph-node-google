export class GradientCache {
    private cache: Map<string, CanvasGradient> = new Map();
    private maxCacheSize: number = 2000;

    // Stats
    public hits: number = 0;
    public misses: number = 0;

    /**
     * Get or create a radial gradient.
     * Radii are quantized to 0.5px to increase cache hit rate.
     * ASSUMPTION: Caller MUST translate context to center (0,0) before drawing.
     */
    getRadialGradient(
        ctx: CanvasRenderingContext2D,
        innerRadius: number,
        outerRadius: number,
        colorStops: { offset: number; color: string }[]
    ): CanvasGradient {
        // QUANTIZATION: Round radii to nearest 0.5px
        // This is critical for visual consistency vs cache hit rate
        const qInner = Math.round(innerRadius * 2) / 2;
        const qOuter = Math.round(outerRadius * 2) / 2;

        const key = `rad:${qInner}:${qOuter}:${this.serializeStops(colorStops)}`;

        let grad = this.cache.get(key);
        if (grad) {
            this.hits++;
            return grad;
        }

        this.misses++;

        // Create at 0,0 (Caller MUST translate)
        grad = ctx.createRadialGradient(0, 0, qInner, 0, 0, qOuter);
        for (const stop of colorStops) {
            grad.addColorStop(stop.offset, stop.color);
        }

        this.cache.set(key, grad);
        this.checkSize();

        return grad;
    }

    private serializeStops(stops: { offset: number; color: string }[]): string {
        // usage: 0:red|1:blue
        return stops.map(s => `${s.offset.toFixed(2)}:${s.color}`).join('|');
    }

    private checkSize() {
        if (this.cache.size > this.maxCacheSize) {
            // Simple clear. LRU is overkill for this specific frame-loop pattern 
            // where the working set is usually usually small (N varieties of glow).
            // If we have >2000 variations, we have bigger problems.
            this.cache.clear();
            // Optionally log?
            // console.warn('[GradientCache] Flush');
        }
    }

    public clear() {
        this.cache.clear();
        this.hits = 0;
        this.misses = 0;
    }

    public resetStats() {
        this.hits = 0;
        this.misses = 0;
    }
}

// Global singleton instance for the render loop
export const gradientCache = new GradientCache();
