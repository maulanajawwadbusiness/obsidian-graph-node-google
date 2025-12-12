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

    constructor(config: Partial<ForceConfig> = {}) {
        this.config = { ...DEFAULT_PHYSICS_CONFIG, ...config };
    }

    /**
     * Add a node to the simulation.
     */
    addNode(node: PhysicsNode) {
        this.nodes.set(node.id, node);
    }

    /**
     * Add a link between two nodes.
     */
    addLink(link: PhysicsLink) {
        this.links.push(link);
    }

    /**
     * Clear all entities.
     */
    clear() {
        this.nodes.clear();
        this.links = [];
    }

    /**
     * Update configuration at runtime.
     */
    updateConfig(newConfig: Partial<ForceConfig>) {
        this.config = { ...this.config, ...newConfig };
    }

    /**
     * Update World Bounds (from Canvas resize).
     */
    updateBounds(width: number, height: number) {
        this.worldWidth = width;
        this.worldHeight = height;
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

            // Optional: Clear velocity on grab for better control?
            // Or keep it for "catch and throw"? 
            // Let's keep momentum -> funner.

            // We do NOT set isFixed = true, because we want physics (repulsion etc)
            // to still affect it, just overpowered by the mouse force.
        }
    }

    /**
     * Update drag position.
     */
    moveDrag(position: { x: number, y: number }) {
        if (this.draggedNodeId && this.dragTarget) {
            this.dragTarget = { ...position };
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
        const { damping, maxVelocity } = this.config;

        // 1. Clear forces
        for (const node of nodeList) {
            node.fx = 0;
            node.fy = 0;
        }

        // 2. Apply Core Forces
        applyRepulsion(nodeList, this.config);
        applySprings(this.nodes, this.links, this.config);
        applyCenterGravity(nodeList, this.config);
        applyBoundaryForce(nodeList, this.config, this.worldWidth, this.worldHeight);

        // 3. Apply Mouse Drag Force (The "Rubbery Grip")
        if (this.draggedNodeId && this.dragTarget) {
            const node = this.nodes.get(this.draggedNodeId);
            if (node) {
                // Strong spring to cursor
                const dx = this.dragTarget.x - node.x;
                const dy = this.dragTarget.y - node.y;

                const dragStrength = 200.0; // Very strong (law, not suggestion)

                node.fx += dx * dragStrength;
                node.fy += dy * dragStrength;

                // Alternative: Crude "P" controller approach
                // helps reduce wobble when holding still
                node.vx += dx * 2.0 * dt;
                node.vy += dy * 2.0 * dt;
            }
        }

        // 4. Integrate (Velocity Verlet-ish / Euler)
        for (const node of nodeList) {
            if (node.isFixed) continue; // Hard fixed nodes don't move

            // F = ma -> a = F/m
            const ax = node.fx / node.mass;
            const ay = node.fy / node.mass;

            // Update Velocity
            node.vx += ax * dt;
            node.vy += ay * dt;

            // Apply Damping (Air Resistance)
            // Velocity decays by factor (1 - damping)
            // But damping 0.8 is "friction factor", so we multiply by (1 - damping * dt)?
            // Simple exp decay is better for stability: v *= pow(damping, dt)
            // But standard linear damp is: v *= (1 - damping)
            // User requested "0.85" type numbers.
            // Let's us simple multiplication for now since dt is roughly constant.
            node.vx *= (1 - damping * dt * 5.0); // * 5.0 to make the config range 0-1 feel good
            node.vy *= (1 - damping * dt * 5.0);

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
        }
    }
}
