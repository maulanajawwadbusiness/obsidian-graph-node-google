import { PhysicsNode, PhysicsLink, ForceConfig } from './types';
import { DEFAULT_PHYSICS_CONFIG } from './config';
import { applyRepulsion, applySprings, applyCenterGravity, applyBoundaryForce } from './forces';

export class PhysicsEngine {
    public nodes: Map<string, PhysicsNode> = new Map();
    public links: PhysicsLink[] = [];
    public config: ForceConfig;

    // World Bounds for Containment
    // Default to something large until Playground updates it
    private worldWidth: number = 2000;
    private worldHeight: number = 2000;

    // Interaction State
    private draggedNodeId: string | null = null;
    private dragTarget: { x: number, y: number } | null = null;

    // Lifecycle State (Startup Animation)
    public lifecycle: number = 0;

    constructor(config: Partial<ForceConfig> = {}) {
        this.config = { ...DEFAULT_PHYSICS_CONFIG, ...config };
    }

    /**
     * Add a node to the simulation.
     */
    addNode(node: PhysicsNode) {
        this.nodes.set(node.id, node);
        // New node is hot, and wakes neighbors? No neighbors yet.
        this.wakeNode(node.id);
    }

    /**
     * Add a link between two nodes.
     */
    addLink(link: PhysicsLink) {
        this.links.push(link);
        // Wakes the connected nodes
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
        this.wakeAll();
    }

    /**
     * Wake up a specific node.
     */
    wakeNode(nodeId: string) {
        const node = this.nodes.get(nodeId);
        if (node) {
            node.warmth = 1.0;
            // Also reset lifecycle? No, dragging shouldn't restart the WHOLE intro.
        }
    }

    /**
     * Wake up a node and its neighbors.
     */
    wakeNeighbors(nodeId: string) {
        // Find all links connected to this node
        // (Inefficient O(L) scan, but fine for small N)
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
     * We don't hard-fix it; we will apply a strong force towards the mouse
     * to give it that "heavy/rubbery" feel.
     */
    grabNode(nodeId: string, position: { x: number, y: number }) {
        if (this.nodes.has(nodeId)) {
            this.draggedNodeId = nodeId;
            this.dragTarget = { ...position };

            // LOCAL WAKE ONLY
            this.wakeNode(nodeId);
            this.wakeNeighbors(nodeId);
        }
    }

    /**
     * Update drag position.
     */
    moveDrag(position: { x: number, y: number }) {
        if (this.draggedNodeId && this.dragTarget) {
            this.dragTarget = { ...position };
            // Keep waking it as we drag
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
        // No global wake. Local nodes are already warm from drag.
    }

    /**
     * Main Physics Tick.
     * @param dt Delta time in seconds (e.g. 0.016 for 60fps)
     */
    tick(dt: number) {
        const nodeList = Array.from(this.nodes.values());
        const { damping, maxVelocity, formingTime, restForceScale, velocitySleepThreshold, springStiffness } = this.config;

        // Lifecycle Management
        this.lifecycle += dt;

        // Phase 0: Compression (0 - 0.15s)
        const isCompression = this.lifecycle < 0.15;
        // Phase 1: Release (0.15s - 0.5s)
        const isRelease = this.lifecycle >= 0.15 && this.lifecycle < 0.50;
        // Phase 2: Normal (0.5s+)
        const isNormal = this.lifecycle >= 0.50;

        // 1. Update Warmth (Per Node)
        for (const node of nodeList) {
            // Init warmth
            if (node.warmth === undefined) node.warmth = 1.0;

            // Decay Warmth ONLY in Normal Phase
            // During intro, keeping them hot makes sure they don't freeze mid-expansion.
            if (isNormal) {
                if (formingTime > 0) {
                    node.warmth -= dt / formingTime;
                    if (node.warmth < 0) node.warmth = 0;
                } else {
                    node.warmth = 1.0;
                }
            } else {
                node.warmth = 1.0;
            }
        }

        // 2. Clear forces
        for (const node of nodeList) {
            node.fx = 0;
            node.fy = 0;
        }

        // 3. Apply Core Forces ALWAYS (Structure First)
        // Compression phase is removed. Springs active from t=0.
        // We only check if we are in "Initial Unfold" vs "Steady state" for Damping purposes maybe?
        // But forces are ON.

        applyRepulsion(nodeList, this.config);
        applySprings(this.nodes, this.links, this.config);
        applyCenterGravity(nodeList, this.config);
        applyBoundaryForce(nodeList, this.config, this.worldWidth, this.worldHeight);

        // 4. Apply Local Phase Scale (Per Node)
        // (Only meaningful in Normal phase where warmth decays, but safe to run always)
        for (const node of nodeList) {
            const t = node.warmth ?? 0;
            // Lerp force scale: 1.0 (Hot) -> restForceScale (Cold)
            const forceScale = restForceScale + (1.0 - restForceScale) * t;

            node.fx *= forceScale;
            node.fy *= forceScale;
        }

        // 5. Apply Mouse Drag Force (The "Rubbery Grip")
        if (this.draggedNodeId && this.dragTarget) {
            const node = this.nodes.get(this.draggedNodeId);
            if (node) {
                // Strong spring to cursor
                const dx = this.dragTarget.x - node.x;
                const dy = this.dragTarget.y - node.y;
                const dragStrength = 200.0;

                node.fx += dx * dragStrength;
                node.fy += dy * dragStrength;
                node.vx += dx * 2.0 * dt;
                node.vy += dy * 2.0 * dt;
            }
        }

        // 6. Integrate (Velocity Verlet-ish / Euler)
        for (const node of nodeList) {
            if (node.isFixed) continue; // Hard fixed nodes don't move

            // F = ma -> a = F/m
            const ax = node.fx / node.mass;
            const ay = node.fy / node.mass;

            // Update Velocity
            node.vx += ax * dt;
            node.vy += ay * dt;

            // Apply Damping (Air Resistance)
            let currentDamping = damping;

            // Phase Shift Damping (Always)
            // Startup Release no longer overrides this (Removed 0.6 override)
            const t = node.warmth ?? 0;
            const coldDamping = 0.98;
            currentDamping = coldDamping + (damping - coldDamping) * t;

            // Simple linear decay
            node.vx *= (1 - currentDamping * dt * 5.0);
            node.vy *= (1 - currentDamping * dt * 5.0);

            // Clamp Velocity
            const vSq = node.vx * node.vx + node.vy * node.vy;
            if (vSq > maxVelocity * maxVelocity) {
                const v = Math.sqrt(vSq);
                node.vx = (node.vx / v) * maxVelocity;
                node.vy = (node.vy / v) * maxVelocity;
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
    }
}
