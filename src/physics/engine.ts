import { PhysicsNode, PhysicsLink, ForceConfig } from './types';
import { DEFAULT_PHYSICS_CONFIG } from './config';
import { applyRepulsion, applySprings, applyCenterGravity, applyBoundaryForce, applyCollision, applySpringConstraint } from './forces';

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
     * Main Physics Tick.
     * @param dt Delta time in seconds (e.g. 0.016 for 60fps)
     */
    tick(dt: number) {
        const nodeList = Array.from(this.nodes.values());
        const { maxVelocity } = this.config;

        // Lifecycle Management
        this.lifecycle += dt;

        // NEW LIFECYCLE: HYBRID PBD / DYNAMICS
        // 0s - 0.25s: SNAP (Geometric Constraint Projection, Zero Inertia)
        // 0.25s+:     LOCK (Standard Dynamics, High Damping)
        const isSnap = this.lifecycle < 0.25;

        // 1. Clear forces
        for (const node of nodeList) {
            node.fx = 0;
            node.fy = 0;
        }

        // 2. Apply Core Forces
        // Forces are applied in BOTH phases for Collision/Repulsion/Gravity/Boundary
        // but handled differently in integration.
        applyRepulsion(nodeList, this.config);
        applyCollision(nodeList, this.config, 1.0);
        applyCenterGravity(nodeList, this.config);
        applyBoundaryForce(nodeList, this.config, this.worldWidth, this.worldHeight);

        // 3. Springs (Hybrid)
        if (isSnap) {
            // PBD Mode: Directly project positions to satisfy links
            // "Concept: move nodes directly toward their spring-rest targets"
            // Strength 0.6 = 60% correction per frame
            applySpringConstraint(this.nodes, this.links, this.config, 0.6);
        } else {
            // Dynamics Mode: Standard Spring Forces
            applySprings(this.nodes, this.links, this.config, 1.0);
        }

        // 4. Apply Mouse Drag Force
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

        // 5. Integrate
        for (const node of nodeList) {
            if (node.isFixed) continue;

            const ax = node.fx / node.mass;
            const ay = node.fy / node.mass;

            // Update Velocity
            node.vx += ax * dt;
            node.vy += ay * dt;

            // Phase-Dependent Integration
            if (isSnap) {
                // SNAP PHASE:
                // Move based on velocity (from collision forces), but KILL momentum.
                // This allows collision to push things apart, but prevents oscillation.
                // Effectively: "Overdamped" / "Quasi-static"
                node.x += node.vx * dt;
                node.y += node.vy * dt;

                // Zero out inertia for next frame
                node.vx = 0;
                node.vy = 0;
            } else {
                // LOCK PHASE:
                // Standard Velocity Verlet with High Damping
                const lockDamping = 0.95;
                node.vx *= (1 - lockDamping * dt * 5.0);
                node.vy *= (1 - lockDamping * dt * 5.0);

                // Clamp
                const vSq = node.vx * node.vx + node.vy * node.vy;
                if (vSq > maxVelocity * maxVelocity) {
                    const v = Math.sqrt(vSq);
                    node.vx = (node.vx / v) * maxVelocity;
                    node.vy = (node.vy / v) * maxVelocity;
                }

                node.x += node.vx * dt;
                node.y += node.vy * dt;
            }

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
