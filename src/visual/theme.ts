/**
 * Theme configuration for the Graph Physics Playground
 * 
 * This file contains all visual knobs for the graph rendering.
 * Two skins: "normal" (current look) and "elegant" (dark power aesthetic v2)
 */

// -----------------------------------------------------------------------------
// Theme Interface
// -----------------------------------------------------------------------------
export interface ThemeConfig {
    // Background
    background: string;

    // V2 Vignette Background
    useVignette: boolean;
    vignetteCenterColor: string;
    vignetteEdgeColor: string;
    vignetteStrength: number;  // 0.0 - 1.0

    // Node rendering - Master scale control
    nodeScale: number;  // Master scale: 1.0 = base, 1.2 = 20% larger (affects both radius and ring width)
    nodeRadiusMultiplier: number;  // Derived from nodeScale
    nodeStyle: 'filled' | 'ring';

    // Ring-specific (elegant mode)
    ringWidth: number;  // Derived from nodeScale
    ringColor: string;
    occlusionColor: string;       // Same as background to hide links under nodes

    // V2 Gradient Ring
    useGradientRing: boolean;
    primaryBlue: string;
    deepPurple: string;
    ringGradientSegments: number;  // 32-64 for smooth gradient
    gradientRotationDegrees: number;  // Rotation offset: 0° = blue at right, 150° = blue top-right, purple bottom-left

    // Fill-specific (normal mode)
    nodeFillColor: string;
    nodeFixedColor: string;
    nodeStrokeColor: string;
    nodeStrokeWidth: number;

    // Glow (elegant mode)
    glowEnabled: boolean;
    glowColor: string;
    glowRadius: number;           // Blur radius for glow
    glowAlpha: number;

    // V2 Two-Layer Glow
    useTwoLayerGlow: boolean;
    glowInnerColor: string;
    glowInnerRadius: number;
    glowInnerAlpha: number;
    glowOuterColor: string;
    glowOuterRadius: number;
    glowOuterAlpha: number;

    // Links
    linkColor: string;
    linkWidth: number;
}

// -----------------------------------------------------------------------------
// Skin Type
// -----------------------------------------------------------------------------
export type SkinMode = 'normal' | 'elegant';

// -----------------------------------------------------------------------------
// Normal Skin (Current Look) - Unchanged
// -----------------------------------------------------------------------------
export const NORMAL_THEME: ThemeConfig = {
    // Background: near-black
    background: '#111111',

    // Vignette (disabled)
    useVignette: false,
    vignetteCenterColor: '#111111',
    vignetteEdgeColor: '#111111',
    vignetteStrength: 0,

    // Node scale (master control)
    nodeScale: 1.0,

    // Nodes: filled blue circles
    nodeRadiusMultiplier: 1.0,  // = nodeScale * 1.0
    nodeStyle: 'filled',

    // Ring (not used in normal)
    ringWidth: 1,  // = nodeScale * 1.0
    ringColor: '#ffffff',
    occlusionColor: '#111111',

    // Gradient ring (disabled)
    useGradientRing: false,
    primaryBlue: '#4488ff',
    deepPurple: '#4488ff',
    ringGradientSegments: 1,
    gradientRotationDegrees: 0,

    // Fill
    nodeFillColor: '#4488ff',
    nodeFixedColor: '#ff4444',
    nodeStrokeColor: '#ffffff',
    nodeStrokeWidth: 1,

    // Glow (disabled)
    glowEnabled: false,
    glowColor: 'rgba(68, 136, 255, 0.2)',
    glowRadius: 8,
    glowAlpha: 0.2,

    // Two-layer glow (disabled)
    useTwoLayerGlow: false,
    glowInnerColor: 'rgba(68, 136, 255, 0.2)',
    glowInnerRadius: 8,
    glowInnerAlpha: 0.2,
    glowOuterColor: 'rgba(68, 136, 255, 0.1)',
    glowOuterRadius: 16,
    glowOuterAlpha: 0.1,

    // Links: white, semi-transparent
    linkColor: 'rgba(255, 255, 255, 0.4)',
    linkWidth: 0.4,
};

// -----------------------------------------------------------------------------
// Elegant Skin V2 (Dark Power Aesthetic)
// Strong electric blue, gradients into rich dark purple
// -----------------------------------------------------------------------------

// TUNING KNOB: Change this to scale nodes and rings proportionally
const ELEGANT_NODE_SCALE = 4;

// Base ratios (don't change these, change ELEGANT_NODE_SCALE instead)
const ELEGANT_BASE_RING_WIDTH_RATIO = 2.08;  // ring width relative to scale

export const ELEGANT_THEME: ThemeConfig = {
    // Background: deep navy-indigo-purple void
    background: '#0a0a12',

    // Vignette: center slightly lighter, edges darker
    useVignette: true,
    vignetteCenterColor: '#0f0f1a',
    vignetteEdgeColor: '#050508',
    vignetteStrength: 0.7,

    // Node scale (master control) - this is the TUNING KNOB
    nodeScale: ELEGANT_NODE_SCALE,

    // Nodes: hollow rings, scaled by nodeScale
    nodeRadiusMultiplier: ELEGANT_NODE_SCALE * 1.0,
    nodeStyle: 'ring',

    // Ring: strong electric blue (fallback if gradient disabled)
    ringWidth: ELEGANT_NODE_SCALE * ELEGANT_BASE_RING_WIDTH_RATIO,
    ringColor: '#63abff',
    occlusionColor: '#0a0a12',    // Match background

    // Gradient ring: blue → purple
    useGradientRing: true,
    primaryBlue: '#63abff',       // rgb(99, 171, 255) - electric blue
    deepPurple: '#4a2a6a',        // rich dark purple (visible, not dead)
    ringGradientSegments: 48,     // smooth gradient
    gradientRotationDegrees: 170, // TUNING KNOB: rotation angle (150° = purple bottom-left)

    // Fill (for fixed nodes)
    nodeFillColor: 'rgba(99, 171, 255, 0.3)',
    nodeFixedColor: 'rgba(255, 120, 140, 0.8)',
    nodeStrokeColor: '#63abff',
    nodeStrokeWidth: ELEGANT_NODE_SCALE * ELEGANT_BASE_RING_WIDTH_RATIO,

    // Single glow (legacy, disabled in favor of two-layer)
    glowEnabled: false,
    glowColor: 'rgba(99, 171, 255, 0.2)',
    glowRadius: 10,
    glowAlpha: 0.2,

    // Two-layer glow: inner blue + outer purple
    useTwoLayerGlow: true,
    glowInnerColor: 'rgba(99, 171, 255, 0.22)',   // blue, closer
    glowInnerRadius: 8,
    glowInnerAlpha: 0.22,
    glowOuterColor: 'rgba(100, 60, 160, 0.12)',   // purple, wider
    glowOuterRadius: 20,
    glowOuterAlpha: 0.12,

    // Links: indigo-tinted, submissive but not dead
    linkColor: 'rgba(99, 140, 200, 0.38)',
    linkWidth: 0.6,
};

// -----------------------------------------------------------------------------
// Theme Getter
// -----------------------------------------------------------------------------
export function getTheme(skin: SkinMode): ThemeConfig {
    return skin === 'elegant' ? ELEGANT_THEME : NORMAL_THEME;
}

// -----------------------------------------------------------------------------
// Derived Calculations (convenience functions)
// -----------------------------------------------------------------------------

/**
 * Get the effective node radius for rendering
 */
export function getNodeRadius(baseRadius: number, theme: ThemeConfig): number {
    return baseRadius * theme.nodeRadiusMultiplier;
}

/**
 * Get occlusion disk radius (slightly larger than node to hide links cleanly)
 */
export function getOcclusionRadius(nodeRadius: number, theme: ThemeConfig): number {
    // Add small padding to ensure links don't peek through
    return nodeRadius + theme.ringWidth * 0.5 + 1;
}

// -----------------------------------------------------------------------------
// Color Utilities for Gradient Ring
// -----------------------------------------------------------------------------

/**
 * Parse hex color to RGB object
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 };
}

/**
 * Interpolate between two hex colors
 */
export function lerpColor(colorA: string, colorB: string, t: number): string {
    const a = hexToRgb(colorA);
    const b = hexToRgb(colorB);
    const r = Math.round(a.r + (b.r - a.r) * t);
    const g = Math.round(a.g + (b.g - a.g) * t);
    const bl = Math.round(a.b + (b.b - a.b) * t);
    return `rgb(${r}, ${g}, ${bl})`;
}
