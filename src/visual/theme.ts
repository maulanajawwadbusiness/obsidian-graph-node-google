/**
 * Theme configuration for the Graph Physics Playground
 * 
 * This file contains all visual knobs for the graph rendering.
 * Two skins: "normal" (current look) and "elegant" (dark observatory aesthetic)
 */

// -----------------------------------------------------------------------------
// Theme Interface
// -----------------------------------------------------------------------------
export interface ThemeConfig {
    // Background
    background: string;

    // Node rendering
    nodeRadiusMultiplier: number;  // 1.0 = base size, 1.2 = 20% larger
    nodeStyle: 'filled' | 'ring';

    // Ring-specific (elegant mode)
    ringWidth: number;
    ringColor: string;
    occlusionColor: string;       // Same as background to hide links under nodes

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

    // Links
    linkColor: string;
    linkWidth: number;
}

// -----------------------------------------------------------------------------
// Skin Type
// -----------------------------------------------------------------------------
export type SkinMode = 'normal' | 'elegant';

// -----------------------------------------------------------------------------
// Normal Skin (Current Look)
// -----------------------------------------------------------------------------
export const NORMAL_THEME: ThemeConfig = {
    // Background: near-black
    background: '#111111',

    // Nodes: filled blue circles
    nodeRadiusMultiplier: 1.0,
    nodeStyle: 'filled',

    // Ring (not used in normal)
    ringWidth: 1,
    ringColor: '#ffffff',
    occlusionColor: '#111111',

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

    // Links: white, semi-transparent
    linkColor: 'rgba(255, 255, 255, 0.4)',
    linkWidth: 0.4,
};

// -----------------------------------------------------------------------------
// Elegant Skin (Dark Observatory Aesthetic)
// -----------------------------------------------------------------------------
export const ELEGANT_THEME: ThemeConfig = {
    // Background: deep navy-indigo-purple void
    // Not pure black, has subtle blue-purple undertone
    background: '#0a0a14',

    // Nodes: hollow rings, 20% larger
    nodeRadiusMultiplier: 1.2,
    nodeStyle: 'ring',

    // Ring: desaturated pale blue-violet
    ringWidth: 1.8,
    ringColor: 'rgba(180, 190, 220, 0.85)',
    occlusionColor: '#0a0a14',    // Match background

    // Fill (not primary in elegant, but used for fixed nodes)
    nodeFillColor: 'rgba(140, 150, 200, 0.3)',
    nodeFixedColor: 'rgba(200, 120, 140, 0.7)',
    nodeStrokeColor: 'rgba(180, 190, 220, 0.85)',
    nodeStrokeWidth: 1.8,

    // Glow: subtle, soft blue-violet halo
    glowEnabled: true,
    glowColor: 'rgba(140, 160, 220, 0.12)',
    glowRadius: 10,
    glowAlpha: 0.12,

    // Links: darker, thinner, submissive to nodes
    linkColor: 'rgba(100, 115, 160, 0.28)',
    linkWidth: 0.35,
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
