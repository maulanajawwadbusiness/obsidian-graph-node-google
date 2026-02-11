import type { PhysicsEngine } from '../engine';
import { pseudoRandom } from './random';

export const fireInitialImpulse = (engine: PhysicsEngine, timestamp: number = 0) => {
    const { targetSpacing, snapImpulseScale } = engine.config;

    // Map to store accumulated impulses
    const impulses = new Map<string, { x: number, y: number }>();
    engine.nodes.forEach(n => impulses.set(n.id, { x: 0, y: 0 }));

    // Accumulate spring vectors
    for (const link of engine.links) {
        const source = engine.nodes.get(link.source);
        const target = engine.nodes.get(link.target);
        if (!source || !target) continue;

        const dx = target.x - source.x;
        const dy = target.y - source.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1; // Avoid zero div

        // Normalized direction
        const nx = dx / dist;
        const ny = dy / dist;

        // Simple "Kick" magnitude based on stiffness
        // We want to kick them APART if they are too close, or TOGETHER if too far.
        // But usually at start they are too close (compressed).
        // Current distance is small (~10-50px). Target is ~60px.
        // Spring force would naturally push them apart if d < restLen?? Link force is hooked.
        // Standard Hooke's Law: F = k * (curr - rest).
        // If curr < rest, force is negative (push apart? or pull together depending on sign convention).
        // In forces.ts: displacement = d - effectiveLength.
        // If d=10, len=60, disp = -50.
        // Force acts to increase d. So it pushes apart.

        // Impulse magnitude scales with targetSpacing but is clamped to prevent explosions
        // This ensures snap strength matches geometry scale while staying controlled
        const forceBase = Math.max(120, Math.min(600, targetSpacing * snapImpulseScale));

        impulses.get(source.id)!.x += nx * forceBase;
        impulses.get(source.id)!.y += ny * forceBase;

        impulses.get(target.id)!.x -= nx * forceBase;
        impulses.get(target.id)!.y -= ny * forceBase;
    }

    // Apply to Velocity with Role Weighting
    engine.nodes.forEach(node => {
        const imp = impulses.get(node.id);
        if (!imp) return;

        let roleWeight = 1.0;
        if (node.role === 'spine') roleWeight = 1.5; // Spine kicks harder
        if (node.role === 'rib') roleWeight = 1.0;
        if (node.role === 'fiber') roleWeight = 0.5; // Fibers are lighter, drift

        // Apply Impulse
        // Standardize kick direction?
        // Actually, if we just use the spring vector, it might be chaotic.
        // Is there a "direction" we want?
        // Current initialization is small cluster -> Expand.
        // The spring forces (repulsion in hooke terms) will naturally expand.
        // We just boost it 100x for one frame.

        node.vx += imp.x * roleWeight;
        node.vy += imp.y * roleWeight;
    });

    // Initialize the global spin (the medium) at birth
    // Small random spin to give the lotus leaf its initial drift
    // This is NOT derived from node velocities - it's the medium itself
    // KICK: Small random rotation to break symmetry
    const seed = engine.nodes.size + engine.links.length;
    engine.globalAngularVel = (pseudoRandom(seed) - 0.5) * 0.3; // +/-0.15 rad/s

    engine.hasFiredImpulse = true;
    console.log(`[LotusLeaf] Medium initialized: omega=${engine.globalAngularVel.toFixed(4)} rad/s at t=${timestamp.toFixed(0)}`);
};
