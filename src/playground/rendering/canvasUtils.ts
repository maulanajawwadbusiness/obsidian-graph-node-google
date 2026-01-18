import { hexToRgb, lerpColor } from '../../visual/theme';
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

const clampAlpha = (value: number) => {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.min(1, value));
};

const toRgba = (color: string, alpha: number) => {
    const { r, g, b } = hexToRgb(color);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

export function getGlowAlphas(theme: ThemeConfig, energy: number) {
    const innerBase = Number.isFinite(theme.glowInnerAlphaBase)
        ? theme.glowInnerAlphaBase
        : theme.glowInnerAlpha;
    const innerBoost = Number.isFinite(theme.glowInnerAlphaBoost)
        ? theme.glowInnerAlphaBoost
        : 0;
    const outerBase = Number.isFinite(theme.glowOuterAlphaBase)
        ? theme.glowOuterAlphaBase
        : theme.glowOuterAlpha;
    const outerBoost = Number.isFinite(theme.glowOuterAlphaBoost)
        ? theme.glowOuterAlphaBoost
        : 0;
    const inner = innerBase + energy * innerBoost;
    const outer = outerBase + energy * outerBoost;
    return {
        innerAlpha: clampAlpha(inner),
        outerAlpha: clampAlpha(outer)
    };
}

export function drawTwoLayerGlow(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    radius: number,
    theme: ThemeConfig,
    energy: number = 0  // 0..1 hover energy for alpha scaling
) {
    // Compute dynamic alpha from base + energy * boost
    const { innerAlpha, outerAlpha } = getGlowAlphas(theme, energy);

    // Outer glow (purple, wider, fainter)
    withCtx(ctx, () => {
        ctx.beginPath();
        ctx.arc(x, y, radius + theme.glowOuterRadius, 0, Math.PI * 2);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        ctx.shadowBlur = 0;
        ctx.shadowColor = 'transparent';
        ctx.fillStyle = toRgba(theme.glowOuterColor, outerAlpha);
        ctx.filter = `blur(${theme.glowOuterRadius}px)`;
        ctx.fill();
    });

    // Inner glow (blue, tighter, brighter)
    withCtx(ctx, () => {
        ctx.beginPath();
        ctx.arc(x, y, radius + theme.glowInnerRadius, 0, Math.PI * 2);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        ctx.shadowBlur = 0;
        ctx.shadowColor = 'transparent';
        ctx.fillStyle = toRgba(theme.glowInnerColor, innerAlpha);
        ctx.filter = `blur(${theme.glowInnerRadius}px)`;
        ctx.fill();
    });
}
