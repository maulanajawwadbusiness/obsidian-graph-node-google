import { lerpColor } from '../../visual/theme';
import type { ThemeConfig } from '../../visual/theme';

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

    // Compute energy-driven values
    const innerAlpha = theme.glowInnerAlphaBase + e * theme.glowInnerAlphaBoost;
    const innerBlur = theme.glowInnerBlurBase + e * theme.glowInnerBlurBoost;
    const outerAlpha = theme.glowOuterAlphaBase + e * theme.glowOuterAlphaBoost;
    const outerBlur = theme.glowOuterBlurBase + e * theme.glowOuterBlurBoost;

    // Outer glow (purple-leaning, wider atmosphere)
    // Use theme.glowOuterColor as base but let alpha vary
    withCtx(ctx, () => {
        ctx.beginPath();
        ctx.arc(x, y, radius + outerBlur, 0, Math.PI * 2);
        ctx.globalAlpha = outerAlpha;
        ctx.globalCompositeOperation = 'source-over';
        ctx.shadowBlur = 0;
        ctx.shadowColor = 'transparent';
        // Use deep purple for outer glow atmosphere
        ctx.fillStyle = theme.deepPurple;
        ctx.filter = `blur(${outerBlur}px)`;
        ctx.fill();
    });

    // Inner glow (blue-leaning, closer to ring)
    // Tint toward current primaryBlue for cohesion
    withCtx(ctx, () => {
        ctx.beginPath();
        ctx.arc(x, y, radius + innerBlur, 0, Math.PI * 2);
        ctx.globalAlpha = innerAlpha;
        ctx.globalCompositeOperation = 'source-over';
        ctx.shadowBlur = 0;
        ctx.shadowColor = 'transparent';
        // Use lerped primaryBlue for inner glow cohesion with ring
        ctx.fillStyle = primaryBlue;
        ctx.filter = `blur(${innerBlur}px)`;
        ctx.fill();
    });

    return { innerAlpha, innerBlur, outerAlpha, outerBlur };
}

