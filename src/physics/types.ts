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
  springLength: number;    // Ideal resting distance

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
}
