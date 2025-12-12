import { ForceConfig } from './types';

export const DEFAULT_PHYSICS_CONFIG: ForceConfig = {
    // ---------------------------------------------------------------------------
    // ANCHOR: Idle Spacing & Clusters
    // ---------------------------------------------------------------------------
    // We want nodes to spread out comfortably but not fly off screen.
    // Higher repulsion = more spread.
    repulsionStrength: 8000,

    // Cutoff for repulsion.
    // If too small, clusters overlap.
    // If too large, everything pushes everything (O(N^2) perf hit).
    // ~300-500 is usually a good balance for "local clouds".
    repulsionDistanceMax: 250,

    // ---------------------------------------------------------------------------
    // ANCHOR: Friend-Distance
    // ---------------------------------------------------------------------------
    // Controls the "spring" feel between connected nodes.

    // [0.0 - 1.0]. Low = loose rubber band. High = steel wire.
    // For "Obsidian-like", we want a soft-ish spring that allows some stretch
    // but snaps back.
    springStiffness: 0.2,

    // The ideal distance between linked nodes.
    // Should be large enough to read labels if we had them.
    springLength: 100,

    // ---------------------------------------------------------------------------
    // ANCHOR: Center-of-Mass
    // ---------------------------------------------------------------------------
    // Keeps the graph centered so it doesn't drift away.
    // A weak pull is usually sufficient.
    gravityCenterStrength: 0.05,

    // ---------------------------------------------------------------------------
    // ANCHOR: Calm-down & Drag-Lag
    // ---------------------------------------------------------------------------
    // Damping is CRITICAL for the "Jelly" feel.
    // It acts like air resistance.

    // 0.8 to 0.9 is usually "thick jelly". 
    // 0.95 is "molasses".
    // < 0.8 feels "slippery" or "space-like".
    // We want it to settle quickly (1-3s), so a relatively high damping is good.
    damping: 0.80,

    // ---------------------------------------------------------------------------
    // Safety
    // ---------------------------------------------------------------------------
    // Prevents "explosions" if forces get too high (e.g. initial spawn overlap).
    maxVelocity: 150,
};
