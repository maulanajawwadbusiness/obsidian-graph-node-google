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

export function drawTwoLayerGlow(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    radius: number,
    theme: ThemeConfig
) {
    withCtx(ctx, () => {
        ctx.beginPath();
        ctx.arc(x, y, radius + theme.glowOuterRadius, 0, Math.PI * 2);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        ctx.shadowBlur = 0;
        ctx.shadowColor = 'transparent';
        ctx.fillStyle = theme.glowOuterColor;
        ctx.filter = `blur(${theme.glowOuterRadius}px)`;
        ctx.fill();
    });

    withCtx(ctx, () => {
        ctx.beginPath();
        ctx.arc(x, y, radius + theme.glowInnerRadius, 0, Math.PI * 2);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        ctx.shadowBlur = 0;
        ctx.shadowColor = 'transparent';
        ctx.fillStyle = theme.glowInnerColor;
        ctx.filter = `blur(${theme.glowInnerRadius}px)`;
        ctx.fill();
    });
}
