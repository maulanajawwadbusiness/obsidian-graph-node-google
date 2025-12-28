import { PhysicsNode, PhysicsLink, ForceConfig, RestState } from './types';
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
    private formLatched: boolean = false; // Shape memory captured?
    private restState: RestState = 'forming'; // Rest state machine

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
        this.formLatched = false; // Reset shape memory
        this.restState = 'forming'; // Reset rest state
    }

    /**
     * Update configuration at runtime.
     */
    updateConfig(newConfig: Partial<ForceConfig>) {
        this.config = { ...this.config, ...newConfig };
        this.wakeAll();
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

        this.hasFiredImpulse = true;
    }

    // =========================================================================
    // FORM LATCH (Shape Memory)
    // =========================================================================

    /**
     * Capture the current shape as "home" positions.
     * Called once when lifecycle reaches latchTime.
     * Each node remembers its offset from the group centroid.
     */
    private captureFormLatch() {
        if (this.formLatched) return;
        if (this.lifecycle * 1000 < this.config.latchTime) return;

        const nodeList = Array.from(this.nodes.values());
        if (nodeList.length === 0) return;

        // Calculate centroid
        let cx = 0, cy = 0;
        for (const node of nodeList) {
            cx += node.x;
            cy += node.y;
        }
        cx /= nodeList.length;
        cy /= nodeList.length;

        // Store home offsets (position relative to centroid)
        for (const node of nodeList) {
            node.homeOffsetX = node.x - cx;
            node.homeOffsetY = node.y - cy;
        }

        this.formLatched = true;
        console.log(`[FormLatch] Shape captured at T+${Math.round(this.lifecycle * 1000)}ms`);
    }

    // =========================================================================
    // REST STATE HELPERS
    // =========================================================================

    /**
     * Calculate the centroid (center of mass) of all nodes.
     */
    private getCentroid(): { x: number, y: number } {
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
     * Snap all nodes to their home positions (centroid + homeOffset).
     * Called when transitioning from 'settling' → 'rest'.
     */
    private snapToHome() {
        const centroid = this.getCentroid();
        for (const node of this.nodes.values()) {
            if (node.homeOffsetX === undefined) continue;
            if (node.homeOffsetY === undefined) continue;

            node.x = centroid.x + node.homeOffsetX;
            node.y = centroid.y + node.homeOffsetY;
            node.vx = 0;
            node.vy = 0;
        }
    }

    /**
     * Main Physics Tick.
     * @param dt Delta time in seconds (e.g. 0.016 for 60fps)
     */
    tick(dt: number) {
        const nodeList = Array.from(this.nodes.values());
        const { maxVelocity } = this.config;

        // Lifecycle Management
        this.lifecycle += dt;

        // 0. FIRE IMPULSE (One Shot)
        if (this.lifecycle < 0.1 && !this.hasFiredImpulse) {
            this.fireInitialImpulse();
        }

        // 0.5 CAPTURE FORM LATCH (One Shot at 600ms)
        this.captureFormLatch();

        // 0.6 REST STATE TRANSITION (Time-based, NOT velocity-based)
        // At latchTime, DECLARE the shape complete and freeze immediately
        if (this.formLatched && this.restState === 'forming') {
            // Don't snap immediately - let the perceptual fade handle it
            this.restState = 'rest';
            console.log('[RestState] forming → rest (fade started)');
        }

        // 0.7 PERCEPTUAL FADE: Smooth motion fade-out (animation, not physics)
        // Positions lerp toward home over fadeDuration, then freeze
        if (this.restState === 'rest') {
            const fadeDuration = 0.3; // 300ms fade
            const timeSinceLatch = this.lifecycle - (this.config.latchTime / 1000);
            const fadeProgress = Math.min(timeSinceLatch / fadeDuration, 1.0);

            // If drag active, skip fade - cursor wins
            if (this.draggedNodeId) {
                // Allow physics to run for drag
            } else if (fadeProgress < 1.0) {
                // During fade: lerp positions toward home (animation, not integration)
                const centroid = this.getCentroid();
                const easeOut = 1 - Math.pow(1 - fadeProgress, 3); // Cubic ease-out

                for (const node of nodeList) {
                    if (node.homeOffsetX === undefined) continue;
                    if (node.homeOffsetY === undefined) continue;

                    const homeX = centroid.x + node.homeOffsetX;
                    const homeY = centroid.y + node.homeOffsetY;

                    // Lerp toward home with easing
                    node.x = node.x + (homeX - node.x) * easeOut * 0.15;
                    node.y = node.y + (homeY - node.y) * easeOut * 0.15;
                    node.vx = 0;
                    node.vy = 0;
                }
                return; // Skip physics during fade
            } else {
                // Fade complete: snap to exact home and freeze
                this.snapToHome();
                return; // Zero computation
            }
        }

        // NEW LIFECYCLE: IMPULSE SNAP
        // 0s - 0.3s: SNAP (Low Damping, UNLIMITED SPEED)
        // 0.3s+:     LOCK (High Damping, CLAMPED SPEED)
        const isSnap = this.lifecycle < 0.30;

        // Phase-Based Parameters
        const phaseName = isSnap ? 'SNAP' : 'LOCK';
        const effectiveDamping = isSnap ? 0.3 : 0.90;
        const maxVelocityEffective = isSnap ? 1500 : maxVelocity; // Hot: 1500, Cold: 80

        // 1. Clear forces
        for (const node of nodeList) {
            node.fx = 0;
            node.fy = 0;
        }

        // 2. Apply Core Forces
        applyRepulsion(nodeList, this.config);
        applyCollision(nodeList, this.config, 1.0);
        applySprings(this.nodes, this.links, this.config, 1.0);
        applyBoundaryForce(nodeList, this.config, this.worldWidth, this.worldHeight);

        // 3. Apply Mouse Drag Force
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

        // 4. Integrate
        let clampHitCount = 0;
        for (const node of nodeList) {
            if (node.isFixed) continue; // Drag always bypasses

            // REST STATE: Freeze integration
            if (this.restState === 'rest') {
                node.vx = 0;
                node.vy = 0;
                continue; // Skip position update
            }

            // FORMING or SETTLING: Normal integration
            const ax = node.fx / node.mass;
            const ay = node.fy / node.mass;

            // Update Velocity
            node.vx += ax * dt;
            node.vy += ay * dt;

            // Apply Damping
            node.vx *= (1 - effectiveDamping * dt * 5.0);
            node.vy *= (1 - effectiveDamping * dt * 5.0);

            // Clamp Velocity (Phase-Based)
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

            // Sleep Check
            if (this.config.velocitySleepThreshold) {
                const velSq = node.vx * node.vx + node.vy * node.vy;
                const threshSq = this.config.velocitySleepThreshold * this.config.velocitySleepThreshold;
                if (velSq < threshSq) {
                    node.vx = 0;
                    node.vy = 0;
                }
            }
        }

        // DEBUG: Log phase info every 10 frames (~166ms at 60fps)
        if (Math.floor(this.lifecycle * 60) % 10 === 0) {
            console.log(`[Physics] Phase: ${phaseName} | MaxV: ${maxVelocityEffective} | Speed Clamps: ${clampHitCount}/${nodeList.length}`);
        }
    }
}
