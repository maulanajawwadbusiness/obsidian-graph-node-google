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
    repulsionMinDistance: 6,
    repulsionMaxForce: 1200,

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
    initStrategy: 'spread',   // Default to spread seeding (no explosion start)

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
    sleepFramesThreshold: 30,

    // ---------------------------------------------------------------------------
    // ANCHOR: Cooling / Phase Shift
    // ---------------------------------------------------------------------------
    // Longer forming time to allow the "unfolding" to happen gracefully.
    formingTime: 2.0,
    restForceScale: 0.05,

    // ---------------------------------------------------------------------------
    // ANCHOR: Tick Control
    // ---------------------------------------------------------------------------
    targetTickHz: 60,
    maxStepsPerFrame: 6,
    maxFrameDeltaMs: 120,
    maxPhysicsBudgetMs: 12,
    dtHugeMs: 250,

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
    collisionMaxForce: 1800,

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

    // ---------------------------------------------------------------------------
    // ANCHOR: Soft Spacing (Personal Space)
    // ---------------------------------------------------------------------------
    // Soft minimum distance between all nodes (personal space, not collision)
    minNodeDistance: 100,
    // Very low strength for personal space effect (spatial etiquette, not physics dominance)
    softRepulsionStrength: 5,
    // Minimum angle between edges at a node (30 degrees = π/6)
    minEdgeAngle: Math.PI / 6,

    // Soft pre-zone before hard barrier
    softDistanceMultiplier: 1.5,  // D_soft = D_hard * 1.5
    softRepulsionExponent: 2.5,   // How sharply resistance ramps up
    softMaxCorrectionWorld: 2.0,     // Max correction in soft zone
    maxCorrectionPerFrame: 1.5,   // Global max to prevent snapping
    hardSoftnessBand: 0.2,        // Fraction of minDist for smoothstep ramp
    clampHysteresisMargin: 25,    // Wide buffer to make clamp imperceptible
    maxNodeCorrectionPerFrame: 0.5,  // Per-node budget to prevent multi-constraint pileup
    contactSlop: 12,              // Zone above minDist for gradual velocity projection
    expansionResistance: 0.15,    // Degree-based velocity damping during expansion (0-1)
    correctionDiffusionBase: 0.6,
    correctionDiffusionMin: 0.2,
    correctionDiffusionDensityScale: 0.15,
    correctionDiffusionSpacingScale: 0.5,
    spacingGateOnEnergy: 0.72,
    spacingGateOffEnergy: 0.78,
    spacingGateRampStart: 0.75,
    spacingGateRampEnd: 0.45,
    spacingGateRiseTime: 0.6,
    spacingGateEnableThreshold: 0.02,
    spacingCascadeGate: 0.25,
    spacingCascadePhaseModulo: 3,
    spacingCascadeSpacingPhase: 2,
    pairwiseMaxChecks: 60000,
    pairwiseMaxStride: 8,
    maxLinksPerNode: 12,
    maxTotalLinks: 2000,

    // ---------------------------------------------------------------------------
    // ANCHOR: Adaptive Scaling Thresholds
    // ---------------------------------------------------------------------------
    perfModeNStressed: 250,
    perfModeNEmergency: 500,
    perfModeNFatal: 900,
    perfModeEStressed: 1200,
    perfModeEEmergency: 2000,
    perfModeEFatal: 3000,
    perfModeDownshiftRatio: 0.9,
    debugPerf: false,
    debugStall: false,
    enableMicroDrift: false, // Fix #16: Stable by default
    debugAllowEarlyExpansion: false,
    useXPBD: true,

    // XPBD Calibration (Mini Run 6)
    // CRITICAL FIX: 0.0001 was TOO STIFF (caused explosion on drag release)
    // Smaller compliance = stiffer = larger corrections = unstable
    // 0.01 provides visible corrections (~0.2px) without explosion
    xpbdLinkCompliance: 0.01,  // Stable, visible corrections
    // xpbdMaxCorrPerConstraintPx: undefined,  // No cap by default (trust the solver)
};
