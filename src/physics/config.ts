import { ForceConfig } from './types';

export const DEFAULT_PHYSICS_CONFIG: ForceConfig = {
    // ---------------------------------------------------------------------------
    // ANCHOR: Idle Spacing & Clusters
    // ---------------------------------------------------------------------------
    // Repulsion is now "Physical Volume" only.
    // It prevents overlap but doesn't shape the cloud.
    repulsionStrength: 500, // Reduced from 4000. Just a hard shell.

    // Very short range. Only affects immediate neighbors.
    repulsionDistanceMax: 60,

    // ---------------------------------------------------------------------------
    // ANCHOR: Friend-Distance
    // ---------------------------------------------------------------------------
    // Springs are the PRIMARY layout driver now.
    // High stiffness = the structure snaps into place.
    springStiffness: 0.2, // Moderate stiffness for "unfolding".

    // Define the "relaxed" length of edges.
    springLength: 120,

    // ---------------------------------------------------------------------------
    // ANCHOR: Center-of-Mass (Comfort Field)
    // ---------------------------------------------------------------------------
    // Weak leash only. Prevents drifting off-screen.
    // Does NOT compress the graph.
    gravityCenterStrength: 0.01, // Reduced from 0.5.

    // Base scalar for the dynamic safe zone.
    // 10 base -> ~50-80px radius for 20 nodes.
    gravityBaseRadius: 30, // Relaxed radius.

    // ---------------------------------------------------------------------------
    // ANCHOR: Calm-down & Drag-Lag
    // ---------------------------------------------------------------------------
    // High damping to preventing "bouncing". 
    // We want "settling".
    damping: 0.85,

    // ---------------------------------------------------------------------------
    // Safety
    // ---------------------------------------------------------------------------
    maxVelocity: 80, // Cap lower to prevent initial explosion speed.

    // Stop moving if slower than this. Eliminate micro-jitter.
    velocitySleepThreshold: 0.1,

    // ---------------------------------------------------------------------------
    // ANCHOR: Cooling / Phase Shift
    // ---------------------------------------------------------------------------
    // Longer forming time to allow the "unfolding" to happen gracefully.
    formingTime: 2.0,
    restForceScale: 0.05,

    // ---------------------------------------------------------------------------
    // ANCHOR: Screen Containment
    // ---------------------------------------------------------------------------
    boundaryMargin: 50,
    boundaryStrength: 50,
};
