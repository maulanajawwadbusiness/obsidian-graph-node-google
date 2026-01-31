
/**
 * Render Guard: hardening against performance cliffs.
 * Enforces "Zero Expensive Effects" policy during hot loops.
 */
export const guardStrictRenderSettings = (ctx: CanvasRenderingContext2D) => {
    // 1. FILTER GUARD
    if (ctx.filter !== 'none') {
        // PRODUCTION FIX: Hard reset
        ctx.filter = 'none';
    }

    // 2. SHADOW GUARD
    if (ctx.shadowBlur > 0) {
        ctx.shadowBlur = 0;
        ctx.shadowColor = 'transparent';
    }
};

// Global augmentation for state tracking
declare global {
    interface Window {
        _perfGuardLogged?: {
            filter?: boolean;
            shadow?: boolean;
            saveRestore?: boolean;
        };
    }
}

// Helper to manually reset state if we suspect leakage
export const resetRenderState = (ctx: CanvasRenderingContext2D) => {
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.filter = 'none';
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';
    ctx.setLineDash([]);
};
