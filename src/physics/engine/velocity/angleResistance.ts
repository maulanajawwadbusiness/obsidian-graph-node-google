import type { PhysicsEngine } from '../../engine';
import type { PhysicsNode } from '../../types';
import { getPassStats, type DebugStats } from '../stats';

export const applyAngleResistanceVelocity = (
    engine: PhysicsEngine,
    nodeList: PhysicsNode[],
    nodeDegreeEarly: Map<string, number>,
    energy: number,
    stats: DebugStats,
    dt: number
) => {
    const passStats = getPassStats(stats, 'AngleResistance');
    const affected = new Set<string>();

    // Zone boundaries (radians)
    const DEG_TO_RAD = Math.PI / 180;
    const ANGLE_FREE = 60 * DEG_TO_RAD;        // No resistance
    const ANGLE_PRETENSION = 45 * DEG_TO_RAD;  // Start gentle resistance
    const ANGLE_SOFT = 30 * DEG_TO_RAD;        // Main working zone
    const ANGLE_EMERGENCY = 20 * DEG_TO_RAD;   // Steep resistance + damping
    // Below ANGLE_EMERGENCY = Forbidden zone

    // Resistance multipliers by zone
    const RESIST_PRETENSION_MAX = 0.15;
    const RESIST_SOFT_MAX = 1.0;
    const RESIST_EMERGENCY_MAX = 3.5;
    const RESIST_FORBIDDEN = 8.0;

    // Base force strength
    const angleForceStrength = 25.0;

    // Build adjacency map: node -> list of neighbors
    const neighbors = new Map<string, string[]>();
    for (const node of nodeList) {
        neighbors.set(node.id, []);
    }
    for (const link of engine.links) {
        neighbors.get(link.source)?.push(link.target);
        neighbors.get(link.target)?.push(link.source);
    }

    // For each node with 2+ neighbors
    for (const node of nodeList) {
        const nbIds = neighbors.get(node.id);
        if (!nbIds || nbIds.length < 2) continue;

        // Compute angle of each edge
        const edges: { id: string; angle: number; r: number }[] = [];
        for (const nbId of nbIds) {
            const nb = engine.nodes.get(nbId);
            if (!nb) continue;
            const dx = nb.x - node.x;
            const dy = nb.y - node.y;
            const r = Math.sqrt(dx * dx + dy * dy);
            if (r < 0.1) continue;
            edges.push({ id: nbId, angle: Math.atan2(dy, dx), r });
        }

        // Sort by angle
        edges.sort((a, b) => a.angle - b.angle);

        // Check adjacent pairs (including wrap-around)
        for (let i = 0; i < edges.length; i++) {
            const curr = edges[i];
            const next = edges[(i + 1) % edges.length];

            // Angular difference (handle wrap-around)
            let theta = next.angle - curr.angle;
            if (theta < 0) theta += 2 * Math.PI;

            // Zone A: Free - no resistance
            if (theta >= ANGLE_FREE) continue;

            // PHASE-AWARE: During expansion, disable most angle resistance
            // Only allow emergency zones D/E to prevent collapse
            const isExpansion = energy > 0.7;

            // Compute resistance based on zone (continuous curve)
            let resistance: number;
            let localDamping = 1.0;

            if (theta >= ANGLE_PRETENSION) {
                // Zone B: Pre-tension (45-60°)
                if (isExpansion) continue;  // DISABLED during expansion
                const t = (ANGLE_FREE - theta) / (ANGLE_FREE - ANGLE_PRETENSION);
                const ease = t * t;  // Quadratic ease-in
                resistance = ease * RESIST_PRETENSION_MAX;
            } else if (theta >= ANGLE_SOFT) {
                // Zone C: Soft constraint (30-45°)
                if (isExpansion) continue;  // DISABLED during expansion
                const t = (ANGLE_PRETENSION - theta) / (ANGLE_PRETENSION - ANGLE_SOFT);
                const ease = t * t * (3 - 2 * t);  // Smoothstep
                resistance = RESIST_PRETENSION_MAX + ease * (RESIST_SOFT_MAX - RESIST_PRETENSION_MAX);
            } else if (theta >= ANGLE_EMERGENCY) {
                // Zone D: Emergency (20-30°)
                const t = (ANGLE_SOFT - theta) / (ANGLE_SOFT - ANGLE_EMERGENCY);
                const ease = t * t * t;  // Cubic ease-in
                // During expansion: reduced resistance (emergency only)
                const expansionScale = isExpansion ? 0.3 : 1.0;
                resistance = (RESIST_SOFT_MAX + ease * (RESIST_EMERGENCY_MAX - RESIST_SOFT_MAX)) * expansionScale;
                localDamping = isExpansion ? 1.0 : 0.92;  // No extra damping during expansion
            } else {
                // Zone E: Forbidden (<20°)
                const penetration = ANGLE_EMERGENCY - theta;
                const t = Math.min(penetration / (10 * DEG_TO_RAD), 1);
                // During expansion: prevent collapse only, don't open angles
                const expansionScale = isExpansion ? 0.5 : 1.0;
                resistance = (RESIST_EMERGENCY_MAX + t * (RESIST_FORBIDDEN - RESIST_EMERGENCY_MAX)) * expansionScale;
                localDamping = isExpansion ? 0.95 : 0.85;  // Lighter damping during expansion
            }

            // Get neighbor nodes
            const currNb = engine.nodes.get(curr.id);
            const nextNb = engine.nodes.get(next.id);
            if (!currNb || !nextNb) continue;

            // Force magnitude (no expansion boost - gating handles expansion)
            const force = resistance * angleForceStrength * dt;

            // Apply tangential force (push edges apart along angle bisector)
            // currNb rotates clockwise, nextNb rotates counter-clockwise
            const applyTangentialForce = (nb: typeof currNb, edge: typeof curr, direction: number) => {
                if (nb.isFixed) return;
                const nbDeg = nodeDegreeEarly.get(nb.id) || 0;
                if (nbDeg === 1) return;  // Skip dangling nodes

                // EARLY-PHASE HUB PRIVILEGE + ESCAPE WINDOW
                const nbEscape = engine.escapeWindow.has(nb.id);
                if ((energy > 0.85 && nbDeg >= 3) || nbEscape) return;

                // Tangent direction (perpendicular to radial)
                const radialX = (nb.x - node.x) / edge.r;
                const radialY = (nb.y - node.y) / edge.r;
                const tangentX = -radialY * direction;
                const tangentY = radialX * direction;

                const beforeVx = nb.vx;
                const beforeVy = nb.vy;

                nb.vx += tangentX * force;
                nb.vy += tangentY * force;

                // Apply local damping in emergency/forbidden zones
                if (localDamping < 1.0) {
                    nb.vx *= localDamping;
                    nb.vy *= localDamping;
                }

                const dvx = nb.vx - beforeVx;
                const dvy = nb.vy - beforeVy;
                const deltaMag = Math.sqrt(dvx * dvx + dvy * dvy);
                if (deltaMag > 0) {
                    passStats.velocity += deltaMag;
                    affected.add(nb.id);
                }
            };

            applyTangentialForce(currNb, curr, -1);  // Clockwise
            applyTangentialForce(nextNb, next, 1);   // Counter-clockwise
        }
    }

    passStats.nodes += affected.size;
};
