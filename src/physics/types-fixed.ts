export interface Vector2 {
    x: number;
    y: number;
}

/**
 * Physics node (immutable in this design)
 */
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

    // Doc viewer integration (v1)
    docRefs?: import('../document/bridge/nodeDocRef').NodeDocRefV1[];
    primaryDocRefId?: string;
}
