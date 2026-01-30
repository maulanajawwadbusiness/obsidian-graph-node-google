import { lerpColor } from '../../visual/theme';
import type { ThemeConfig } from '../../visual/theme';

let idleProbeLogged = false;

export function withCtx(ctx: CanvasRenderingContext2D, fn: () => void) {
    ctx.save();
    try {
        fn();
    } finally {
        ctx.restore();
    }
}

export function drawGradientRing(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    radius: number,
    lineWidth: number,
    startColor: string,
    endColor: string,
    segments: number,
    rotationDegrees: number
) {
    ctx.save();

    const segmentAngle = (Math.PI * 2) / segments;
    const rotationOffset = (rotationDegrees * Math.PI) / 180;

    for (let i = 0; i < segments; i++) {
        const t = i / segments;
        const color = lerpColor(startColor, endColor, t);

        ctx.beginPath();
        const startAngle = i * segmentAngle + rotationOffset - 0.02;
        const endAngle = (i + 1) * segmentAngle + rotationOffset + 0.02;
        ctx.arc(x, y, radius, startAngle, endAngle);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        ctx.setLineDash([]);
        ctx.shadowBlur = 0;
        ctx.shadowColor = 'transparent';
        ctx.filter = 'none';
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.lineCap = 'butt';
        ctx.stroke();
    }

    ctx.restore();
}

export function drawVignetteBackground(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    theme: ThemeConfig
) {
    if (!theme.useVignette) return;

    const centerX = width / 2;
    const centerY = height / 2;
    const maxRadius = Math.max(width, height) * 0.75;

    const gradient = ctx.createRadialGradient(
        centerX, centerY, 0,
        centerX, centerY, maxRadius
    );
    gradient.addColorStop(0, theme.vignetteCenterColor);
    gradient.addColorStop(theme.vignetteStrength, theme.vignetteEdgeColor);
    gradient.addColorStop(1, theme.vignetteEdgeColor);

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
}

/**
 * Draw two-layer glow with energy-driven intensity and blur.
 * As nodeEnergy rises (0→1), glow brightens and expands.
 * As nodeEnergy falls, glow exhales smoothly.
 *
 * @param ctx Canvas context
 * @param x Node center x
 * @param y Node center y
 * @param radius Node rendered radius
 * @param nodeEnergy Hover energy [0..1] for this node
 * @param primaryBlue Current lerped primary color (for inner glow tint)
 * @param theme Theme configuration
 * @returns Computed glow parameters for debug overlay
 */
export function drawTwoLayerGlow(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    radius: number,
    nodeEnergy: number,
    primaryBlue: string,
    theme: ThemeConfig
): { innerAlpha: number; innerBlur: number; outerAlpha: number; outerBlur: number } {
    // Apply gamma curve to energy for response shaping
    const e = Math.pow(Math.max(0, Math.min(1, nodeEnergy)), theme.glowEnergyGamma);

    const idleMultiplier = theme.glowIdleMultiplier;
    const idleExponent = theme.glowIdleFadeExponent;
    const idleMask = Math.pow(1 - e, idleExponent);
    const innerIdleExtra = theme.glowInnerAlphaBase * (idleMultiplier - 1) * idleMask;
    const outerIdleExtra = theme.glowOuterAlphaBase * (idleMultiplier - 1) * idleMask;
    const innerAlphaBase = theme.glowInnerAlphaBase;
    const innerAlphaBoost = theme.glowInnerAlphaBoost;
    const outerAlphaBase = theme.glowOuterAlphaBase;
    const outerAlphaBoost = theme.glowOuterAlphaBoost;


    // Compute energy-driven values
    const innerAlpha = innerAlphaBase + e * innerAlphaBoost + innerIdleExtra;
    const outerAlpha = outerAlphaBase + e * outerAlphaBoost + outerIdleExtra;

    // Blur scales mildly with energy for natural breathing (not too foggy)
    const blurScale = 1 + e * theme.glowBlurScaleBoost;
    const innerBlur = (theme.glowInnerBlurBase + e * theme.glowInnerBlurBoost) * blurScale;
    const outerBlur = (theme.glowOuterBlurBase + e * theme.glowOuterBlurBoost) * blurScale;


    if (theme.hoverDebugEnabled && !idleProbeLogged) {
        const probe = (probeEnergy: number) => {
            const probeMask = Math.pow(1 - probeEnergy, idleExponent);
            const probeInner = innerAlphaBase + probeEnergy * innerAlphaBoost
                + theme.glowInnerAlphaBase * (idleMultiplier - 1) * probeMask;
            const probeOuter = outerAlphaBase + probeEnergy * outerAlphaBoost
                + theme.glowOuterAlphaBase * (idleMultiplier - 1) * probeMask;
            return { probeInner, probeOuter };
        };
        const at0 = probe(0);
        const at05 = probe(0.5);
        const at09 = probe(0.9);
        const at1 = probe(1);
        // One-time debug probe to verify idle lift fades near active.
        console.log(
            `glow probe alpha: e0 i=${at0.probeInner.toFixed(3)} o=${at0.probeOuter.toFixed(3)} | ` +
            `e0.5 i=${at05.probeInner.toFixed(3)} o=${at05.probeOuter.toFixed(3)} | ` +
            `e0.9 i=${at09.probeInner.toFixed(3)} o=${at09.probeOuter.toFixed(3)} | ` +
            `e1 i=${at1.probeInner.toFixed(3)} o=${at1.probeOuter.toFixed(3)}`
        );
        idleProbeLogged = true;
    }

    // Outer glow (purple-leaning, wider atmosphere)
    // FIX 48: Center Glow (Radial Gradient)
    // Use mathematical gradient instead of filter: blur() to ensure perfect centering.
    withCtx(ctx, () => {
        const gRadius = radius + outerBlur * 2.0; // Extend far enough
        const grad = ctx.createRadialGradient(x, y, radius, x, y, gRadius);
        // Fade from color to transparent
        // Use regex or parsing to handle opacity if needed, but assuming simple hex/rgba for now.
        // For simplicity and perf, we just fade opacity.
        // Actually, easiest way is to use transparent color stop.

        grad.addColorStop(0, theme.deepPurple); // Start at edge of node
        grad.addColorStop(1, 'rgba(0,0,0,0)'); // End at extent

        ctx.fillStyle = grad;
        ctx.globalAlpha = outerAlpha; // Master alpha
        ctx.beginPath();
        ctx.arc(x, y, gRadius, 0, Math.PI * 2);
        ctx.fill();
    });

    // Inner glow (blue-leaning, closer to ring)
    withCtx(ctx, () => {
        const gRadius = radius + innerBlur * 2.0;
        const grad = ctx.createRadialGradient(x, y, radius, x, y, gRadius);
        grad.addColorStop(0, primaryBlue);
        grad.addColorStop(1, 'rgba(0,0,0,0)');

        ctx.fillStyle = grad;
        ctx.globalAlpha = innerAlpha;
        ctx.beginPath();
        ctx.arc(x, y, gRadius, 0, Math.PI * 2);
        ctx.fill();
    });

    return { innerAlpha, innerBlur, outerAlpha, outerBlur };
}

return { innerAlpha, innerBlur, outerAlpha, outerBlur };
}

/**
 * Synchronize Canvas Backing Store with CSS Size & DPR.
 * Idempotent: safe to call every frame.
 *
 * @param canvas The canvas element
 * @param ctx The 2D context
 * @param lastDPRRef Ref to store last known DPR for detecting changes
 * @param debugEnabled Whether to log sync events
 * @returns boolean True if resize occurred (state reset), False if stable
 */
export function syncCanvasSizing(
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
    lastDPRRef: { current: number } | null,
    debugEnabled: boolean = false
): boolean {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();

    // Round to integer pixels to prevent aliasing
    const displayWidth = Math.max(1, Math.round(rect.width * dpr));
    const displayHeight = Math.max(1, Math.round(rect.height * dpr));

    const backingMismatch = canvas.width !== displayWidth || canvas.height !== displayHeight;
    const dprChanged = lastDPRRef ? lastDPRRef.current !== dpr : false;

    if (backingMismatch || dprChanged) {
        if (debugEnabled) {
            console.log(
                `[Resync] Canvas Sizing Triggered: ` +
                `DPR=${dpr.toFixed(2)} (was ${lastDPRRef?.current.toFixed(2)}) ` +
                `Rect=${rect.width.toFixed(0)}x${rect.height.toFixed(0)} ` +
                `Backing=${displayWidth}x${displayHeight}`
            );
        }

        canvas.width = displayWidth;
        canvas.height = displayHeight;

        if (lastDPRRef) {
            lastDPRRef.current = dpr;
        }

        // CRITICAL: Resize clears context state. Immediately restore transform.
        // We set to Identity * DPR so the next draw commands (which assume CSS coords) map correctly.
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        return true;
    }

    // Ensure no transform drift: Always start frame with known DPR scale
    // This is cheap if it matches, but guarantees safety against rogue transforms
    // However, for pure idempotency, we might skip this if no change? 
    // User requirement: "ensure no transform compounding: every frame starts with known transform state."
    // So we should enforce it.
    // However, if we do it here, we might override custom transforms if called mid-frame.
    // But this is meant to be called at start of frame.
    // Let's stick to user request: "3) if canvas.width/height != backingW/H: ... re-apply ctx transform"
    // And "D) guard rails... after setting width/height, ALWAYS reset transform"
    // I will only force reset here ON RESIZE. The caller loop usually does it anyway.

    return false;
}
