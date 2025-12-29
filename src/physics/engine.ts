import { PhysicsNode, PhysicsLink, ForceConfig } from './types';
import { DEFAULT_PHYSICS_CONFIG } from './config';
import { applyRepulsion, applySprings, applyBoundaryForce, applyCollision } from './forces';

export class PhysicsEngine {
    public nodes: Map<string, PhysicsNode> = new Map();
    public links: PhysicsLink[] = [];
    public config: ForceConfig;

    // World Bounds for Containment
    private worldWidth: number = 2000;
    private worldHeight: number = 2000;

    // Interaction State
    private draggedNodeId: string | null = null;
    private dragTarget: { x: number, y: number } | null = null;

    // Lifecycle State (Startup Animation)
    public lifecycle: number = 0;
    private hasFiredImpulse: boolean = false;

    // Rotating Reference Frame (The Medium - initialized at impulse, decays with energy)
    private globalAngle: number = 0;       // Accumulated rotation (radians)
    private globalAngularVel: number = 0;  // Angular velocity (rad/s, + = CCW)

    constructor(config: Partial<ForceConfig> = {}) {
        this.config = { ...DEFAULT_PHYSICS_CONFIG, ...config };
    }

    /**
     * Add a node to the simulation.
     */
    addNode(node: PhysicsNode) {
        this.nodes.set(node.id, node);
        this.wakeNode(node.id);
    }

    /**
     * Add a link between two nodes.
     */
    addLink(link: PhysicsLink) {
        this.links.push(link);
        this.wakeNode(link.source);
        this.wakeNode(link.target);
    }

    /**
     * Clear all entities.
     */
    clear() {
        this.nodes.clear();
        this.links = [];
        this.lifecycle = 0;
        this.hasFiredImpulse = false;
        this.globalAngle = 0;
        this.globalAngularVel = 0;
    }

    /**
     * Update configuration at runtime.
     */
    updateConfig(newConfig: Partial<ForceConfig>) {
        this.config = { ...this.config, ...newConfig };
        this.wakeAll();
    }

    // =========================================================================
    // ROTATING FRAME: Public Access
    // =========================================================================

    /**
     * Get the accumulated global rotation angle (radians).
     * Apply this at render time to rotate all nodes around centroid.
     */
    getGlobalAngle(): number {
        return this.globalAngle;
    }

    /**
     * Get the current centroid of all nodes.
     */
    getCentroid(): { x: number, y: number } {
        const nodeList = Array.from(this.nodes.values());
        if (nodeList.length === 0) return { x: 0, y: 0 };

        let cx = 0, cy = 0;
        for (const node of nodeList) {
            cx += node.x;
            cy += node.y;
        }
        return { x: cx / nodeList.length, y: cy / nodeList.length };
    }

    /**
     * Restart the lifecycle (Explosion effect).
     */
    resetLifecycle() {
        this.lifecycle = 0;
        this.hasFiredImpulse = false;
        this.wakeAll();
    }

    /**
     * Wake up a specific node.
     */
    wakeNode(nodeId: string) {
        const node = this.nodes.get(nodeId);
        if (node) {
            node.warmth = 1.0;
        }
    }

    /**
     * Wake up a node and its neighbors.
     */
    wakeNeighbors(nodeId: string) {
        for (const link of this.links) {
            if (link.source === nodeId) this.wakeNode(link.target);
            if (link.target === nodeId) this.wakeNode(link.source);
        }
    }

    /**
     * Wake up everything (e.g. on config change).
     */
    wakeAll() {
        for (const node of this.nodes.values()) {
            node.warmth = 1.0;
        }
    }

    /**
     * Update World Bounds (from Canvas resize).
     */
    updateBounds(width: number, height: number) {
        this.worldWidth = width;
        this.worldHeight = height;
        this.wakeAll();
    }

    /**
     * Start dragging a node.
     */
    grabNode(nodeId: string, position: { x: number, y: number }) {
        if (this.nodes.has(nodeId)) {
            this.draggedNodeId = nodeId;
            this.dragTarget = { ...position };
            this.wakeNode(nodeId);
            this.wakeNeighbors(nodeId);

            // Note: We don't change restState when dragging
            // The node is marked isFixed and will move with cursor
            // On release, it stays where dropped (no elastic rebound)
            // The hard stop check allows drag to bypass (checks draggedNodeId)
        }
    }

    /**
     * Update drag position.
     */
    moveDrag(position: { x: number, y: number }) {
        if (this.draggedNodeId && this.dragTarget) {
            this.dragTarget = { ...position };
            this.wakeNode(this.draggedNodeId);
            this.wakeNeighbors(this.draggedNodeId);
        }
    }

    /**
     * Release the node.
     */
    releaseNode() {
        this.draggedNodeId = null;
        this.dragTarget = null;
    }

    /**
     * Fire One-Shot Directional Impulse based on Topology.
     * Calculated from spring vectors to "shoot" nodes toward their destinations.
     */
    private fireInitialImpulse() {
        const { targetSpacing, snapImpulseScale } = this.config;

        // Map to store accumulated impulses
        const impulses = new Map<string, { x: number, y: number }>();
        this.nodes.forEach(n => impulses.set(n.id, { x: 0, y: 0 }));

        // Accumulate spring vectors
        for (const link of this.links) {
            const source = this.nodes.get(link.source);
            const target = this.nodes.get(link.target);
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
        this.nodes.forEach(node => {
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
        this.globalAngularVel = (Math.random() - 0.5) * 0.3; // ±0.15 rad/s

        this.hasFiredImpulse = true;
        console.log(`[LotusLeaf] Medium initialized: ω=${this.globalAngularVel.toFixed(4)} rad/s`);
    }

    /**
     * Main Physics Tick.
     * @param dt Delta time in seconds (e.g. 0.016 for 60fps)
     */
    tick(dt: number) {
        const nodeList = Array.from(this.nodes.values());

        // Lifecycle Management
        this.lifecycle += dt;

        // 0. FIRE IMPULSE (One Shot)
        if (this.lifecycle < 0.1 && !this.hasFiredImpulse) {
            this.fireInitialImpulse();
        }



        // =====================================================================
        // EXPONENTIAL COOLING: Energy decays asymptotically, never stops
        // =====================================================================
        // τ (tau) = time constant. After τ seconds, energy is ~37% of initial.
        // After 3τ, energy is ~5%. After 5τ, energy is ~0.7%.
        const tau = 0.3; // 300ms time constant
        const energy = Math.exp(-this.lifecycle / tau);

        // Energy envelope:
        // - At t=0: energy=1.0 (full forces, low damping)
        // - At t=300ms: energy≈0.37
        // - At t=600ms: energy≈0.14
        // - At t=1s: energy≈0.04 (imperceptible)
        // - Never reaches exactly 0

        // Force effectiveness scales with energy
        const forceScale = energy;

        // Damping increases as energy decreases (from 0.3 to 0.98)
        const baseDamping = 0.3;
        const maxDamping = 0.98;
        const effectiveDamping = baseDamping + (maxDamping - baseDamping) * (1 - energy);

        // Max velocity decreases with energy
        const maxVelocityEffective = 50 + 1450 * energy; // 1500 → 50

        // 1. Clear forces
        for (const node of nodeList) {
            node.fx = 0;
            node.fy = 0;
        }

        // 2. Apply Core Forces (scaled by energy)
        applyRepulsion(nodeList, this.config);
        applyCollision(nodeList, this.config, 1.0);
        applySprings(this.nodes, this.links, this.config, 1.0);
        applyBoundaryForce(nodeList, this.config, this.worldWidth, this.worldHeight);

        // Scale all forces by energy envelope
        for (const node of nodeList) {
            node.fx *= forceScale;
            node.fy *= forceScale;
        }

        // 3. Apply Mouse Drag Force (NOT scaled - cursor always wins)
        if (this.draggedNodeId && this.dragTarget) {
            const node = this.nodes.get(this.draggedNodeId);
            if (node) {
                const dx = this.dragTarget.x - node.x;
                const dy = this.dragTarget.y - node.y;
                const dragStrength = 200.0;
                node.fx += dx * dragStrength;
                node.fy += dy * dragStrength;
                node.vx += dx * 2.0 * dt;
                node.vy += dy * 2.0 * dt;
            }
        }

        // 4. Integrate (always runs, never stops)
        let clampHitCount = 0;

        // Calculate live centroid (needed for global spin and anisotropic damping)
        let centroidX = 0, centroidY = 0;
        for (const node of nodeList) {
            centroidX += node.x;
            centroidY += node.y;
        }
        centroidX /= nodeList.length;
        centroidY /= nodeList.length;

        // =====================================================================
        // ROTATING MEDIUM: Spin decays with energy, angle accumulates
        // (Rotation is applied at RENDER time, physics doesn't see it)
        // No capture moment. Spin was initialized at birth and just fades.
        // =====================================================================
        this.globalAngularVel *= Math.exp(-this.config.spinDamping * dt);
        this.globalAngle += this.globalAngularVel * dt;

        // =====================================================================
        // WATER MICRO-DRIFT: The water is alive, not glass
        // Very slow, very tiny drift to globalAngle - "water touching the underside"
        // =====================================================================
        const t = this.lifecycle;
        const microDrift =
            Math.sin(t * 0.3) * 0.0008 +  // ~20 second period, tiny amplitude
            Math.sin(t * 0.7) * 0.0004 +  // ~9 second period, tinier
            Math.sin(t * 1.1) * 0.0002;   // ~6 second period, tiniest
        this.globalAngle += microDrift * dt;

        // =====================================================================
        // INTEGRATION: Simple unified damping (no radial/tangent split)
        // All forces already scaled by energy. Damping increases as energy falls.
        // =====================================================================
        for (const node of nodeList) {
            if (node.isFixed) continue;

            const ax = node.fx / node.mass;
            const ay = node.fy / node.mass;

            // Update Velocity
            node.vx += ax * dt;
            node.vy += ay * dt;

            // Apply unified damping (increases as energy falls)
            node.vx *= (1 - effectiveDamping * dt * 5.0);
            node.vy *= (1 - effectiveDamping * dt * 5.0);

            // Clamp Velocity
            const vSq = node.vx * node.vx + node.vy * node.vy;
            if (vSq > maxVelocityEffective * maxVelocityEffective) {
                const v = Math.sqrt(vSq);
                node.vx = (node.vx / v) * maxVelocityEffective;
                node.vy = (node.vy / v) * maxVelocityEffective;
                clampHitCount++;
            }

            // Update Position
            node.x += node.vx * dt;
            node.y += node.vy * dt;

            // Sleep Check (optional - keeps physics running but zeros micro-motion)
            if (this.config.velocitySleepThreshold) {
                const velSq = node.vx * node.vx + node.vy * node.vy;
                const threshSq = this.config.velocitySleepThreshold * this.config.velocitySleepThreshold;
                if (velSq < threshSq) {
                    node.vx = 0;
                    node.vy = 0;
                }
            }
        }

        // =====================================================================
        // POST-SOLVE EDGE RELAXATION (Shape nudge, not a force)
        // Gently nudge each edge toward target length after physics is done.
        // This creates perceptual uniformity without fighting physics.
        // =====================================================================
        const relaxStrength = 0.02; // 2% correction per frame
        const targetLen = this.config.linkRestLength;

        for (const link of this.links) {
            const source = this.nodes.get(link.source);
            const target = this.nodes.get(link.target);
            if (!source || !target) continue;
            if (source.isFixed && target.isFixed) continue;

            const dx = target.x - source.x;
            const dy = target.y - source.y;
            const d = Math.sqrt(dx * dx + dy * dy);
            if (d < 0.1) continue;

            // How far off are we?
            const error = d - targetLen;

            // Small correction toward target (capped)
            const correction = error * relaxStrength;

            // Direction
            const nx = dx / d;
            const ny = dy / d;

            // Apply to positions (split between nodes)
            if (!source.isFixed && !target.isFixed) {
                source.x += nx * correction * 0.5;
                source.y += ny * correction * 0.5;
                target.x -= nx * correction * 0.5;
                target.y -= ny * correction * 0.5;
            } else if (!source.isFixed) {
                source.x += nx * correction;
                source.y += ny * correction;
            } else if (!target.isFixed) {
                target.x -= nx * correction;
                target.y -= ny * correction;
            }
        }

        // =====================================================================
        // POST-SOLVE SOFT PACKING (Geometry hygiene, not a force)
        // If nodes are too close, nudge positions apart gently.
        // This is circle packing relaxation, not repulsion physics.
        // =====================================================================
        const minDist = this.config.minNodeDistance;
        const packingStrength = 0.1 * energy;  // Fades with energy

        for (let i = 0; i < nodeList.length; i++) {
            const a = nodeList[i];
            if (a.isFixed) continue;

            for (let j = i + 1; j < nodeList.length; j++) {
                const b = nodeList[j];

                const dx = b.x - a.x;
                const dy = b.y - a.y;
                const d = Math.sqrt(dx * dx + dy * dy);

                if (d >= minDist || d < 0.1) continue;  // Only when too close

                // How much overlap?
                const overlap = minDist - d;

                // Small positional correction (not velocity/force)
                const correction = overlap * packingStrength;

                const nx = dx / d;
                const ny = dy / d;

                // Push apart by adjusting positions directly
                if (!a.isFixed && !b.isFixed) {
                    a.x -= nx * correction * 0.5;
                    a.y -= ny * correction * 0.5;
                    b.x += nx * correction * 0.5;
                    b.y += ny * correction * 0.5;
                } else if (!a.isFixed) {
                    a.x -= nx * correction;
                    a.y -= ny * correction;
                } else if (!b.isFixed) {
                    b.x += nx * correction;
                    b.y += ny * correction;
                }
            }
        }

        // DEBUG: Log energy info every 10 frames (~166ms at 60fps)
        if (Math.floor(this.lifecycle * 60) % 10 === 0) {
            console.log(`[Physics] Energy: ${(energy * 100).toFixed(1)}% | Damping: ${effectiveDamping.toFixed(2)} | MaxV: ${maxVelocityEffective.toFixed(0)}`);
        }
    }
}
