// Fix 40: Device Pixel Quantization
// Unifies snapping across Render/Overlay/Input layers.
export const quantizeToDevicePixel = (px: number, dpr: number) => {
    // Avoid degenerate dpr
    const safeDpr = Math.max(0.1, dpr);
    return Math.round(px * safeDpr) / safeDpr;
};

export function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

export function smoothstep(t: number): number {
    const x = clamp(t, 0, 1);
    return x * x * (3 - 2 * x);
}

export function rotateAround(
    x: number,
    y: number,
    cx: number,
    cy: number,
    angleRad: number
): { x: number; y: number } {
    const dx = x - cx;
    const dy = y - cy;
    const cos = Math.cos(angleRad);
    const sin = Math.sin(angleRad);
    return {
        x: cx + dx * cos - dy * sin,
        y: cy + dx * sin + dy * cos
    };
}
