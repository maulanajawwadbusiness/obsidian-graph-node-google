
/**
 * Render Guard: hardening against performance cliffs.
 * Enforces "Zero Expensive Effects" policy during hot loops.
 */
export const guardStrictRenderSettings = (ctx: CanvasRenderingContext2D) => {
    // 1. FILTER GUARD
    if (ctx.filter !== 'none') {
        // DEVELOPMENT ASSERT: Log once
        if (process.env.NODE_ENV !== 'production' && !window._perfGuardLogged?.filter) {
            console.warn('[RenderGuard] PERF VIOLATION: ctx.filter set during hot loop!', ctx.filter);
            window._perfGuardLogged = window._perfGuardLogged || {};
            window._perfGuardLogged.filter = true;
        }
        // PRODUCTION FIX: Hard reset
        ctx.filter = 'none';
    }

    // 2. SHADOW GUARD
    if (ctx.shadowBlur > 0) {
        if (process.env.NODE_ENV !== 'production' && !window._perfGuardLogged?.shadow) {
            console.warn('[RenderGuard] PERF VIOLATION: ctx.shadowBlur > 0 during hot loop!', ctx.shadowBlur);
            window._perfGuardLogged = window._perfGuardLogged || {};
            window._perfGuardLogged.shadow = true;
        }
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
