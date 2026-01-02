import { PhysicsNode, PhysicsLink, ForceConfig } from './types';
import { DEFAULT_PHYSICS_CONFIG } from './config';
import { runPreRollPhase } from './engine/preRollPhase';
import { fireInitialImpulse } from './engine/impulse';
import { advanceEscapeWindow } from './engine/escapeWindow';
import { computeEnergyEnvelope } from './engine/energy';
import { applyForcePass } from './engine/forcePass';
import { integrateNodes } from './engine/integration';
import { computeNodeDegrees } from './engine/degrees';
import {
    applyEdgeRelaxation,
    applySpacingConstraints,
    applySafetyClamp,
    applyTriangleAreaConstraints,
    initializeCorrectionAccum,
} from './engine/constraints';
import { applyCorrectionsWithDiffusion } from './engine/corrections';
import { applyAngleResistanceVelocity, applyDistanceBiasVelocity, applyDragVelocity, applyExpansionResistance, applyPreRollVelocity } from './engine/velocityPass';
import { logEnergyDebug } from './engine/debug';
import { createDebugStats, type DebugStats } from './engine/stats';

export class PhysicsEngine {
    public nodes: Map<string, PhysicsNode> = new Map();
    public links: PhysicsLink[] = [];
    public config: ForceConfig;

    // World Bounds for Containment
    public worldWidth: number = 2000;
    public worldHeight: number = 2000;

    // Interaction State
    public draggedNodeId: string | null = null;
    public dragTarget: { x: number, y: number } | null = null;

    // Lifecycle State (Startup Animation)
    public lifecycle: number = 0;
    public hasFiredImpulse: boolean = false;

    // Rotating Reference Frame (The Medium - initialized at impulse, decays with energy)
    public globalAngle: number = 0;       // Accumulated rotation (radians)
    public globalAngularVel: number = 0;  // Angular velocity (rad/s, + = CCW)

    // Hysteresis state for hard clamp (tracks pairs currently in clamped state)
    public clampedPairs = new Set<string>();

    // Pre-roll phase: soft separation before expansion (frames remaining)
    public preRollFrames: number = 5;  // ~80ms at 60fps

    // Escape window: frames remaining for trapped nodes to skip constraints
    public escapeWindow = new Map<string, number>();

    // Directional persistence: carrier direction for curved hub escape
    public carrierDir = new Map<string, { x: number, y: number }>();
    public carrierTimer = new Map<string, number>();  // Frames remaining for persistence

    // Frame counter for staggered integration
    public frameIndex: number = 0;

    private lastDebugStats: DebugStats | null = null;

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
     * Get the most recent debug stats snapshot (if enabled in the engine loop).
     */
    getDebugStats(): DebugStats | null {
        return this.lastDebugStats;
    }

    /**
     * Main Physics Tick.
     * @param dt Delta time in seconds (e.g. 0.016 for 60fps)
     */
    tick(dt: number) {
        const nodeList = Array.from(this.nodes.values());
        const debugStats = createDebugStats();

        // Lifecycle Management
        this.lifecycle += dt;
        this.frameIndex++;

        // =====================================================================
        // SOFT PRE-ROLL PHASE (Gentle separation before expansion)
        // Springs at 10%, spacing on, angle off, velocity-only corrections
        // Runs for ~5 frames before expansion starts
        // =====================================================================
        const preRollActive = this.preRollFrames > 0 && !this.hasFiredImpulse;
        if (preRollActive) {
            runPreRollPhase(this, nodeList, debugStats);
        }

        // 0. FIRE IMPULSE (One Shot)
        if (!preRollActive && this.lifecycle < 0.1 && !this.hasFiredImpulse) {
            fireInitialImpulse(this);
        }

        advanceEscapeWindow(this);

        // =====================================================================
        // EXPONENTIAL COOLING: Energy decays asymptotically, never stops
        // =====================================================================
        const { energy, forceScale, effectiveDamping, maxVelocityEffective } = computeEnergyEnvelope(this.lifecycle);

        // 2. Apply Core Forces (scaled by energy)
        applyForcePass(this, nodeList, forceScale, dt, debugStats, preRollActive, energy);
        applyDragVelocity(this, nodeList, dt, debugStats);
        applyPreRollVelocity(this, nodeList, preRollActive, debugStats);

        // 4. Integrate (always runs, never stops)
        integrateNodes(this, nodeList, dt, energy, effectiveDamping, maxVelocityEffective, debugStats, preRollActive);

        // =====================================================================
        // COMPUTE NODE DEGREES (needed early for degree-1 exclusion)
        // Degree-1 nodes (dangling limbs) are excluded from positional corrections
        // =====================================================================
        const nodeDegreeEarly = computeNodeDegrees(this, nodeList);

        applyExpansionResistance(this, nodeList, nodeDegreeEarly, energy, debugStats);

        // =====================================================================
        // PER-NODE CORRECTION BUDGET SYSTEM
        // All constraints request position corrections via accumulator
        // Total correction magnitude is clamped to prevent multi-constraint pileup
        // =====================================================================
        const correctionAccum = initializeCorrectionAccum(nodeList);

        if (!preRollActive) {
            applyEdgeRelaxation(this, correctionAccum, nodeDegreeEarly, debugStats);
            applySpacingConstraints(this, nodeList, correctionAccum, nodeDegreeEarly, energy, debugStats);
            applyTriangleAreaConstraints(this, nodeList, correctionAccum, nodeDegreeEarly, energy, debugStats);
            applyAngleResistanceVelocity(this, nodeList, nodeDegreeEarly, energy, debugStats);
            applyDistanceBiasVelocity(this, nodeList, debugStats);
            applySafetyClamp(this, nodeList, correctionAccum, nodeDegreeEarly, energy, debugStats);
            applyCorrectionsWithDiffusion(this, nodeList, correctionAccum, energy, debugStats);
        }

        logEnergyDebug(this.lifecycle, energy, effectiveDamping, maxVelocityEffective);
        this.lastDebugStats = debugStats;
    }
}
