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
    springLength: 500, // DEPRECATED - kept for UI compatibility, use targetSpacing

    // Decoupled Spacing Controls (Phase 1)
    // These values preserve exact springLength=500 behavior
    targetSpacing: 375,        // Actual spring rest length (Phase 4: 25% reduction from 500)
    initScale: 0.1,           // Current ratio (springLength * 0.1 for initial positions)
    snapImpulseScale: 0.4,    // Current ratio (springLength * 0.4 for impulse, clamped 120-600)

    // ---------------------------------------------------------------------------
    // ANCHOR: Center-of-Mass (Comfort Field)
    // ---------------------------------------------------------------------------
    // A very weak gravity toward the origin to keep outliers from drifting too far.
    // Usually around 0.01 or so.
    gravityCenterStrength: 0.01,

    // Base radius at which the center gravity is "max". Usually the expected cluster size.
    // Beyond this radius, the Force tapers off.
    gravityBaseRadius: 30,

    // ---------------------------------------------------------------------------
    // ANCHOR: Damping (Air Friction)
    // ---------------------------------------------------------------------------
    // A simple linear fraction of velocity removed per frame.
    // For example, 0.05 means each frame, velocity *= (1 - 0.05).
    damping: 0.90, // High damping for tight control

    // ---------------------------------------------------------------------------
    // ANCHOR: Velocity Cap
    // ---------------------------------------------------------------------------
    maxVelocity: 80,

    // ---------------------------------------------------------------------------
    // ANCHOR: Sleep
    // ---------------------------------------------------------------------------
    // If a node's speed is below this threshold, we might skip physics or mark inactive.
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

    // ---------------------------------------------------------------------------
    // ANCHOR: Personal Space
    // ---------------------------------------------------------------------------
    // Prevent overlap. Hard shell.
    // High strength to act as a solid object.
    collisionStrength: 2000,
    // Small padding to ensure readability (nodes don't kiss)
    collisionPadding: 8,  // Phase 4: 25% reduction from 10

    // ---------------------------------------------------------------------------
    // ANCHOR: Orbital Drift (Anisotropic Damping)
    // ---------------------------------------------------------------------------
    // When to capture equilibrium positions (ms after spawn)
    equilibriumCaptureTime: 600,
    // Heavy damping for radial motion (kills expansion/contraction)
    radialDamping: 0.95,
    // Light damping for tangential motion (LEGACY - replaced by global spin)
    tangentDamping: 0.3,

    // ---------------------------------------------------------------------------
    // ANCHOR: Global Spin (Unified Rotation)
    // ---------------------------------------------------------------------------
    // How fast global spin decays (per second)
    spinDamping: 0.5,
    // How strongly nodes align to global spin direction (0 = ignore, 1 = instant)
    spinBlend: 0.15,

    // ---------------------------------------------------------------------------
    // ANCHOR: Harmonic Net (Uniform Link Lengths)
    // ---------------------------------------------------------------------------
    // Uniform rest length for all springs (creates harmonic net, not stressed web)
    linkRestLength: 130,  // 35% of 375px for tighter spacing
    // Dead zone for soft springs (no force within this band)
    springDeadZone: 0.15,  // ±15% of rest length
};
