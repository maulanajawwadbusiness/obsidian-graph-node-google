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

    // Hysteresis state for hard clamp (tracks pairs currently in clamped state)
    private clampedPairs = new Set<string>();

    // Pre-roll phase: soft separation before expansion (frames remaining)
    private preRollFrames: number = 5;  // ~80ms at 60fps

    // Escape window: frames remaining for trapped nodes to skip constraints
    private escapeWindow = new Map<string, number>();

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
        this.preRollFrames = 5;  // Reset pre-roll
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

        // =====================================================================
        // SOFT PRE-ROLL PHASE (Gentle separation before expansion)
        // Springs at 10%, spacing on, angle off, velocity-only corrections
        // Runs for ~5 frames before expansion starts
        // =====================================================================
        if (this.preRollFrames > 0 && !this.hasFiredImpulse) {
            this.preRollFrames--;

            // Compute node degrees for hub detection
            const preRollDegree = new Map<string, number>();
            this.nodes.forEach(n => preRollDegree.set(n.id, 0));
            for (const link of this.links) {
                preRollDegree.set(link.source, (preRollDegree.get(link.source) || 0) + 1);
                preRollDegree.set(link.target, (preRollDegree.get(link.target) || 0) + 1);
            }

            // Pre-roll fade: topology forces ramp from 0 → 1 as pre-roll ends
            // At frame 5: fade = 0, at frame 0: fade = 1
            const topologyFade = 1 - (this.preRollFrames / 5);

            // Clear forces
            for (const node of nodeList) {
                node.fx = 0;
                node.fy = 0;
            }

            // Apply springs with HUB TOPOLOGY SCALING
            // Hubs (degree >= 3) get much weaker springs during pre-roll
            const { springStiffness } = this.config;
            for (const link of this.links) {
                const source = this.nodes.get(link.source);
                const target = this.nodes.get(link.target);
                if (!source || !target) continue;

                let dx = target.x - source.x;
                let dy = target.y - source.y;
                if (dx === 0 && dy === 0) {
                    dx = (Math.random() - 0.5) * 0.1;
                    dy = (Math.random() - 0.5) * 0.1;
                }
                const d = Math.sqrt(dx * dx + dy * dy);
                const restLength = this.config.linkRestLength;
                const displacement = d - restLength;

                const baseK = link.strength ?? springStiffness;
                const forceMagnitude = baseK * displacement * 0.1;  // Base 10% during pre-roll

                const fx = (dx / d) * forceMagnitude;
                const fy = (dy / d) * forceMagnitude;

                // Hub scaling: degree >= 3 gets 25% of spring force, fading back to 100%
                const sourceDeg = preRollDegree.get(link.source) || 0;
                const targetDeg = preRollDegree.get(link.target) || 0;
                const sourceHubScale = sourceDeg >= 3 ? (0.25 + 0.75 * topologyFade) : 1.0;
                const targetHubScale = targetDeg >= 3 ? (0.25 + 0.75 * topologyFade) : 1.0;

                if (!source.isFixed) {
                    source.fx += fx * sourceHubScale;
                    source.fy += fy * sourceHubScale;
                }
                if (!target.isFixed) {
                    target.fx -= fx * targetHubScale;
                    target.fy -= fy * targetHubScale;
                }
            }

            // Apply spacing repulsion between all pairs
            const minDist = this.config.minNodeDistance;
            for (let i = 0; i < nodeList.length; i++) {
                const a = nodeList[i];
                for (let j = i + 1; j < nodeList.length; j++) {
                    const b = nodeList[j];
                    const dx = b.x - a.x;
                    const dy = b.y - a.y;
                    const d = Math.sqrt(dx * dx + dy * dy);

                    if (d < minDist && d > 0.1) {
                        const overlap = minDist - d;
                        const nx = dx / d;
                        const ny = dy / d;

                        // Apply as velocity, not position
                        const strength = overlap * 2.0;  // Moderate push
                        if (!a.isFixed) {
                            a.vx -= nx * strength;
                            a.vy -= ny * strength;
                        }
                        if (!b.isFixed) {
                            b.vx += nx * strength;
                            b.vy += ny * strength;
                        }
                    }
                }
            }

            // Compute centroid for carrier rotation
            let cx = 0, cy = 0;
            for (const node of nodeList) {
                cx += node.x;
                cy += node.y;
            }
            cx /= nodeList.length;
            cy /= nodeList.length;

            // MICRO CARRIER DRIFT: Prevent crystallization into eigenvector directions
            // Adds shared rotational motion so separation feels like drifting water
            // Fades out from frame 5 → 0
            const carrierOmega = 0.03;  // rad/frame, ~1.8 rad/s at 60fps
            const fade = this.preRollFrames / 5;  // 1.0 at frame 5, 0.2 at frame 1
            const effectiveOmega = carrierOmega * fade;

            // Apply carrier rotation to velocities (rotate velocity frame around centroid)
            for (const node of nodeList) {
                if (node.isFixed) continue;

                // Position relative to centroid
                const rx = node.x - cx;
                const ry = node.y - cy;

                // Tangential velocity from rotation
                const tangentX = -ry * effectiveOmega;
                const tangentY = rx * effectiveOmega;

                // Add to velocity (not position)
                node.vx += tangentX;
                node.vy += tangentY;
            }

            // NULL-FORCE SYMMETRY BREAKING (individual + cluster-level)
            // When hub nodes have near-zero net force, add tiny deterministic bias
            // Prevents starfish/brick eigenmodes from symmetric force cancellation
            const epsilon = 0.5;  // Near-zero threshold
            const biasStrength = 0.3;  // ~1% of typical spring force
            const clusterBiasStrength = 0.5;  // Stronger for deep clusters

            // Build neighbor map for cluster detection
            const neighborMap = new Map<string, string[]>();
            for (const node of nodeList) {
                neighborMap.set(node.id, []);
            }
            for (const link of this.links) {
                neighborMap.get(link.source)?.push(link.target);
                neighborMap.get(link.target)?.push(link.source);
            }

            // Precompute which nodes are in "null-force" state
            const isNullForce = new Map<string, boolean>();
            for (const node of nodeList) {
                const deg = preRollDegree.get(node.id) || 0;
                const fMag = Math.sqrt(node.fx * node.fx + node.fy * node.fy);
                isNullForce.set(node.id, deg >= 3 && fMag < epsilon);
            }

            for (const node of nodeList) {
                if (node.isFixed) continue;

                const deg = preRollDegree.get(node.id) || 0;
                if (deg < 3) continue;  // Only hubs

                const fMag = Math.sqrt(node.fx * node.fx + node.fy * node.fy);
                if (fMag >= epsilon) continue;  // Has meaningful force, no bias needed

                // Check if neighbors are ALSO in null-force state (cluster detection)
                const neighbors = neighborMap.get(node.id) || [];
                let nullNeighborCount = 0;
                let clusterCx = 0, clusterCy = 0;

                for (const nbId of neighbors) {
                    if (isNullForce.get(nbId)) {
                        const nb = this.nodes.get(nbId);
                        if (nb) {
                            nullNeighborCount++;
                            clusterCx += nb.x;
                            clusterCy += nb.y;
                        }
                    }
                }

                if (nullNeighborCount > 0) {
                    // CLUSTER-LEVEL BIAS: push away from null-force neighbor centroid
                    clusterCx /= nullNeighborCount;
                    clusterCy /= nullNeighborCount;

                    let dx = node.x - clusterCx;
                    let dy = node.y - clusterCy;
                    const d = Math.sqrt(dx * dx + dy * dy);

                    if (d > 0.1) {
                        // Push away from cluster centroid
                        node.fx += (dx / d) * clusterBiasStrength;
                        node.fy += (dy / d) * clusterBiasStrength;
                    }

                    // Mark this node for ESCAPE WINDOW (skip constraints for next 6 frames)
                    this.escapeWindow.set(node.id, 6);
                } else {
                    // Individual bias (original behavior)
                    let hash = 0;
                    for (let i = 0; i < node.id.length; i++) {
                        hash = ((hash << 5) - hash) + node.id.charCodeAt(i);
                        hash |= 0;
                    }
                    const angle = (hash % 1000) / 1000 * 2 * Math.PI;
                    node.fx += Math.cos(angle) * biasStrength;
                    node.fy += Math.sin(angle) * biasStrength;
                }
            }

            // Integrate velocities with MICRO-ACCUMULATION
            // Reduced damping allows velocity to build up for continuous motion
            const preRollMaxSpeed = 8.0;  // Soft velocity cap during pre-roll
            for (const node of nodeList) {
                if (node.isFixed) continue;
                node.vx += (node.fx / node.mass) * dt;
                node.vy += (node.fy / node.mass) * dt;
                node.x += node.vx * dt;
                node.y += node.vy * dt;

                // Very light damping (0.995) - allows velocity accumulation
                node.vx *= 0.995;
                node.vy *= 0.995;

                // Soft velocity cap instead of hard cancellation
                const vMag = Math.sqrt(node.vx * node.vx + node.vy * node.vy);
                if (vMag > preRollMaxSpeed) {
                    const scale = preRollMaxSpeed / vMag;
                    node.vx *= scale;
                    node.vy *= scale;
                }
            }

            // End of pre-roll: DO NOT zero velocities - let motion continue seamlessly
            if (this.preRollFrames === 0) {
                console.log('[PreRoll] Soft separation complete, velocities preserved');
            }

            return;  // Skip main tick during pre-roll
        }

        // 0. FIRE IMPULSE (One Shot)
        if (this.lifecycle < 0.1 && !this.hasFiredImpulse) {
            this.fireInitialImpulse();
        }

        // ESCAPE WINDOW MANAGEMENT: decrement counters for trapped nodes
        // These nodes skip topology constraints to allow sliding out
        for (const [nodeId, frames] of this.escapeWindow.entries()) {
            if (frames > 0) {
                this.escapeWindow.set(nodeId, frames - 1);
            } else {
                this.escapeWindow.delete(nodeId);
            }
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
        applySprings(this.nodes, this.links, this.config, 1.0, energy);
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

            // DEGREE-BASED INERTIA: High-degree nodes feel heavier
            // Prevents hub overshoot → no visible corrections
            let inertiaDeg = 0;
            for (const link of this.links) {
                if (link.source === node.id || link.target === node.id) inertiaDeg++;
            }
            const massFactor = 0.4;  // How much degree increases mass
            const effectiveMass = node.mass * (1 + massFactor * Math.max(inertiaDeg - 1, 0));

            const ax = node.fx / effectiveMass;
            const ay = node.fy / effectiveMass;

            // Update Velocity
            node.vx += ax * dt;
            node.vy += ay * dt;

            // EARLY-PHASE SYMMETRY BREAKING: Prevent symmetric force cancellation in hubs
            // Only active during early expansion (energy > 0.7), fades out smoothly
            // Deterministic direction based on node ID hash
            if (energy > 0.7) {
                // Count degree inline
                let deg = 0;
                for (const link of this.links) {
                    if (link.source === node.id || link.target === node.id) deg++;
                }

                if (deg >= 3) {
                    // TRAPPED HUB CARRIER FLOW
                    // Detect trapped hub: low net force AND low velocity
                    const fMag = Math.sqrt(node.fx * node.fx + node.fy * node.fy);
                    const vMag = Math.sqrt(node.vx * node.vx + node.vy * node.vy);
                    const forceEpsilon = 1.0;
                    const velocityThreshold = 0.5;

                    const isTrapped = fMag < forceEpsilon && vMag < velocityThreshold;

                    if (isTrapped) {
                        // Compute local cluster centroid (nearby hub nodes)
                        let clusterCx = 0, clusterCy = 0;
                        let clusterCount = 0;

                        for (const otherNode of nodeList) {
                            if (otherNode.id === node.id) continue;
                            const dx = otherNode.x - node.x;
                            const dy = otherNode.y - node.y;
                            const dist = Math.sqrt(dx * dx + dy * dy);

                            // Only nearby nodes (within 2x minNodeDistance)
                            if (dist < this.config.minNodeDistance * 2) {
                                clusterCx += otherNode.x;
                                clusterCy += otherNode.y;
                                clusterCount++;
                            }
                        }

                        if (clusterCount > 0) {
                            clusterCx /= clusterCount;
                            clusterCy /= clusterCount;

                            // Direction from centroid to node
                            const toCx = node.x - clusterCx;
                            const toCy = node.y - clusterCy;
                            const toD = Math.sqrt(toCx * toCx + toCy * toCy);

                            if (toD > 0.1) {
                                // Perpendicular direction (tangent to centroid)
                                const perpX = -toCy / toD;
                                const perpY = toCx / toD;

                                // Fade: 1.0 at energy=1.0, 0.0 at energy=0.7
                                const fade = Math.min((energy - 0.7) / 0.3, 1);
                                const smoothFade = fade * fade * (3 - 2 * fade);

                                // Very small velocity bias
                                const carrierStrength = 0.05 * smoothFade;

                                node.vx += perpX * carrierStrength;
                                node.vy += perpY * carrierStrength;
                            }
                        }
                    }
                }
            }

            // Apply unified damping (increases as energy falls)
            node.vx *= (1 - effectiveDamping * dt * 5.0);
            node.vy *= (1 - effectiveDamping * dt * 5.0);

            // HUB INERTIA: High-degree nodes feel heavier (slower velocity response)
            // This is mass-like behavior during velocity integration, NOT damping
            // Computed inline to avoid second loop
            let nodeDeg = 0;
            for (const link of this.links) {
                if (link.source === node.id || link.target === node.id) nodeDeg++;
            }
            if (nodeDeg > 2) {
                const hubFactor = Math.min((nodeDeg - 2) / 4, 1);
                const hubVelocityScale = 0.7;  // How slow hubs respond
                const velScale = 1.0 - hubFactor * (1.0 - hubVelocityScale);
                node.vx *= velScale;
                node.vy *= velScale;
            }

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
        // COMPUTE NODE DEGREES (needed early for degree-1 exclusion)
        // Degree-1 nodes (dangling limbs) are excluded from positional corrections
        // =====================================================================
        const nodeDegreeEarly = new Map<string, number>();
        for (const node of nodeList) {
            nodeDegreeEarly.set(node.id, 0);
        }
        for (const link of this.links) {
            nodeDegreeEarly.set(link.source, (nodeDegreeEarly.get(link.source) || 0) + 1);
            nodeDegreeEarly.set(link.target, (nodeDegreeEarly.get(link.target) || 0) + 1);
        }

        // =====================================================================
        // PHASE-AWARE EXPANSION RESISTANCE (Degree-based velocity damping)
        // High-degree nodes lose momentum gradually during expansion
        // Prevents "hitting invisible wall" - feels like mass increasing
        // =====================================================================
        if (energy > 0.7) {
            const expResist = this.config.expansionResistance;

            for (const node of nodeList) {
                if (node.isFixed) continue;

                const degree = nodeDegreeEarly.get(node.id) || 0;
                if (degree <= 1) continue;  // Only affects multi-connected nodes

                // Normalize degree: (degree-1)/4 → 0..1
                const degNorm = Math.min((degree - 1) / 4, 1);
                // Smoothstep for gradual ramp
                const resistance = degNorm * degNorm * (3 - 2 * degNorm);

                // Apply as velocity damping (not position correction)
                const damp = 1 - resistance * expResist;
                node.vx *= damp;
                node.vy *= damp;
            }
        }

        // =====================================================================
        // PER-NODE CORRECTION BUDGET SYSTEM
        // All constraints request position corrections via accumulator
        // Total correction magnitude is clamped to prevent multi-constraint pileup
        // =====================================================================
        const correctionAccum = new Map<string, { dx: number; dy: number }>();
        for (const node of nodeList) {
            correctionAccum.set(node.id, { dx: 0, dy: 0 });
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

            // Request correction via accumulator (split between nodes)
            // DEGREE-1 EXCLUSION: dangling nodes don't receive positional correction
            const sourceAccum = correctionAccum.get(source.id);
            const targetAccum = correctionAccum.get(target.id);
            const sourceDeg = nodeDegreeEarly.get(source.id) || 0;
            const targetDeg = nodeDegreeEarly.get(target.id) || 0;

            if (!source.isFixed && !target.isFixed) {
                if (sourceAccum && sourceDeg > 1) {
                    sourceAccum.dx += nx * correction * 0.5;
                    sourceAccum.dy += ny * correction * 0.5;
                }
                if (targetAccum && targetDeg > 1) {
                    targetAccum.dx -= nx * correction * 0.5;
                    targetAccum.dy -= ny * correction * 0.5;
                }
            } else if (!source.isFixed && sourceAccum && sourceDeg > 1) {
                sourceAccum.dx += nx * correction;
                sourceAccum.dy += ny * correction;
            } else if (!target.isFixed && targetAccum && targetDeg > 1) {
                targetAccum.dx -= nx * correction;
                targetAccum.dy -= ny * correction;
            }
        }

        // =====================================================================
        // DISTANCE-BASED SPACING (Soft pre-zone + Hard barrier)
        // Soft zone: resistance ramps up as nodes approach hard barrier
        // Hard zone: guarantee separation (dots never touch)
        // Gated by energy: completely disabled during expansion
        // Shadow barrier during expansion: prevent overlaps from deepening
        // =====================================================================
        const D_hard = this.config.minNodeDistance;

        if (energy <= 0.7) {
            // SETTLING PHASE: full spacing with smoothstep gate
            const D_soft = D_hard * this.config.softDistanceMultiplier;
            const softExponent = this.config.softRepulsionExponent;
            const softMaxCorr = this.config.softMaxCorrectionPx;

            // Spacing gate: smoothstep for settling strength (0 at energy=0.7, 1 at energy=0.4)
            const gateT = Math.max(0, Math.min(1, (0.7 - energy) / 0.3));
            const spacingGate = gateT * gateT * (3 - 2 * gateT);  // smoothstep

            for (let i = 0; i < nodeList.length; i++) {
                const a = nodeList[i];

                for (let j = i + 1; j < nodeList.length; j++) {
                    const b = nodeList[j];

                    const dx = b.x - a.x;
                    const dy = b.y - a.y;
                    const d = Math.sqrt(dx * dx + dy * dy);

                    if (d >= D_soft || d < 0.1) continue;  // Outside soft zone or singularity

                    // Normalize direction (from a toward b)
                    const nx = dx / d;
                    const ny = dy / d;

                    let corr: number;

                    if (d <= D_hard) {
                        // HARD ZONE: smoothstep ramp to eliminate chattering
                        const penetration = D_hard - d;
                        const softnessBand = D_hard * this.config.hardSoftnessBand;
                        const t = Math.min(penetration / softnessBand, 1);  // 0→1
                        const ramp = t * t * (3 - 2 * t);  // smoothstep
                        corr = penetration * ramp;
                    } else {
                        // SOFT ZONE: resistance ramps up as d approaches D_hard
                        const t = (D_soft - d) / (D_soft - D_hard);  // 0 at D_soft, 1 at D_hard
                        const s = Math.pow(t, softExponent);
                        corr = s * softMaxCorr;
                    }

                    // Rate-limit and gate by energy (minimal during expansion)
                    const maxCorr = this.config.maxCorrectionPerFrame;
                    const corrApplied = Math.min(corr * spacingGate, maxCorr);

                    // Request correction via accumulator (equal split)
                    // DEGREE-1 EXCLUSION: dangling nodes don't receive positional correction
                    const aAccum = correctionAccum.get(a.id);
                    const bAccum = correctionAccum.get(b.id);
                    const aDeg = nodeDegreeEarly.get(a.id) || 0;
                    const bDeg = nodeDegreeEarly.get(b.id) || 0;

                    // EARLY-PHASE HUB PRIVILEGE + ESCAPE WINDOW
                    const aEscape = this.escapeWindow.has(a.id);
                    const bEscape = this.escapeWindow.has(b.id);
                    const aHubSkip = (energy > 0.85 && aDeg >= 3) || aEscape;
                    const bHubSkip = (energy > 0.85 && bDeg >= 3) || bEscape;

                    if (!a.isFixed && !b.isFixed) {
                        if (aAccum && aDeg > 1 && !aHubSkip) {
                            aAccum.dx -= nx * corrApplied * 0.5;
                            aAccum.dy -= ny * corrApplied * 0.5;
                        }
                        if (bAccum && bDeg > 1 && !bHubSkip) {
                            bAccum.dx += nx * corrApplied * 0.5;
                            bAccum.dy += ny * corrApplied * 0.5;
                        }
                    } else if (!a.isFixed && aAccum && aDeg > 1 && !aHubSkip) {
                        aAccum.dx -= nx * corrApplied;
                        aAccum.dy -= ny * corrApplied;
                    } else if (!b.isFixed && bAccum && bDeg > 1 && !bHubSkip) {
                        bAccum.dx += nx * corrApplied;
                        bAccum.dy += ny * corrApplied;
                    }
                }
            }
        }  // End energy gate
        // =====================================================================
        // TRIANGLE AREA SPRING (Face-level constraint, not spacing)
        // Each triangle has a rest area. If current area < rest area,
        // push vertices outward along altitude directions.
        // =====================================================================

        // Rest area for equilateral triangle with edge = linkRestLength
        const L = this.config.linkRestLength;
        const restArea = (Math.sqrt(3) / 4) * L * L;
        const areaStrength = 0.0005 * energy;  // Very soft, fades with energy

        // Build adjacency set for triangle detection
        const connectedPairs = new Set<string>();
        for (const link of this.links) {
            const key = [link.source, link.target].sort().join(':');
            connectedPairs.add(key);
        }

        // Find all triangles (A-B-C where all pairs connected)
        const triangles: [string, string, string][] = [];
        const nodeIds = nodeList.map(n => n.id);

        for (let i = 0; i < nodeIds.length; i++) {
            for (let j = i + 1; j < nodeIds.length; j++) {
                const keyAB = [nodeIds[i], nodeIds[j]].sort().join(':');
                if (!connectedPairs.has(keyAB)) continue;

                for (let k = j + 1; k < nodeIds.length; k++) {
                    const keyAC = [nodeIds[i], nodeIds[k]].sort().join(':');
                    const keyBC = [nodeIds[j], nodeIds[k]].sort().join(':');

                    if (connectedPairs.has(keyAC) && connectedPairs.has(keyBC)) {
                        triangles.push([nodeIds[i], nodeIds[j], nodeIds[k]]);
                    }
                }
            }
        }

        // Apply area spring to each triangle
        for (const [idA, idB, idC] of triangles) {
            const a = this.nodes.get(idA);
            const b = this.nodes.get(idB);
            const c = this.nodes.get(idC);
            if (!a || !b || !c) continue;

            // Current area (signed area formula, take absolute)
            const currentArea = 0.5 * Math.abs(
                (b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y)
            );

            if (currentArea >= restArea) continue;  // Big enough

            // How much deficit?
            const deficit = restArea - currentArea;
            const correction = deficit * areaStrength;

            // Push each vertex outward along altitude direction
            // (from opposite edge midpoint toward vertex)
            const vertices = [
                { node: a, opp1: b, opp2: c },
                { node: b, opp1: a, opp2: c },
                { node: c, opp1: a, opp2: b }
            ];

            for (const { node, opp1, opp2 } of vertices) {
                if (node.isFixed) continue;

                // Midpoint of opposite edge
                const midX = (opp1.x + opp2.x) / 2;
                const midY = (opp1.y + opp2.y) / 2;

                // Direction from midpoint to vertex (altitude direction)
                const dx = node.x - midX;
                const dy = node.y - midY;
                const d = Math.sqrt(dx * dx + dy * dy);
                if (d < 0.1) continue;

                const nx = dx / d;
                const ny = dy / d;

                // Request correction via accumulator
                // DEGREE-1 EXCLUSION: dangling nodes don't receive positional correction
                // EARLY-PHASE HUB PRIVILEGE + ESCAPE WINDOW
                const nodeAccum = correctionAccum.get(node.id);
                const nodeDeg = nodeDegreeEarly.get(node.id) || 0;
                const nodeEscape = this.escapeWindow.has(node.id);
                const earlyHubSkip = (energy > 0.85 && nodeDeg >= 3) || nodeEscape;
                if (nodeAccum && nodeDeg > 1 && !earlyHubSkip) {
                    nodeAccum.dx += nx * correction;
                    nodeAccum.dy += ny * correction;
                }
            }
        }

        // =====================================================================
        // CONTINUOUS ANGLE RESISTANCE (Prevents cramped edges before violation)
        // 5 zones: Free (≥60°) → Pre-tension (45-60°) → Soft (30-45°) → 
        //          Emergency (20-30°) → Forbidden (<20°)
        // Applies tangential velocity to push edges apart
        // =====================================================================

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

        // No expansion boost - angle resistance is phase-gated instead

        // Build adjacency map: node -> list of neighbors
        const neighbors = new Map<string, string[]>();
        for (const node of nodeList) {
            neighbors.set(node.id, []);
        }
        for (const link of this.links) {
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
                const nb = this.nodes.get(nbId);
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
                const currNb = this.nodes.get(curr.id);
                const nextNb = this.nodes.get(next.id);
                if (!currNb || !nextNb) continue;

                // Force magnitude (no expansion boost - gating handles expansion)
                const force = resistance * angleForceStrength;

                // Apply tangential force (push edges apart along angle bisector)
                // currNb rotates clockwise, nextNb rotates counter-clockwise
                const applyTangentialForce = (nb: typeof currNb, edge: typeof curr, direction: number) => {
                    if (nb.isFixed) return;
                    const nbDeg = nodeDegreeEarly.get(nb.id) || 0;
                    if (nbDeg === 1) return;  // Skip dangling nodes

                    // EARLY-PHASE HUB PRIVILEGE + ESCAPE WINDOW
                    const nbEscape = this.escapeWindow.has(nb.id);
                    if ((energy > 0.85 && nbDeg >= 3) || nbEscape) return;

                    // Tangent direction (perpendicular to radial)
                    const radialX = (nb.x - node.x) / edge.r;
                    const radialY = (nb.y - node.y) / edge.r;
                    const tangentX = -radialY * direction;
                    const tangentY = radialX * direction;

                    // Apply as velocity (not position)
                    nb.vx += tangentX * force;
                    nb.vy += tangentY * force;

                    // Apply local damping in emergency/forbidden zones
                    if (localDamping < 1.0) {
                        nb.vx *= localDamping;
                        nb.vy *= localDamping;
                    }
                };

                applyTangentialForce(currNb, curr, -1);  // Clockwise
                applyTangentialForce(nextNb, next, 1);   // Counter-clockwise
            }
        }

        // =====================================================================
        // DISTANCE FIELD BIAS (Continuous resistance, not discrete correction)
        // When d < minDist, apply outward velocity bias (smooth, continuous)
        // Bias strength ramps with penetration depth
        // Hard positional clamp only as last-resort safety net
        // =====================================================================
        const releaseDist = D_hard + this.config.clampHysteresisMargin;
        const biasStrength = 15.0;  // Outward velocity bias strength

        for (let i = 0; i < nodeList.length; i++) {
            const a = nodeList[i];
            for (let j = i + 1; j < nodeList.length; j++) {
                const b = nodeList[j];

                const dx = b.x - a.x;
                const dy = b.y - a.y;
                const d = Math.sqrt(dx * dx + dy * dy);

                if (d < 0.1) continue;  // Singularity guard

                const pairKey = a.id < b.id ? `${a.id}:${b.id}` : `${b.id}:${a.id}`;
                const wasClamped = this.clampedPairs.has(pairKey);

                const nx = dx / d;
                const ny = dy / d;

                // Contact slop zone: gradual velocity projection before hitting hard wall
                const slop = this.config.contactSlop;
                const slopStart = D_hard + slop;  // Start of gradual resistance zone

                if (d >= D_hard && d < slopStart) {
                    // SLOP ZONE: velocity-only projection, no positional correction
                    // Strength ramps from 0 (at slopStart) to 1 (at minDist)
                    const slopT = (slopStart - d) / slop;  // 0→1 as d approaches minDist
                    const slopRamp = slopT * slopT * (3 - 2 * slopT);  // smoothstep

                    // Project inward velocity with ramped strength
                    if (!a.isFixed) {
                        const aInward = a.vx * nx + a.vy * ny;
                        if (aInward > 0) {
                            a.vx -= aInward * nx * slopRamp;
                            a.vy -= aInward * ny * slopRamp;
                        }
                    }
                    if (!b.isFixed) {
                        const bInward = b.vx * nx + b.vy * ny;
                        if (bInward < 0) {
                            b.vx -= bInward * nx * slopRamp;
                            b.vy -= bInward * ny * slopRamp;
                        }
                    }
                }
                else if (d < D_hard) {
                    // CONTINUOUS BIAS: apply outward velocity, ramped by penetration
                    const penetration = D_hard - d;
                    const t = Math.min(penetration / D_hard, 1);  // 0→1
                    const ramp = t * t * (3 - 2 * t);  // Smoothstep
                    const bias = ramp * biasStrength;

                    if (!a.isFixed && !b.isFixed) {
                        a.vx -= nx * bias;
                        a.vy -= ny * bias;
                        b.vx += nx * bias;
                        b.vy += ny * bias;
                    } else if (!a.isFixed) {
                        a.vx -= nx * bias * 2;
                        a.vy -= ny * bias * 2;
                    } else if (!b.isFixed) {
                        b.vx += nx * bias * 2;
                        b.vy += ny * bias * 2;
                    }

                    // VELOCITY PROJECTION: remove inward component to prevent "invisible wall" bounce
                    // n points from a toward b, so:
                    // - for a, inward = moving toward b = positive dot with n
                    // - for b, inward = moving toward a = negative dot with n
                    if (!a.isFixed) {
                        const aInward = a.vx * nx + a.vy * ny;  // positive = moving toward b
                        if (aInward > 0) {
                            a.vx -= aInward * nx;
                            a.vy -= aInward * ny;
                        }
                    }
                    if (!b.isFixed) {
                        const bInward = b.vx * nx + b.vy * ny;  // negative = moving toward a
                        if (bInward < 0) {
                            b.vx -= bInward * nx;
                            b.vy -= bInward * ny;
                        }
                    }

                    // SAFETY NET: hard clamp only for deep violations
                    // DEGREE-1 EXCLUSION: dangling nodes don't receive positional correction
                    if (penetration > 5) {
                        const emergencyCorrection = Math.min(penetration - 5, 0.3);
                        const aAccum = correctionAccum.get(a.id);
                        const bAccum = correctionAccum.get(b.id);
                        const aDeg = nodeDegreeEarly.get(a.id) || 0;
                        const bDeg = nodeDegreeEarly.get(b.id) || 0;

                        // EARLY-PHASE HUB PRIVILEGE: high-degree nodes skip clamp during early expansion
                        const aHubSkip = energy > 0.85 && aDeg >= 3;
                        const bHubSkip = energy > 0.85 && bDeg >= 3;

                        if (!a.isFixed && !b.isFixed) {
                            if (aAccum && aDeg > 1 && !aHubSkip) {
                                aAccum.dx -= nx * emergencyCorrection * 0.5;
                                aAccum.dy -= ny * emergencyCorrection * 0.5;
                            }
                            if (bAccum && bDeg > 1 && !bHubSkip) {
                                bAccum.dx += nx * emergencyCorrection * 0.5;
                                bAccum.dy += ny * emergencyCorrection * 0.5;
                            }
                        } else if (!a.isFixed && aAccum && aDeg > 1 && !aHubSkip) {
                            aAccum.dx -= nx * emergencyCorrection;
                            aAccum.dy -= ny * emergencyCorrection;
                        } else if (!b.isFixed && bAccum && bDeg > 1 && !bHubSkip) {
                            bAccum.dx += nx * emergencyCorrection;
                            bAccum.dy += ny * emergencyCorrection;
                        }
                    }

                    this.clampedPairs.add(pairKey);
                }
                else if (wasClamped && d < releaseDist) {
                    // HOLD: inside hysteresis buffer, do nothing
                }
                else {
                    // RELEASE: outside buffer, clear lock
                    this.clampedPairs.delete(pairKey);
                }
            }
        }

        // =====================================================================
        // FINAL PASS: APPLY CLAMPED CORRECTIONS WITH DIFFUSION
        // Degree-weighted resistance + neighbor diffusion to prevent pressure concentration
        // =====================================================================
        const nodeBudget = this.config.maxNodeCorrectionPerFrame;

        // Compute node degree and neighbor map
        const nodeDegree = new Map<string, number>();
        const nodeNeighbors = new Map<string, string[]>();
        for (const node of nodeList) {
            nodeDegree.set(node.id, 0);
            nodeNeighbors.set(node.id, []);
        }
        for (const link of this.links) {
            nodeDegree.set(link.source, (nodeDegree.get(link.source) || 0) + 1);
            nodeDegree.set(link.target, (nodeDegree.get(link.target) || 0) + 1);
            nodeNeighbors.get(link.source)?.push(link.target);
            nodeNeighbors.get(link.target)?.push(link.source);
        }

        // Track which nodes receive diffused correction this frame
        const diffusedCorrection = new Map<string, { dx: number; dy: number }>();
        for (const node of nodeList) {
            diffusedCorrection.set(node.id, { dx: 0, dy: 0 });
        }

        for (const node of nodeList) {
            if (node.isFixed) continue;

            // DEGREE-1 EXCLUSION: dangling nodes don't receive positional correction
            const deg = nodeDegree.get(node.id) || 0;
            if (deg === 1) continue;

            const accum = correctionAccum.get(node.id);
            if (!accum) continue;

            // Total correction magnitude
            let totalMag = Math.sqrt(accum.dx * accum.dx + accum.dy * accum.dy);

            if (totalMag < 0.001) continue;  // Skip tiny corrections

            // Degree-weighted resistance (hubs act heavier)
            const degree = nodeDegree.get(node.id) || 1;
            const degreeScale = 1 / Math.sqrt(degree);

            // Normalize new direction
            const newDir = { x: accum.dx / totalMag, y: accum.dy / totalMag };

            // Check directional continuity
            let attenuationFactor = 1.0;
            if (node.lastCorrectionDir) {
                const dot = newDir.x * node.lastCorrectionDir.x + newDir.y * node.lastCorrectionDir.y;
                if (dot < 0) {
                    attenuationFactor = 0.2;
                }
            }

            // PHASE-AWARE HUB INERTIA: high-degree nodes absorb corrections gradually
            // Prevents synchronization spike during expansion→settling transition
            // hubFactor = 0 for leaves, 1 for high-degree hubs
            const hubFactor = Math.min(Math.max((degree - 2) / 3, 0), 1);
            const inertiaStrength = 0.6;  // How much to slow hub correction acceptance
            // Active during transition (energy 0.4-0.7) and settling
            const hubInertiaScale = energy < 0.8 ? (1 - hubFactor * inertiaStrength) : 1.0;

            // Clamp to budget and apply attenuation + degree scaling + hub inertia
            const scale = Math.min(1, nodeBudget / totalMag) * attenuationFactor * degreeScale * hubInertiaScale;
            const corrDx = accum.dx * scale;
            const corrDy = accum.dy * scale;

            // DIFFUSION: split correction between self and neighbors
            if (degree > 1) {
                const selfShare = 0.4;
                const neighborShare = 0.6 / degree;

                // Self gets 40%
                node.x += corrDx * selfShare;
                node.y += corrDy * selfShare;

                // Neighbors get 60% split
                const neighbors = nodeNeighbors.get(node.id) || [];
                for (const nbId of neighbors) {
                    const nbDiff = diffusedCorrection.get(nbId);
                    if (nbDiff) {
                        // Neighbors receive opposite direction (they move to absorb)
                        nbDiff.dx -= corrDx * neighborShare;
                        nbDiff.dy -= corrDy * neighborShare;
                    }
                }
            } else {
                // Single connection - apply full correction
                node.x += corrDx;
                node.y += corrDy;
            }

            // Update lastCorrectionDir via slow lerp (heavy inertia)
            if (!node.lastCorrectionDir) {
                node.lastCorrectionDir = { x: newDir.x, y: newDir.y };
            } else {
                const lerpFactor = 0.3;
                const lx = node.lastCorrectionDir.x * (1 - lerpFactor) + newDir.x * lerpFactor;
                const ly = node.lastCorrectionDir.y * (1 - lerpFactor) + newDir.y * lerpFactor;
                const lmag = Math.sqrt(lx * lx + ly * ly);
                if (lmag > 0.001) {
                    node.lastCorrectionDir.x = lx / lmag;
                    node.lastCorrectionDir.y = ly / lmag;
                }
            }
        }

        // Apply diffused corrections to neighbors (clamped to budget)
        for (const node of nodeList) {
            if (node.isFixed) continue;

            const diff = diffusedCorrection.get(node.id);
            if (!diff) continue;

            const diffMag = Math.sqrt(diff.dx * diff.dx + diff.dy * diff.dy);
            if (diffMag < 0.001) continue;

            // Clamp diffused correction to budget
            const diffScale = Math.min(1, nodeBudget / diffMag);
            node.x += diff.dx * diffScale;
            node.y += diff.dy * diffScale;
        }

        // DEBUG: Log energy info every 10 frames (~166ms at 60fps)
        if (Math.floor(this.lifecycle * 60) % 10 === 0) {
            console.log(`[Physics] Energy: ${(energy * 100).toFixed(1)}% | Damping: ${effectiveDamping.toFixed(2)} | MaxV: ${maxVelocityEffective.toFixed(0)}`);
        }
    }
}
