// Fix 40: Device Pixel Quantization
// Unifies snapping across Render/Overlay/Input layers.
export const quantizeToDevicePixel = (px: number, dpr: number) => {
    // Avoid degenerate dpr
    const safeDpr = Math.max(0.1, dpr);
    return Math.round(px * safeDpr) / safeDpr;
};

// Fix 22: Half-Pixel Stroke Alignment
// If stroke width (in device pixels) is ODD, we strictly need to snap to (N + 0.5) pixels.
// If stroke width is EVEN, we snap to N.0 pixels.
export const quantizeForStroke = (px: number, strokeWidthCss: number, dpr: number) => {
    const safeDpr = Math.max(0.1, dpr);
    const widthDev = strokeWidthCss * safeDpr;
    const isOdd = Math.abs(widthDev % 2 - 1) < 0.01; // Close to 1 (e.g. 0.99 or 1.01)

    if (isOdd) {
        // Snap to grid + 0.5 device pixels
        // (Floor(x * dpr) + 0.5) / dpr
        return (Math.floor(px * safeDpr) + 0.5) / safeDpr;
    } else {
        // Snap to nearest integer device pixel
        return Math.round(px * safeDpr) / safeDpr;
    }
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
