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
            const sourceAccum = correctionAccum.get(source.id);
            const targetAccum = correctionAccum.get(target.id);

            if (!source.isFixed && !target.isFixed) {
                if (sourceAccum) {
                    sourceAccum.dx += nx * correction * 0.5;
                    sourceAccum.dy += ny * correction * 0.5;
                }
                if (targetAccum) {
                    targetAccum.dx -= nx * correction * 0.5;
                    targetAccum.dy -= ny * correction * 0.5;
                }
            } else if (!source.isFixed && sourceAccum) {
                sourceAccum.dx += nx * correction;
                sourceAccum.dy += ny * correction;
            } else if (!target.isFixed && targetAccum) {
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
                    const aAccum = correctionAccum.get(a.id);
                    const bAccum = correctionAccum.get(b.id);

                    if (!a.isFixed && !b.isFixed) {
                        if (aAccum) {
                            aAccum.dx -= nx * corrApplied * 0.5;
                            aAccum.dy -= ny * corrApplied * 0.5;
                        }
                        if (bAccum) {
                            bAccum.dx += nx * corrApplied * 0.5;
                            bAccum.dy += ny * corrApplied * 0.5;
                        }
                    } else if (!a.isFixed && aAccum) {
                        aAccum.dx -= nx * corrApplied;
                        aAccum.dy -= ny * corrApplied;
                    } else if (!b.isFixed && bAccum) {
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
                const nodeAccum = correctionAccum.get(node.id);
                if (nodeAccum) {
                    nodeAccum.dx += nx * correction;
                    nodeAccum.dy += ny * correction;
                }
            }
        }

        // =====================================================================
        // MINIMUM EDGE ANGLE (Geometric constraint, not force)
        // No two edges at a node should be closer than minEdgeAngle.
        // Rotate cramped neighbors apart around the node.
        // =====================================================================
        const minAngle = this.config.minEdgeAngle;

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
            const edges: { id: string; angle: number }[] = [];
            for (const nbId of nbIds) {
                const nb = this.nodes.get(nbId);
                if (!nb) continue;
                const dx = nb.x - node.x;
                const dy = nb.y - node.y;
                edges.push({ id: nbId, angle: Math.atan2(dy, dx) });
            }

            // Sort by angle
            edges.sort((a, b) => a.angle - b.angle);

            // Check adjacent pairs (including wrap-around)
            for (let i = 0; i < edges.length; i++) {
                const curr = edges[i];
                const next = edges[(i + 1) % edges.length];

                // Angular difference (handle wrap-around)
                let delta = next.angle - curr.angle;
                if (delta < 0) delta += 2 * Math.PI;

                if (delta >= minAngle) continue;  // Wide enough

                // Deficit to correct
                const deficit = minAngle - delta;

                // Rotate neighbors apart around the node
                const currNb = this.nodes.get(curr.id);
                const nextNb = this.nodes.get(next.id);
                if (!currNb || !nextNb) continue;

                // Compute rotation correction and add to accumulator
                const rotateNode = (nb: typeof currNb, angleOffset: number) => {
                    if (nb.isFixed) return;
                    const dx = nb.x - node.x;
                    const dy = nb.y - node.y;
                    const r = Math.sqrt(dx * dx + dy * dy);
                    const currentAngle = Math.atan2(dy, dx);
                    const newAngle = currentAngle + angleOffset;
                    const newX = node.x + r * Math.cos(newAngle);
                    const newY = node.y + r * Math.sin(newAngle);

                    // Request correction via accumulator
                    const nbAccum = correctionAccum.get(nb.id);
                    if (nbAccum) {
                        nbAccum.dx += newX - nb.x;
                        nbAccum.dy += newY - nb.y;
                    }
                };

                rotateNode(currNb, -deficit * 0.5);
                rotateNode(nextNb, deficit * 0.5);
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
                    if (penetration > 5) {
                        const emergencyCorrection = Math.min(penetration - 5, 0.3);
                        const aAccum = correctionAccum.get(a.id);
                        const bAccum = correctionAccum.get(b.id);

                        if (!a.isFixed && !b.isFixed) {
                            if (aAccum) {
                                aAccum.dx -= nx * emergencyCorrection * 0.5;
                                aAccum.dy -= ny * emergencyCorrection * 0.5;
                            }
                            if (bAccum) {
                                bAccum.dx += nx * emergencyCorrection * 0.5;
                                bAccum.dy += ny * emergencyCorrection * 0.5;
                            }
                        } else if (!a.isFixed && aAccum) {
                            aAccum.dx -= nx * emergencyCorrection;
                            aAccum.dy -= ny * emergencyCorrection;
                        } else if (!b.isFixed && bAccum) {
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
        // FINAL PASS: APPLY CLAMPED CORRECTIONS (One decision per node per frame)
        // Degree-weighted resistance: hubs act heavier
        // Directional inertia prevents visible direction flips
        // =====================================================================
        const nodeBudget = this.config.maxNodeCorrectionPerFrame;

        // Compute node degree (number of connected edges)
        const nodeDegree = new Map<string, number>();
        for (const node of nodeList) {
            nodeDegree.set(node.id, 0);
        }
        for (const link of this.links) {
            nodeDegree.set(link.source, (nodeDegree.get(link.source) || 0) + 1);
            nodeDegree.set(link.target, (nodeDegree.get(link.target) || 0) + 1);
        }

        for (const node of nodeList) {
            if (node.isFixed) continue;

            const accum = correctionAccum.get(node.id);
            if (!accum) continue;

            // Total correction magnitude
            let totalMag = Math.sqrt(accum.dx * accum.dx + accum.dy * accum.dy);

            if (totalMag < 0.001) continue;  // Skip tiny corrections

            // Degree-weighted resistance (hubs act heavier)
            const degree = nodeDegree.get(node.id) || 1;
            const degreeScale = 1 / Math.sqrt(degree);  // sqrt for moderate scaling
            totalMag *= degreeScale;

            // Normalize new direction
            const newDir = { x: accum.dx / totalMag, y: accum.dy / totalMag };

            // Check directional continuity
            let attenuationFactor = 1.0;
            if (node.lastCorrectionDir) {
                const dot = newDir.x * node.lastCorrectionDir.x + newDir.y * node.lastCorrectionDir.y;
                if (dot < 0) {
                    // Opposite direction - strongly attenuate
                    attenuationFactor = 0.2;
                }
            }

            // Clamp to budget and apply attenuation + degree scaling
            const scale = Math.min(1, nodeBudget / totalMag) * attenuationFactor * degreeScale;

            // Apply clamped & attenuated correction
            node.x += accum.dx * scale;
            node.y += accum.dy * scale;

            // Update lastCorrectionDir via slow lerp (heavy inertia)
            if (!node.lastCorrectionDir) {
                node.lastCorrectionDir = { x: newDir.x, y: newDir.y };
            } else {
                const lerpFactor = 0.3;  // Slow update
                const lx = node.lastCorrectionDir.x * (1 - lerpFactor) + newDir.x * lerpFactor;
                const ly = node.lastCorrectionDir.y * (1 - lerpFactor) + newDir.y * lerpFactor;
                const lmag = Math.sqrt(lx * lx + ly * ly);
                if (lmag > 0.001) {
                    node.lastCorrectionDir.x = lx / lmag;
                    node.lastCorrectionDir.y = ly / lmag;
                }
            }
        }

        // DEBUG: Log energy info every 10 frames (~166ms at 60fps)
        if (Math.floor(this.lifecycle * 60) % 10 === 0) {
            console.log(`[Physics] Energy: ${(energy * 100).toFixed(1)}% | Damping: ${effectiveDamping.toFixed(2)} | MaxV: ${maxVelocityEffective.toFixed(0)}`);
        }
    }
}
