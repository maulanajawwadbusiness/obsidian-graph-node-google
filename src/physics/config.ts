import { ForceConfig } from './types';

export const DEFAULT_PHYSICS_CONFIG: ForceConfig = {
    // ---------------------------------------------------------------------------
    // ANCHOR: Idle Spacing & Clusters
    // ---------------------------------------------------------------------------
    // Repulsion is now "Close Range Protection" only.
    // It prevents overlap but doesn't define the general spacing.
    repulsionStrength: 4000,

    // Very short range. 
    // Nodes beyond 60px don't even know each other exists.
    repulsionDistanceMax: 60,

    // ---------------------------------------------------------------------------
    // ANCHOR: Friend-Distance
    // ---------------------------------------------------------------------------
    // Springs are the primary layout driver now.
    // High stiffness = cohesive cluster.
    springStiffness: 0.5,

    // Short length = Tightly packed thoughts.
    springLength: 30,

    // ---------------------------------------------------------------------------
    // ANCHOR: Center-of-Mass (Comfort Field)
    // ---------------------------------------------------------------------------
    // Strong pull to keep the "territory" defined by the center.
    gravityCenterStrength: 0.5,

    // Base scalar for the dynamic safe zone.
    // 10 base -> ~50-80px radius for 20 nodes.
    gravityBaseRadius: 10,

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

    // ---------------------------------------------------------------------------
    // ANCHOR: Screen Containment
    // ---------------------------------------------------------------------------
    // Weak safety net only. 
    // The "Comfort Field" (gravity) should do 99% of the work.
    boundaryMargin: 20,
    boundaryStrength: 10,
};
