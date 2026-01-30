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
    occlusionShrinkPct: number;   // How much smaller occlusion disk is vs node outer radius (0.10 = 10% smaller)

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

    // Energy-driven glow (hoverEnergy modulates glow intensity + blur)
    glowInnerAlphaBase: number;      // Ambient alpha when nodeEnergy=0 (0.04)
    glowInnerAlphaBoost: number;     // Additional alpha at nodeEnergy=1 (0.14)
    glowInnerBlurBase: number;       // Ambient blur radius (6)
    glowInnerBlurBoost: number;      // Additional blur at nodeEnergy=1 (10)
    glowOuterAlphaBase: number;      // Ambient alpha when nodeEnergy=0 (0.02)
    glowOuterAlphaBoost: number;     // Additional alpha at nodeEnergy=1 (0.10)
    glowOuterBlurBase: number;       // Ambient blur radius (14)
    glowOuterBlurBoost: number;      // Additional blur at nodeEnergy=1 (20)
    glowEnergyGamma: number;         // Response curve (1.0 = linear)
    glowIdleMultiplier: number;      // Multiplier for idle glow baseline (energy=0)
    glowIdleFadeExponent: number;   // Idle-only lift fade (higher = less effect near hover)

    // Links
    linkColor: string;
    linkWidth: number;

    // Hover interaction (basic)
    primaryBlueDefault: string;   // Dark blue when not hovered
    primaryBlueHover: string;     // Bright blue when hovered
    hoverRadiusMultiplier: number; // DEPRECATED - use hoverHaloMultiplier
    hoverDebugEnabled: boolean;    // Show debug overlay + console logs
    hoverDebugStateSentinel: boolean; // Log canvas state sentinel once

    // Hover energy system (smooth proximity)
    hoverHaloMultiplier: number;       // Detection radius = nodeRadius * this (1.8)
    hoverHaloPaddingPx: number;        // Additional halo radius padding in pixels
    hoverHitPaddingPx: number;         // Additional hit radius padding in pixels
    calmModeEnabled: boolean;          // Temporal stabilization for hover selection
    minHoverHoldMs: number;            // Minimum time to hold a hovered node before switching
    switchDebounceMs: number;          // Candidate must stay best for this long before switch
    exitGraceMs: number;               // Grace period outside halo before clearing
    hoverEnergyTauMs: number;          // Time smoothing constant in ms (120)
    hoverStickyExitMultiplier: number; // Hysteresis for exit (1.05)
    hoverSwitchMarginPx: number;       // Anti ping-pong margin for node switching (8)
    hoverRingWidthBoost: number;       // Max ring width boost at full energy (0.1 = 10%)
    hoverGlowBoost: number;            // Max glow alpha boost at full energy (0.15)

    // Hover scale (energy-driven node size growth)
    nodeScaleIdle: number;             // Scale multiplier at energy=0 (1.0)
    nodeScaleHover: number;            // Scale multiplier at energy=1 (1.2)
    glowBlurScaleBoost: number;        // Glow blur expansion factor at energy=1 (0.2 = 20% wider)

    // Text labels
    labelEnabled: boolean;
    labelFontSize: number;             // Font size in px
    labelFontFamily: string;           // Font family
    labelColor: string;                // Label text color
    labelOffsetBasePx: number;         // Base offset below node at energy=0
    labelOffsetHoverPx: number;        // Additional offset at energy=1
    labelAlphaBase: number;            // Alpha at energy=0
    labelAlphaHover: number;           // Alpha at energy=1
    labelEnergyGamma: number;          // Response curve (1.0 = linear)
    labelDebugEnabled: boolean;        // Show anchor cross + bbox
    labelForceHorizontal: boolean;     // Force labels to be screen-horizontal (cancel rotation)
}

// -----------------------------------------------------------------------------
// Skin Type
// -----------------------------------------------------------------------------
export type SkinMode = 'normal' | 'elegant';

// -------------------------------------------------------------------------
// Interaction Toggles
// -------------------------------------------------------------------------
export const DRAG_ENABLED = true;

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
    occlusionShrinkPct: 0.10,  // 10% smaller than outer radius

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

    // Energy-driven glow (disabled for normal mode)
    glowInnerAlphaBase: 0,
    glowInnerAlphaBoost: 0,
    glowInnerBlurBase: 0,
    glowInnerBlurBoost: 0,
    glowOuterAlphaBase: 0,
    glowOuterAlphaBoost: 0,
    glowOuterBlurBase: 0,
    glowOuterBlurBoost: 0,
    glowEnergyGamma: 1.0,
    glowIdleMultiplier: 1.0,
    glowIdleFadeExponent: 1.0,

    // Links: white, semi-transparent
    linkColor: 'rgba(255, 255, 255, 0.4)',
    linkWidth: 0.4,

    // Hover interaction (not used in normal mode)
    primaryBlueDefault: '#4488ff',
    primaryBlueHover: '#4488ff',
    hoverRadiusMultiplier: 2.0,
    hoverDebugEnabled: false,
    hoverDebugStateSentinel: false,

    // Hover energy system (disabled in normal mode)
    hoverHaloMultiplier: 1.0,
    hoverHaloPaddingPx: 0,
    hoverHitPaddingPx: 0,
    calmModeEnabled: false,
    minHoverHoldMs: 0,
    switchDebounceMs: 0,
    exitGraceMs: 0,
    hoverEnergyTauMs: 120,
    hoverStickyExitMultiplier: 1.0,
    hoverSwitchMarginPx: 0,
    hoverRingWidthBoost: 0,
    hoverGlowBoost: 0,

    // Hover scale (disabled in normal mode)
    nodeScaleIdle: 1.0,
    nodeScaleHover: 1.0,
    glowBlurScaleBoost: 0,

    // Text labels (disabled in normal mode)
    labelEnabled: false,
    labelFontSize: 11,
    labelFontFamily: 'sans-serif',
    labelColor: 'rgba(255,255,255,0.7)',
    labelOffsetBasePx: 6,
    labelOffsetHoverPx: 0,
    labelAlphaBase: 0.7,
    labelAlphaHover: 0.7,
    labelEnergyGamma: 1.0,
    labelDebugEnabled: false,
    labelForceHorizontal: true,
};

// -----------------------------------------------------------------------------
// Elegant Skin V2 (Dark Power Aesthetic)
// Strong electric blue, gradients into rich dark purple
// -----------------------------------------------------------------------------

// TUNING KNOB: Change this to scale nodes and rings proportionally
const ELEGANT_NODE_SCALE = 1.2;

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
    occlusionShrinkPct: 0.10,     // Occlusion disk is 10% smaller than node outer radius (adaptive)

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

    // Energy-driven glow (hoverEnergy modulates glow intensity + blur)
    // TUNING KNOBS: adjust for "breathing" feel
    glowInnerAlphaBase: 0.025,       // Ambient alpha when nodeEnergy=0 (quiet but alive) - increased 25%
    glowInnerAlphaBoost: 0.175,      // Additional alpha at nodeEnergy=1 (clearly stronger) - increased 25%
    glowInnerBlurBase: 9,            // Ambient blur radius (soft base) - increased 50%
    glowInnerBlurBoost: 10,          // Additional blur at nodeEnergy=1 (expands)
    glowOuterAlphaBase: 0.0125,      // Ambient outer alpha (whisper) - increased 25%
    glowOuterAlphaBoost: 0.125,      // Additional outer alpha at nodeEnergy=1 - increased 25%
    glowOuterBlurBase: 21,           // Ambient outer blur (atmosphere) - increased 50%
    glowOuterBlurBoost: 20,          // Additional outer blur at nodeEnergy=1 (exhale)
    glowEnergyGamma: 1.0,            // Response curve (1.0 = linear, <1 = faster attack)
    glowIdleMultiplier: 8.0,         // Idle baseline boost (energy=0) while preserving active endpoint
    glowIdleFadeExponent: 4.0,       // Fade idle lift quickly as energy rises

    // Links: indigo-tinted, submissive but not dead
    linkColor: 'rgba(61, 72, 87, 0.38)',
    linkWidth: 0.6,

    // Hover interaction (basic)
    primaryBlueDefault: '#63abff',  // Dark blue (no hover)
    primaryBlueHover: '#63abff',    // Bright blue (hovered)
    hoverRadiusMultiplier: 2.2,     // DEPRECATED
    hoverDebugEnabled: false,        // Debug mode (re-enable to see radius/halo circles)
    hoverDebugStateSentinel: false, // Extra debug logging (state sentinel)

    // Hover energy system (smooth proximity)
    hoverHaloMultiplier: 1.8,       // Detection radius = nodeRadius * 1.8
    hoverHaloPaddingPx: 32,         // Extra intent halo in pixels (stays forgiving at small scales)
    hoverHitPaddingPx: 10,          // Extra hit padding in pixels
    calmModeEnabled: true,          // Temporal stabilization for hover selection
    minHoverHoldMs: 120,            // Hold hovered node for 120ms before switching
    switchDebounceMs: 60,           // Require sustained candidate for 60ms
    exitGraceMs: 60,                // Allow brief exits without clearing
    hoverEnergyTauMs: 120,          // Smoothing time constant (Apple feel)
    hoverStickyExitMultiplier: 1.05,// Hysteresis for exit
    hoverSwitchMarginPx: 8,         // Anti ping-pong margin
    hoverRingWidthBoost: 0.1,       // 10% max ring width boost
    hoverGlowBoost: 0.15,           // Max glow alpha boost

    // Hover scale (Apple-smooth enlargement)
    nodeScaleIdle: 1.0,
    nodeScaleHover: 1.2,            // 20% larger on hover
    glowBlurScaleBoost: 0.2,        // Glow breathes 20% wider at full energy

    // Text labels (Obsidian-style)
    labelEnabled: true,
    labelFontSize: 11,
    labelFontFamily: 'system-ui, -apple-system, sans-serif',
    labelColor: 'rgba(180, 190, 210, 0.85)',
    labelOffsetBasePx: 8,
    labelOffsetHoverPx: 4,
    labelAlphaBase: 0.6,
    labelAlphaHover: 1.0,
    labelEnergyGamma: 1.0,
    labelDebugEnabled: false,
    labelForceHorizontal: true,
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
 * Get occlusion disk radius (adaptively sized to be slightly smaller than node)
 * Formula: occlusionR = outerR * (1 - shrinkPct)
 * where outerR = nodeRadius + ringWidth * 0.5
 */
export function getOcclusionRadius(nodeRadius: number, theme: ThemeConfig): number {
    // Calculate node's outer radius (center to ring outer edge)
    const outerRadius = nodeRadius + theme.ringWidth * 0.5;

    // Shrink occlusion disk by configured percentage (default 10%)
    const shrinkPct = Math.max(0, Math.min(0.35, theme.occlusionShrinkPct)); // Clamp [0, 0.35]
    const occlusionRadius = outerRadius * (1 - shrinkPct);

    // Safety floor: ensure it's at least big enough to hide center links
    const minRadius = nodeRadius * 0.55;

    return Math.max(occlusionRadius, minRadius);
}


/**
 * Get energy-driven scale multiplier for node rendering.
 * Linear interpolation from idle to hover scale.
 */
export function getNodeScale(nodeEnergy: number, theme: ThemeConfig): number {
    const e = Math.max(0, Math.min(1, nodeEnergy));
    return theme.nodeScaleIdle + (theme.nodeScaleHover - theme.nodeScaleIdle) * e;
}
// -----------------------------------------------------------------------------
// Color Utilities for Gradient Ring
// -----------------------------------------------------------------------------

function clampChannel(value: number): number {
    return Math.max(0, Math.min(255, value));
}

/**
 * Parse hex color to RGB object
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (result) {
        return {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        };
    }

    const rgbMatch = /^rgba?\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)(?:\s*,\s*([0-9.]+))?\s*\)$/i.exec(hex);
    if (rgbMatch) {
        const r = Math.round(Number(rgbMatch[1]));
        const g = Math.round(Number(rgbMatch[2]));
        const b = Math.round(Number(rgbMatch[3]));
        return {
            r: clampChannel(r),
            g: clampChannel(g),
            b: clampChannel(b)
        };
    }

    return { r: 0, g: 0, b: 0 };
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
