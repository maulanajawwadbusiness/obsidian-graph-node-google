export interface Vector2 {
  x: number;
  y: number;
}

export interface PhysicsNode {
  id: string;
  // Position
  x: number;
  y: number;
  // Velocity
  vx: number;
  vy: number;
  // Accumulated Force (cleared every tick)
  fx: number;
  fy: number;

  // Physical properties
  mass: number;    // Affects how hard it is to move
  radius: number;  // For collision/repulsion radius

  // State
  isFixed: boolean; // If true, physics ignores position updates (useful for dragging)
  warmth?: number; // 0.0 (Cold) to 1.0 (Hot). Defaults to 1.0 if undefined.
  role?: 'spine' | 'rib' | 'fiber'; // Topology role for directed impulse weighting


  // Display (optional)
  label?: string; // Text label to show below node
  // Orbital Drift (captured at equilibrium time)
  equilibrium?: { x: number, y: number }; // Settled position for anisotropic damping

  // Directional inertia (prevents correction direction churn)
  lastCorrectionDir?: { x: number, y: number }; // Normalized direction of last frame's correction

  // Force memory for temporal lag (early-expansion symmetry breaking)
  prevFx?: number; // Previous frame's force for low-pass filtering
  prevFy?: number;

  // Knowledge Metadata (Paper Analyzer)
  meta?: {
    docId: string;
    sourceTitle: string;   // The "Point Title"
    sourceSummary: string; // The "Paragraph"
  };
}

export interface PhysicsLink {
  source: string; // Node ID
  target: string; // Node ID
  length?: number; // Optional override for resting length
  strength?: number; // Optional override for stiffness

  // Organic Variation (Multipliers)
  lengthBias?: number; // e.g. 0.8 to 1.3
  stiffnessBias?: number; // e.g. 0.9 to 1.1
}

export interface ForceConfig {
  // Repulsion (Node-Node)
  repulsionStrength: number; // How strongly nodes push eac other away
  repulsionDistanceMax: number; // Distance at which repulsion is 0 (optimization)

  // Springs (Links)
  springStiffness: number; // How "stiff" the link is (0.0 to 1.0 usually)
  springLength: number;    // Ideal resting distance (DEPRECATED - use targetSpacing)

  // Decoupled Spacing Controls (Phase 1)
  targetSpacing: number;      // Actual spring rest length (replaces springLength semantically)
  initScale: number;          // Initial placement compression (e.g., 0.1 = tight start)
  snapImpulseScale: number;   // Impulse force multiplier (e.g., 0.4 = current ratio)

  // Gravity (Center)
  gravityCenterStrength: number; // Pull toward (0,0) usually
  // gravityRange removed in favor of dynamic calc
  // But we need a base scalar for population sizing
  gravityBaseRadius: number;

  // Damping / Friction
  damping: number; // Velocity decay 0.0 (no friction) to 1.0 (frozen)

  // Constraints
  maxVelocity: number; // Cap speed to prevent explosions
  velocitySleepThreshold?: number; // Stop moving if slower than this (e.g. 0.01)

  // Cooling / Phase Shift
  formingTime: number; // Time in seconds to stay "hot"
  restForceScale: number; // Multiplier for forces when "cold"

  // Boundary
  boundaryMargin: number;
  boundaryStrength: number;

  // ---------------------------------------------------------------------------
  // Personal Space (Collision)
  // ---------------------------------------------------------------------------
  collisionStrength: number; // Stiffness of the personal bubble
  collisionPadding: number; // Extra radius around node to keep empty

  // ---------------------------------------------------------------------------
  // Orbital Drift (Anisotropic Damping)
  // ---------------------------------------------------------------------------
  equilibriumCaptureTime: number; // When to capture equilibrium positions (ms)
  radialDamping: number;   // Damping for motion toward/away from equilibrium (kills expansion)
  tangentDamping: number;  // Damping for orbital motion (preserves curl) - LEGACY, use spinBlend

  // ---------------------------------------------------------------------------
  // Global Spin (Unified Rotation)
  // ---------------------------------------------------------------------------
  spinDamping: number;   // How fast global spin decays (per second)
  spinBlend: number;     // How strongly nodes align to global spin direction

  // ---------------------------------------------------------------------------
  // Harmonic Net (Uniform Link Lengths)
  // ---------------------------------------------------------------------------
  linkRestLength: number;  // Uniform rest length for all springs (px)
  springDeadZone: number;  // Fraction of rest length where force is minimal (0.15 = ±15%)

  // ---------------------------------------------------------------------------
  // Soft Spacing (Personal Space)
  // ---------------------------------------------------------------------------
  minNodeDistance: number;        // Hard minimum distance between all nodes (px)
  softRepulsionStrength: number;  // Very low strength for personal space effect
  minEdgeAngle: number;           // Minimum angle between edges at a node (radians)

  // Soft pre-zone before hard barrier
  softDistanceMultiplier: number; // D_soft = D_hard * multiplier (default 1.5)
  softRepulsionExponent: number;  // How sharply resistance ramps up (default 2.5)
  softMaxCorrectionPx: number;    // Max correction per pair per frame in soft zone (default 2.0)
  maxCorrectionPerFrame: number;  // Global max correction per pair per frame (default 1.5)
  hardSoftnessBand: number;       // Fraction of minDist for smoothstep ramp (default 0.2)
  clampHysteresisMargin: number;  // Buffer above minDist before releasing clamp (default 5px)
  maxNodeCorrectionPerFrame: number;  // Per-node correction budget to prevent pileup (default 0.5px)
  contactSlop: number;            // Zone above minDist for gradual velocity projection (default 12px)
  expansionResistance: number;    // Degree-based velocity damping during expansion (default 0.15)

  // Pairwise pass throttling
  pairwiseMaxChecks: number; // Target max pair checks per pass before sampling
  pairwiseMaxStride: number; // Upper bound for sampling stride

  // Debug
  debugPerf?: boolean; // Enable per-pass timing logs (once per second)
}
