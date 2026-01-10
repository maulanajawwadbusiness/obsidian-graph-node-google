import { PhysicsNode } from '../physics/types';

export type GraphTheme = {
    name: 'normal' | 'elegant';
    background: {
        baseColor: string;
        vignetteInner: string;
        vignetteOuter: string;
    };
    node: {
        style: 'filled' | 'ring';
        radiusScale: number;
        ringThicknessRatio: number;
        ringColor: string;
        innerRimColor: string;
        glowColor: string;
        glowBlur: number;
        occlusionColor: string;
        occlusionPadding: number;
        fillColor: string;
        strokeColor: string;
        strokeWidth: number;
    };
    link: {
        color: string;
        thickness: number;
    };
};

// Node size knob for the elegant theme (single source of truth).
const NODE_RADIUS_SCALE_ELEGANT = 1.2;

// Palette knobs live here: tweak colors to tune the feel.
export const themeNormal: GraphTheme = {
    name: 'normal',
    background: {
        baseColor: '#111318',
        vignetteInner: 'rgba(30, 34, 46, 0.25)',
        vignetteOuter: 'rgba(5, 6, 10, 0.75)',
    },
    node: {
        style: 'filled',
        radiusScale: 1.0,
        ringThicknessRatio: 0.28,
        ringColor: '#b7d2ff',
        innerRimColor: 'rgba(255, 255, 255, 0.7)',
        glowColor: 'rgba(120, 160, 255, 0.0)',
        glowBlur: 0,
        occlusionColor: '#111318',
        occlusionPadding: 1.5,
        fillColor: '#4488ff',
        strokeColor: '#ffffff',
        strokeWidth: 1,
    },
    link: {
        color: 'rgba(255, 255, 255, 0.35)',
        thickness: 0.4,
    },
};

export const themeElegant: GraphTheme = {
    name: 'elegant',
    background: {
        // PASS 2: True void. Infinite depth.
        baseColor: '#060709',  // Near-black with cold undertone
        vignetteInner: 'rgba(10, 12, 18, 0.08)',  // Ghost of a center
        vignetteOuter: 'rgba(0, 0, 0, 0.25)',  // Subtle pressure at edges
    },
    node: {
        style: 'ring',
        radiusScale: NODE_RADIUS_SCALE_ELEGANT,
        ringThicknessRatio: 0.26,  // PASS 2: thicker = more authority
        // PASS 2: Violet is mystery. Push it.
        ringColor: 'rgba(155, 150, 220, 1.0)',  // Full opacity, violet dominant
        innerRimColor: 'rgba(210, 200, 255, 0.75)',  // Bright violet-white edge
        // Glow: tighter, more violet, appears on motion
        glowColor: 'rgba(140, 120, 210, 0.3)',  // Richer violet
        glowBlur: 10,  // Tighter = crisper plane separation
        occlusionColor: '#060709',  // Match void
        occlusionPadding: 1.8,  // Slightly tighter occlusion
        fillColor: '#0d0f14',  // Hollow reads as intentional void
        strokeColor: 'rgba(175, 160, 255, 0.45)',
        strokeWidth: 1,
    },
    link: {
        // PASS 2: Quiet skeleton. Present but humble.
        color: 'rgba(90, 100, 140, 0.32)',  // Pulled back slightly
        thickness: 0.55,  // Hair thinner
    },
};

const getBaseNodeRadius = (node: PhysicsNode, useVariedSize: boolean) =>
    useVariedSize ? node.radius : 5.0;

export const getRenderNodeRadius = (node: PhysicsNode, theme: GraphTheme, useVariedSize: boolean) =>
    getBaseNodeRadius(node, useVariedSize) * theme.node.radiusScale;

export const getRingThickness = (radius: number, theme: GraphTheme) =>
    Math.max(1, radius * theme.node.ringThicknessRatio);

export const getOcclusionRadius = (radius: number, ringThickness: number, theme: GraphTheme) =>
    // Occlusion size: ring thickness + padding so link lines disappear beneath nodes.
    radius + ringThickness * 0.6 + theme.node.occlusionPadding;

export const drawBackground = (ctx: CanvasRenderingContext2D, width: number, height: number, theme: GraphTheme) => {
    ctx.save();
    ctx.fillStyle = theme.background.baseColor;
    ctx.fillRect(0, 0, width, height);

    const gradient = ctx.createRadialGradient(
        width * 0.5,
        height * 0.45,
        Math.min(width, height) * 0.1,
        width * 0.5,
        height * 0.5,
        Math.max(width, height) * 0.7
    );
    gradient.addColorStop(0, theme.background.vignetteInner);
    gradient.addColorStop(1, theme.background.vignetteOuter);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
};
