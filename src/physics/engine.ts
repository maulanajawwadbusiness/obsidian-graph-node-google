import { PhysicsNode, PhysicsLink, ForceConfig } from './types';
import { applyBoundaryForce } from './forces';
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
import { applyAngleResistanceVelocity, applyDistanceBiasVelocity, applyDragVelocity, applyExpansionResistance, applyPreRollVelocity, applyDenseCoreVelocityDeLocking, applyStaticFrictionBypass, applyAngularVelocityDecoherence, applyLocalPhaseDiffusion, applyEdgeShearStagnationEscape, applyDenseCoreInertiaRelaxation } from './engine/velocityPass';
import { logEnergyDebug } from './engine/debug';
import { createDebugStats, type DebugStats } from './engine/stats';

const getNowMs = () =>
    (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());

const computePairStride = (nodeCount: number, targetChecks: number, maxStride: number) => {
    if (nodeCount < 2) return 1;
    const pairCount = (nodeCount * (nodeCount - 1)) / 2;
    const safeTarget = Math.max(1, targetChecks);
    const stride = Math.ceil(pairCount / safeTarget);
    return Math.max(1, Math.min(maxStride, stride));
};

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
    private spacingGate: number = 0;
    private spacingGateActive: boolean = false;
    private nodeListCache: PhysicsNode[] = [];
    private nodeListDirty: boolean = true;
    private awakeList: PhysicsNode[] = [];
    private sleepingList: PhysicsNode[] = [];
    private correctionAccumCache = new Map<string, { dx: number; dy: number }>();
    private topologyLinkKeys = new Set<string>();
    private nodeLinkCounts = new Map<string, number>();
    private topologyWarnAt: number = 0;
    private perfCounters = {
        nodeListBuilds: 0,
        correctionNewEntries: 0,
        topologySkipped: 0,
        topologyDuplicates: 0,
    };
    private perfMode: 'normal' | 'stressed' | 'emergency' | 'fatal' = 'normal';
    private perfModeLogAt: number = 0;
    private spacingLogAt: number = 0;
    private passLogAt: number = 0;
    private degradeLevel: number = 0;
    private degradeReason: string = 'NONE';
    private degradeSeverity: 'NONE' | 'SOFT' | 'HARD' = 'NONE';
    private degradeBudgetMs: number = 0;
    private degradeLogAt: number = 0;
    private handLogAt: number = 0;
    private dragLagSamples: number[] = [];
    private localBoostFrames: number = 0;
    private perfTiming = {
        lastReportAt: 0,
        frameCount: 0,
        totals: {
            repulsionMs: 0,
            collisionMs: 0,
            springsMs: 0,
            spacingMs: 0,
            pbdMs: 0,
            totalMs: 0,
        },
    };
    private lastDraggedNodeId: string | null = null;

    // Fix #11: Impulse Guard State
    private lastImpulseTime: number = 0;

    // Fix #14: Wake Throttling State
    private lastWakeTime: number = 0;

    constructor(config: Partial<ForceConfig> = {}) {
        this.config = { ...DEFAULT_PHYSICS_CONFIG, ...config };
    }

    /**
     * Add a node to the simulation.
     */
    addNode(node: PhysicsNode) {
        this.nodes.set(node.id, node);
        this.nodeListDirty = true;
        if (!this.nodeLinkCounts.has(node.id)) {
            this.nodeLinkCounts.set(node.id, 0);
        }
        this.wakeNode(node.id);
    }

    /**
     * Add a link between two nodes.
     */
    addLink(link: PhysicsLink) {
        const source = link.source;
        const target = link.target;
        const key = source < target ? `${source}:${target}` : `${target}:${source}`;
        if (this.topologyLinkKeys.has(key)) {
            this.perfCounters.topologyDuplicates += 1;
            return;
        }

        const sourceCount = this.nodeLinkCounts.get(source) || 0;
        const targetCount = this.nodeLinkCounts.get(target) || 0;
        if (sourceCount >= this.config.maxLinksPerNode || targetCount >= this.config.maxLinksPerNode) {
            this.perfCounters.topologySkipped += 1;
            this.warnTopology('maxLinksPerNode', link);
            return;
        }
        if (this.links.length >= this.config.maxTotalLinks) {
            this.perfCounters.topologySkipped += 1;
            this.warnTopology('maxTotalLinks', link);
            return;
        }

        this.links.push(link);
        this.topologyLinkKeys.add(key);
        this.nodeLinkCounts.set(source, sourceCount + 1);
        this.nodeLinkCounts.set(target, targetCount + 1);
        this.wakeNode(link.source);
        this.wakeNode(link.target);
    }

    /**
     * Clear all entities.
     */
    clear() {
        this.nodes.clear();
        this.links = [];
        this.nodeListCache.length = 0;
        this.awakeList.length = 0;
        this.sleepingList.length = 0;
        this.nodeListDirty = true;
        this.correctionAccumCache.clear();
        this.topologyLinkKeys.clear();
        this.nodeLinkCounts.clear();
        this.lifecycle = 0;
        this.hasFiredImpulse = false;
        this.spacingGate = 0;
        this.spacingGateActive = false;
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

    /**
     * Update overload-driven degrade state from the scheduler.
     */
    setDegradeState(
        level: number,
        reason: string,
        severity: 'NONE' | 'SOFT' | 'HARD',
        budgetMs: number
    ) {
        this.degradeLevel = Math.max(0, Math.min(2, Math.floor(level)));
        this.degradeReason = reason;
        this.degradeSeverity = severity;
        this.degradeBudgetMs = budgetMs;
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
        const nodeList = this.getNodeList();
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
        this.spacingGate = 0;
        this.spacingGateActive = false;
        this.wakeAll();
    }

    /**
     * Wake up a specific node.
     */
    wakeNode(nodeId: string) {
        const node = this.nodes.get(nodeId);
        if (node) {
            node.warmth = 1.0;
            node.isSleeping = false;
            node.sleepFrames = 0;
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
            node.isSleeping = false;
            node.sleepFrames = 0;
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
            this.lastDraggedNodeId = nodeId;

            // KINEMATIC LOCK: Clear old forces/velocities to prevent fighting
            const node = this.nodes.get(nodeId);
            if (node) {
                node.vx = 0;
                node.vy = 0;
                node.fx = 0;
                node.fy = 0;
            }

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

            // Always wake self (ensure velocity is integrated)
            this.wakeNode(this.draggedNodeId);

            // FIX #14: THROTTLED WAKE PROPAGATION
            // Only wake neighbors every 100ms to prevent "boil" (energy pumping)
            const now = getNowMs();
            if (now - this.lastWakeTime > 100) {
                this.wakeNeighbors(this.draggedNodeId);
                this.lastWakeTime = now;
            }
        }
    }

    /**
     * Release the node.
     */
    releaseNode() {
        if (this.draggedNodeId) {
            const node = this.nodes.get(this.draggedNodeId);
            if (node) {
                // RELEASE DAMPING: Clamp velocity to prevent slingshot
                const speed = Math.sqrt(node.vx * node.vx + node.vy * node.vy);
                const maxLaunch = 200.0; // Reasonable fling cap
                if (speed > maxLaunch) {
                    const scale = maxLaunch / speed;
                    node.vx *= scale;
                    node.vy *= scale;
                }
                // Optional: apply immediate extra damping to stabilize
                node.vx *= 0.8;
                node.vy *= 0.8;
            }
        }
        this.draggedNodeId = null;
        this.dragTarget = null;
    }

    /**
     * Request an impulse kick.
     * FIX #11: Strict cooldown (>1s) + Interaction Guard (no drag).
     */
    requestImpulse() {
        const now = getNowMs();

        // Guard 1: Cooldown (1000ms)
        if (now - this.lastImpulseTime < 1000) {
            console.log(`[Impulse] REJECTED: Cooldown (${(now - this.lastImpulseTime).toFixed(0)}ms < 1000ms)`);
            return;
        }

        // Guard 2: Interaction (Don't kick while user holds a node)
        if (this.draggedNodeId) {
            console.log(`[Impulse] REJECTED: User Dragging`);
            return;
        }

        // Fire!
        fireInitialImpulse(this, now);
        this.lastImpulseTime = now;
        this.hasFiredImpulse = true;
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
        const nodeList = this.getNodeList();
        const debugStats = createDebugStats();
        const perfEnabled = this.config.debugPerf === true;
        const allocCounter = perfEnabled ? { newEntries: 0 } : undefined;
        const frameTiming = perfEnabled
            ? {
                repulsionMs: 0,
                collisionMs: 0,
                springsMs: 0,
                spacingMs: 0,
                pbdMs: 0,
                totalMs: 0,
            }
            : null;
        const tickStart = perfEnabled ? getNowMs() : 0;

        this.awakeList.length = 0;
        this.sleepingList.length = 0;
        for (let i = 0; i < nodeList.length; i++) {
            const node = nodeList[i];
            node.listIndex = i;
            const isSleeping = (node.isFixed || node.isSleeping === true) && node.id !== this.draggedNodeId;
            if (isSleeping) {
                this.sleepingList.push(node);
            } else {
                this.awakeList.push(node);
            }
        }

        // Lifecycle Management
        this.lifecycle += dt;
        this.frameIndex++;

        this.updatePerfMode(nodeList.length, this.links.length);
        const degradeLevel = this.degradeLevel;
        if (this.draggedNodeId) {
            this.localBoostFrames = 8;
        } else if (this.localBoostFrames > 0) {
            this.localBoostFrames -= 1;
        }
        const localBoostActive = this.localBoostFrames > 0;

        // =====================================================================
        // SOFT PRE-ROLL PHASE (Gentle separation before expansion)
        // Springs at 10%, spacing on, angle off, velocity-only corrections
        // Runs for ~5 frames before expansion starts
        // =====================================================================
        const preRollActive = this.preRollFrames > 0 && !this.hasFiredImpulse;
        if (preRollActive) {
            runPreRollPhase(this, nodeList, debugStats);
        }

        // 0. FIRE IMPULSE (One Shot, Guarded)
        // FIX #11: Guarded Impulse Kick
        // Logic moved to requestImpulse() to enforce cooldowns and safeguards.
        // We only auto-fire if lifecycle is young and we haven't fired yet.
        if (!preRollActive && this.lifecycle < 0.1 && !this.hasFiredImpulse) {
            this.requestImpulse();
        }

        advanceEscapeWindow(this);

        // =====================================================================
        // EXPONENTIAL COOLING: Energy decays asymptotically, never stops
        // =====================================================================
        const { energy, forceScale, effectiveDamping, maxVelocityEffective } = computeEnergyEnvelope(this.lifecycle);

        const degradePairScale = degradeLevel === 0 ? 1 : degradeLevel === 1 ? 0.7 : 0.4;

        // FIX #9: SMOOTH MODE TRANSITIONS
        // Slew the budget scalar instead of snapping to prevent "law changes".
        const targetBudgetScale = (this.perfMode === 'normal'
            ? 1
            : this.perfMode === 'stressed'
                ? 0.7
                : this.perfMode === 'emergency'
                    ? 0.4
                    : 0) * degradePairScale;

        // Initialize if undefined (first frame)
        if ((this as any)._currentBudgetScale === undefined) {
            (this as any)._currentBudgetScale = targetBudgetScale;
        }

        // Slew towards target (10% per frame)
        // This makes transitions take ~0.5s instead of 0s
        const slewRate = 0.1;
        const diff = targetBudgetScale - (this as any)._currentBudgetScale;
        if (Math.abs(diff) > 0.001) {
            (this as any)._currentBudgetScale += diff * slewRate;
        } else {
            (this as any)._currentBudgetScale = targetBudgetScale;
        }

        const pairBudgetScale = (this as any)._currentBudgetScale;

        const pairStrideBase = pairBudgetScale > 0
            ? computePairStride(
                nodeList.length,
                this.config.pairwiseMaxChecks * pairBudgetScale,
                this.config.pairwiseMaxStride
            )
            : this.config.pairwiseMaxStride;
        const pairOffset = this.frameIndex;

        const spacingGateOn = this.config.spacingGateOnEnergy;
        const spacingGateOff = this.config.spacingGateOffEnergy;
        if (this.spacingGateActive) {
            if (energy > spacingGateOff) this.spacingGateActive = false;
        } else if (energy < spacingGateOn) {
            this.spacingGateActive = true;
        }

        let spacingGateTarget = 0;
        if (this.spacingGateActive) {
            const rampStart = this.config.spacingGateRampStart;
            const rampEnd = this.config.spacingGateRampEnd;
            const denom = Math.max(0.0001, rampStart - rampEnd);
            const gateT = Math.max(0, Math.min(1, (rampStart - energy) / denom));
            spacingGateTarget = gateT * gateT * (3 - 2 * gateT);
        }

        const spacingGateRise = 1 - Math.exp(-dt / this.config.spacingGateRiseTime);
        this.spacingGate += (spacingGateTarget - this.spacingGate) * spacingGateRise;
        const spacingGate = this.spacingGate;
        const spacingEnabled = spacingGate > this.config.spacingGateEnableThreshold;
        let spacingStride = pairStrideBase;
        if (spacingEnabled) {
            const scaledTarget = this.config.pairwiseMaxChecks * spacingGate;
            spacingStride = computePairStride(
                nodeList.length,
                scaledTarget,
                this.config.pairwiseMaxStride
            );
        }

        const cascadeActive = spacingEnabled && spacingGate >= this.config.spacingCascadeGate && pairStrideBase > 1;
        const cascadeModulo = this.config.spacingCascadePhaseModulo;
        const cascadePhase = cascadeModulo > 0 ? this.frameIndex % cascadeModulo : 0;
        const spacingPhase = this.config.spacingCascadeSpacingPhase;
        const spacingPhaseActive = !cascadeActive || cascadePhase === spacingPhase;
        const runPairwiseForces = !cascadeActive || cascadePhase !== spacingPhase;
        const spacingEveryBase = this.perfMode === 'normal'
            ? 1
            : this.perfMode === 'stressed'
                ? 2
                : 4;
        const spacingEvery = spacingEveryBase * (degradeLevel === 0 ? 1 : degradeLevel === 1 ? 2 : 3);
        const spacingWillRun = spacingEnabled && spacingPhaseActive && this.frameIndex % spacingEvery === 0;
        const repulsionEvery = degradeLevel === 0 ? 1 : degradeLevel === 1 ? 2 : 3;
        const collisionEvery = degradeLevel === 0 ? 1 : degradeLevel === 1 ? 2 : 3;
        const springsEvery = degradeLevel === 0 ? 1 : degradeLevel === 1 ? 2 : 3;
        const baseSpringsEnabled = this.perfMode !== 'emergency' || this.frameIndex % 2 === 0;
        const springsEnabled = baseSpringsEnabled && this.frameIndex % springsEvery === 0;

        const triangleEvery = degradeLevel === 0 ? 1 : degradeLevel === 1 ? 2 : 4;
        const safetyEvery = degradeLevel === 0 ? 1 : degradeLevel === 1 ? 2 : 3;
        const edgeRelaxEvery = degradeLevel === 0 ? 1 : degradeLevel === 1 ? 2 : 3;
        const microEvery = degradeLevel === 0 ? 1 : degradeLevel === 1 ? 2 : 4;

        const repulsionEnabled = runPairwiseForces && this.frameIndex % repulsionEvery === 0;
        const collisionEnabled = runPairwiseForces && (this.frameIndex + 1) % collisionEvery === 0;

        if (perfEnabled) {
            const now = getNowMs();
            if (now - this.spacingLogAt >= 1000) {
                this.spacingLogAt = now;
                console.log(
                    `[PhysicsSpacing] energy=${energy.toFixed(3)} ` +
                    `spacingStrength=${spacingGate.toFixed(3)} ` +
                    `spacingEnabled=${spacingEnabled} ` +
                    `spacingFreq=${spacingEvery} ` +
                    `mode=${this.perfMode}`
                );
            }
            if (now - this.passLogAt >= 1000) {
                this.passLogAt = now;
                console.log(
                    `[PhysicsPasses] repulsion=${runPairwiseForces} ` +
                    `collision=${runPairwiseForces} ` +
                    `spacing=${spacingWillRun} ` +
                    `pairStride=${pairStrideBase} ` +
                    `spacingStride=${spacingStride} ` +
                    `pairOffset=${pairOffset} ` +
                    `spacingOffset=${pairOffset + 2} ` +
                    `cascade=${cascadeActive} ` +
                    `phase=${cascadeActive ? cascadePhase : -1}`
                );

                // [PhysicsFeel] Instrumentation
                // Show effective per-second values to verify time-consistency
                // damping(0.9) @ 60hz => 0.9^60 per sec
                const dampPerSec = Math.pow(Math.exp(-effectiveDamping * 5.0 * dt), 1 / dt);
                // correctionBudget(1.5) @ 60hz => 1.5 * 60 per sec
                const budgetPerSec = this.config.maxCorrectionPerFrame * 60;
                // spacingStrength
                const spacingStr = spacingGate;

                console.log(
                    `[PhysicsFeel] mode=${this.perfMode} ` +
                    `dt=${(dt * 1000).toFixed(1)}ms ` +
                    `dampPerSec=${dampPerSec.toFixed(3)} ` +
                    `corrBudgetPerSec=${budgetPerSec.toFixed(1)}px ` +
                    `spacingGate=${spacingStr.toFixed(3)}`
                );

                if (this.draggedNodeId && this.dragTarget) {
                    const node = this.nodes.get(this.draggedNodeId);
                    if (node) {
                        const dx = node.x - this.dragTarget.x;
                        const dy = node.y - this.dragTarget.y;
                        const lag = Math.sqrt(dx * dx + dy * dy);
                        console.log(`[Input] Drag Lag: ${lag.toFixed(2)}px (Goal: 0.00)`);
                    }
                }
            }
            if (now - this.degradeLogAt >= 1000) {
                this.degradeLogAt = now;
                console.log(
                    `[Degrade] level=${degradeLevel} ` +
                    `reason=${this.degradeReason} ` +
                    `budgetMs=${this.degradeBudgetMs.toFixed(1)} ` +
                    `passes={repel:${repulsionEnabled ? 'Y' : 'N'} ` +
                    `coll:${collisionEnabled ? 'Y' : 'N'} ` +
                    `space:${spacingWillRun ? 'Y' : 'N'} ` +
                    `spring:${springsEnabled ? 'Y' : 'N'} ` +
                    `tri:${(this.perfMode === 'normal' || this.perfMode === 'stressed') && this.frameIndex % triangleEvery === 0 ? 'Y' : 'N'} ` +
                    `safety:${this.frameIndex % safetyEvery === 0 ? 'Y' : 'N'} ` +
                    `diff:Y micro:${this.frameIndex % microEvery === 0 ? 'Y' : 'N'}} ` +
                    `k={repel:${repulsionEvery} coll:${collisionEvery} spring:${springsEvery} ` +
                    `space:${spacingEvery} tri:${triangleEvery} safety:${safetyEvery} micro:${microEvery}} ` +
                    `pairBudget={pairStride:${pairStrideBase} spacingStride:${spacingStride} smoothScale:${((this as any)._currentBudgetScale ?? 1.0).toFixed(2)}}`
                );
            }
        }


        if (this.perfMode === 'fatal') {
            // FIX #10: Fatal Mode Containment
            // Even in fatal mode, we MUST apply boundary constraints to prevent
            // the graph from drifting off-screen or exploding.
            applyBoundaryForce(nodeList, this.config, this.worldWidth, this.worldHeight);

            for (const node of nodeList) {
                // We do NOT clear forces here if we just applied boundary force!
                // We only clear the *other* forces by not calculating them.
                // But wait, applyBoundaryForce ADDS to fx/fy.
                // So we should clear first.
                node.fx = 0;
                node.fy = 0;
            }
            // Re-apply boundary force AFTER clearing (oops, the order above was wrong)
            // Let's do: Clear -> Apply Boundary -> Integrate.

            // Correct Order:
            for (const node of nodeList) {
                node.fx = 0;
                node.fy = 0;
            }
            applyBoundaryForce(nodeList, this.config, this.worldWidth, this.worldHeight);

            applyDragVelocity(this, nodeList, dt, debugStats);
            applyPreRollVelocity(this, nodeList, preRollActive, debugStats);
            integrateNodes(this, nodeList, dt, energy, effectiveDamping, maxVelocityEffective, debugStats, preRollActive);
            this.lastDebugStats = debugStats;
            if (perfEnabled && frameTiming) {
                frameTiming.totalMs = getNowMs() - tickStart;
            }
            return;
        }



        let focusActive: PhysicsNode[] = [];
        let focusSleeping: PhysicsNode[] = [];
        const focusCenterId = this.draggedNodeId ?? this.lastDraggedNodeId;
        if (localBoostActive && focusCenterId) {
            const focusIds = new Set<string>();
            focusIds.add(focusCenterId);
            for (const link of this.links) {
                if (link.source === focusCenterId) focusIds.add(link.target);
                if (link.target === focusCenterId) focusIds.add(link.source);
            }
            for (const node of nodeList) {
                if (focusIds.has(node.id)) {
                    focusActive.push(node);
                } else {
                    focusSleeping.push(node);
                }
            }
        }

        // 2. Apply Core Forces (scaled by energy)
        applyForcePass(
            this,
            nodeList,
            this.awakeList,
            this.sleepingList,
            forceScale,
            dt,
            debugStats,
            preRollActive,
            energy,
            this.frameIndex,
            frameTiming ?? undefined,
            perfEnabled ? getNowMs : undefined,
            pairStrideBase,
            pairOffset,
            repulsionEnabled,
            collisionEnabled,
            springsEnabled,
            localBoostActive && !repulsionEnabled ? focusActive : undefined,
            localBoostActive && !repulsionEnabled ? focusSleeping : undefined,
            localBoostActive && !repulsionEnabled,
            localBoostActive && !collisionEnabled,
            1,
            pairOffset + 7
        );
        applyDragVelocity(this, nodeList, dt, debugStats);
        applyPreRollVelocity(this, nodeList, preRollActive, debugStats);

        // 4. Integrate (always runs, never stops)
        integrateNodes(this, nodeList, dt, energy, effectiveDamping, maxVelocityEffective, debugStats, preRollActive);

        // =====================================================================
        // COMPUTE NODE DEGREES (needed early for degree-1 exclusion)
        // Degree-1 nodes (dangling limbs) are excluded from positional corrections
        // =====================================================================
        const nodeDegreeEarly = computeNodeDegrees(this, nodeList);

        applyExpansionResistance(this, nodeList, nodeDegreeEarly, energy, debugStats, dt);

        const microEnabled = this.frameIndex % microEvery === 0;
        if (microEnabled) {
            // Dense-core velocity de-locking (micro-slip) - breaks rigid-body lock
            applyDenseCoreVelocityDeLocking(this, nodeList, energy, debugStats);

            // Static friction bypass - breaks zero-velocity rest state
            applyStaticFrictionBypass(this, nodeList, energy, debugStats);

            // Angular velocity decoherence - breaks velocity orientation correlation
            applyAngularVelocityDecoherence(this, nodeList, energy, debugStats);

            // Local phase diffusion - breaks oscillation synchronization (shape memory eraser)
            applyLocalPhaseDiffusion(this, nodeList, energy, debugStats);

            // Low-force stagnation escape - breaks rest-position preference (edge shear version)
            applyEdgeShearStagnationEscape(this, nodeList, energy, debugStats);

            // Dense-core inertia relaxation - erases momentum memory in jammed nodes
            applyDenseCoreInertiaRelaxation(this, nodeList, energy, debugStats);
        }

        // =====================================================================
        // PER-NODE CORRECTION BUDGET SYSTEM
        // All constraints request position corrections via accumulator
        // Total correction magnitude is clamped to prevent multi-constraint pileup
        // =====================================================================
        const pbdStart = perfEnabled ? getNowMs() : 0;
        const correctionAccum = initializeCorrectionAccum(nodeList, this.correctionAccumCache, allocCounter);
        if (allocCounter) {
            this.perfCounters.correctionNewEntries += allocCounter.newEntries;
        }

        if (!preRollActive) {
            const edgeRelaxEnabled = this.frameIndex % edgeRelaxEvery === 0;
            if (edgeRelaxEnabled) {
                applyEdgeRelaxation(this, correctionAccum, nodeDegreeEarly, debugStats, dt);
            }
            if (spacingWillRun) {
                if (perfEnabled && frameTiming) {
                    const spacingStart = getNowMs();
                    applySpacingConstraints(
                        this,
                        this.awakeList,
                        this.sleepingList,
                        correctionAccum,
                        nodeDegreeEarly,
                        energy,
                        debugStats,
                        spacingGate,
                        dt,
                        spacingStride,
                        pairOffset + 2
                    );
                    frameTiming.spacingMs += getNowMs() - spacingStart;
                } else {
                    applySpacingConstraints(
                        this,
                        this.awakeList,
                        this.sleepingList,
                        correctionAccum,
                        nodeDegreeEarly,
                        energy,
                        debugStats,
                        spacingGate,
                        dt,
                        spacingStride,
                        pairOffset + 2
                    );
                }
            } else if (localBoostActive && focusActive.length > 0) {
                applySpacingConstraints(
                    this,
                    focusActive,
                    focusSleeping,
                    correctionAccum,
                    nodeDegreeEarly,
                    energy,
                    debugStats,
                    spacingGate,
                    dt,
                    1,
                    pairOffset + 5
                );
            }
            const triangleEnabled = (this.perfMode === 'normal' || this.perfMode === 'stressed') &&
                this.frameIndex % triangleEvery === 0;
            if (triangleEnabled) {
                applyTriangleAreaConstraints(this, nodeList, correctionAccum, nodeDegreeEarly, energy, debugStats, dt);
            }
            applyAngleResistanceVelocity(this, nodeList, nodeDegreeEarly, energy, debugStats, dt);
            applyDistanceBiasVelocity(this, nodeList, debugStats, dt);
            const safetyEnabled = this.frameIndex % safetyEvery === 0;
            if (safetyEnabled) {
                applySafetyClamp(
                    this,
                    this.awakeList,
                    this.sleepingList,
                    correctionAccum,
                    nodeDegreeEarly,
                    energy,
                    debugStats,
                    dt,
                    pairStrideBase,
                    pairOffset + 3
                );
            } else if (localBoostActive && focusActive.length > 0) {
                applySafetyClamp(
                    this,
                    focusActive,
                    focusSleeping,
                    correctionAccum,
                    nodeDegreeEarly,
                    energy,
                    debugStats,
                    dt,
                    1,
                    pairOffset + 6
                );
            }
            const maxDiffusionNeighbors = degradeLevel === 0 ? undefined : degradeLevel === 1 ? 4 : 2;
            applyCorrectionsWithDiffusion(
                this,
                nodeList,
                correctionAccum,
                energy,
                spacingGate,
                debugStats,
                dt,
                maxDiffusionNeighbors
            );
        }
        if (perfEnabled && frameTiming) {
            frameTiming.pbdMs += getNowMs() - pbdStart;
        }

        if (this.draggedNodeId && this.dragTarget) {
            const node = this.nodes.get(this.draggedNodeId);
            if (node) {
                const dx = node.x - this.dragTarget.x;
                const dy = node.y - this.dragTarget.y;
                const lag = Math.sqrt(dx * dx + dy * dy);
                this.dragLagSamples.push(lag);
            }
        }

        if (perfEnabled) {
            const now = getNowMs();
            if (now - this.handLogAt >= 1000) {
                this.handLogAt = now;
                let lagP95 = 0;
                if (this.dragLagSamples.length > 0) {
                    const sorted = this.dragLagSamples.slice().sort((a, b) => a - b);
                    const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95));
                    lagP95 = sorted[idx] ?? 0;
                }
                console.log(
                    `[Hand] dragging=${this.draggedNodeId ? 'Y' : 'N'} ` +
                    `localBoost=${localBoostActive ? 'Y' : 'N'} ` +
                    `lagP95Px=${lagP95.toFixed(2)}`
                );
                this.dragLagSamples.length = 0;
            }
        }

        logEnergyDebug(this.lifecycle, energy, effectiveDamping, maxVelocityEffective);
        this.lastDebugStats = debugStats;

        if (perfEnabled && frameTiming) {
            const tickEnd = getNowMs();
            frameTiming.totalMs = tickEnd - tickStart;

            const perf = this.perfTiming;
            perf.frameCount += 1;
            perf.totals.repulsionMs += frameTiming.repulsionMs;
            perf.totals.collisionMs += frameTiming.collisionMs;
            perf.totals.springsMs += frameTiming.springsMs;
            perf.totals.spacingMs += frameTiming.spacingMs;
            perf.totals.pbdMs += frameTiming.pbdMs;
            perf.totals.totalMs += frameTiming.totalMs;

            if (perf.lastReportAt === 0) {
                perf.lastReportAt = tickEnd;
            }
            const elapsed = tickEnd - perf.lastReportAt;
            if (elapsed >= 1000) {
                const frames = perf.frameCount || 1;
                const avg = (value: number) => (value / frames).toFixed(3);
                console.log(
                    `[PhysicsPerf] avgMs repulsion=${avg(perf.totals.repulsionMs)} ` +
                    `collision=${avg(perf.totals.collisionMs)} ` +
                    `springs=${avg(perf.totals.springsMs)} ` +
                    `spacing=${avg(perf.totals.spacingMs)} ` +
                    `pbd=${avg(perf.totals.pbdMs)} ` +
                    `total=${avg(perf.totals.totalMs)} ` +
                    `nodes=${nodeList.length} ` +
                    `links=${this.links.length} ` +
                    `mode=${this.perfMode} ` +
                    `allocs=${this.perfCounters.nodeListBuilds + this.perfCounters.correctionNewEntries} ` +
                    `topoDrop=${this.perfCounters.topologySkipped} ` +
                    `topoDup=${this.perfCounters.topologyDuplicates} ` +
                    `frames=${frames}`
                );
                perf.frameCount = 0;
                perf.totals.repulsionMs = 0;
                perf.totals.collisionMs = 0;
                perf.totals.springsMs = 0;
                perf.totals.spacingMs = 0;
                perf.totals.pbdMs = 0;
                perf.totals.totalMs = 0;
                perf.lastReportAt = tickEnd;
                this.perfCounters.nodeListBuilds = 0;
                this.perfCounters.correctionNewEntries = 0;
                this.perfCounters.topologySkipped = 0;
                this.perfCounters.topologyDuplicates = 0;
            }
        }
    }

    public getNodeList(): PhysicsNode[] {
        if (this.nodeListDirty) {
            this.nodeListCache.length = 0;
            for (const node of this.nodes.values()) {
                this.nodeListCache.push(node);
            }
            this.nodeListDirty = false;
            this.perfCounters.nodeListBuilds += 1;
        }
        return this.nodeListCache;
    }

    private updatePerfMode(nodeCount: number, linkCount: number) {
        const downshift = this.config.perfModeDownshiftRatio;
        const nextMode = (n: number, e: number) => {
            if (n >= this.config.perfModeNFatal || e >= this.config.perfModeEFatal) return 'fatal';
            if (n >= this.config.perfModeNEmergency || e >= this.config.perfModeEEmergency) return 'emergency';
            if (n >= this.config.perfModeNStressed || e >= this.config.perfModeEStressed) return 'stressed';
            return 'normal';
        };

        const desired = nextMode(nodeCount, linkCount);
        if (desired === this.perfMode) return;

        const downshiftThresholds = {
            stressed: {
                n: this.config.perfModeNStressed * downshift,
                e: this.config.perfModeEStressed * downshift,
            },
            emergency: {
                n: this.config.perfModeNEmergency * downshift,
                e: this.config.perfModeEEmergency * downshift,
            },
            fatal: {
                n: this.config.perfModeNFatal * downshift,
                e: this.config.perfModeEFatal * downshift,
            },
        };

        const allowDownshift = (mode: 'stressed' | 'emergency' | 'fatal') => {
            const thresholds = downshiftThresholds[mode];
            return nodeCount < thresholds.n && linkCount < thresholds.e;
        };

        let newMode = this.perfMode;
        if (desired === 'fatal') {
            newMode = 'fatal';
        } else if (desired === 'emergency') {
            if (this.perfMode === 'fatal') {
                if (allowDownshift('fatal')) newMode = 'emergency';
            } else {
                newMode = 'emergency';
            }
        } else if (desired === 'stressed') {
            if (this.perfMode === 'fatal') {
                if (allowDownshift('fatal')) newMode = 'emergency';
            }
            if (newMode === 'emergency' && allowDownshift('emergency')) {
                newMode = 'stressed';
            }
            if (this.perfMode === 'normal') newMode = 'stressed';
        } else {
            if (this.perfMode === 'fatal' && allowDownshift('fatal')) newMode = 'emergency';
            if (newMode === 'emergency' && allowDownshift('emergency')) newMode = 'stressed';
            if (newMode === 'stressed' && allowDownshift('stressed')) newMode = 'normal';
        }

        if (newMode !== this.perfMode) {
            this.perfMode = newMode;
            const now = getNowMs();
            if (now - this.perfModeLogAt > 500) {
                this.perfModeLogAt = now;
                console.log(`[PhysicsMode] mode=${this.perfMode} nodes=${nodeCount} links=${linkCount}`);
            }
        }

        if (this.perfMode === 'fatal') {
            const now = getNowMs();
            if (now - this.perfModeLogAt > 1000) {
                this.perfModeLogAt = now;
                console.log(`[PhysicsFatal] nodes=${nodeCount} links=${linkCount} mode=fatal`);
            }
        }
    }

    private warnTopology(reason: 'maxLinksPerNode' | 'maxTotalLinks', link: PhysicsLink) {
        const now = getNowMs();
        if (now - this.topologyWarnAt < 1000) return;
        this.topologyWarnAt = now;
        console.log(
            `[PhysicsTopology] drop=${reason} source=${link.source} target=${link.target} ` +
            `nodes=${this.nodes.size} links=${this.links.length}`
        );
    }
}
