import type { PhysicsNode, ForceConfig } from '../types';
import { fireInitialImpulse } from './impulse';
import { getNowMs } from './engineTime';

export type PhysicsEngineInteractionContext = {
    nodes: Map<string, PhysicsNode>;
    config: ForceConfig;
    draggedNodeId: string | null;
    dragTarget: { x: number; y: number } | null;
    grabOffset: { x: number; y: number } | null;
    interactionLock: boolean;
    interactionLockReason: string | null;
    lastDraggedNodeId: string | null;
    lastWakeTime: number;
    lastImpulseTime: number;
    hasFiredImpulse: boolean;
    idleFrames: number;
    adjacencyMap: Map<string, string[]>;
    correctionAccumCache: Map<string, { dx: number; dy: number }>;
    worldWidth: number;
    worldHeight: number;
    wakeNode: (id: string) => void;
    wakeNeighbors: (id: string) => void;
    wakeAll: () => void;
};

export const lockInteraction = (engine: PhysicsEngineInteractionContext, reason: string) => {
    if (!engine.interactionLock) {
        engine.interactionLock = true;
        engine.interactionLockReason = reason;
        if (engine.config.debugPerf) {
            console.log(`[PhysicsLock] Locked (${reason})`);
        }
    }
};

export const unlockInteraction = (engine: PhysicsEngineInteractionContext) => {
    if (engine.interactionLock) {
        engine.interactionLock = false;
        engine.interactionLockReason = null;
        if (engine.config.debugPerf) {
            console.log(`[PhysicsLock] Unlocked`);
        }
    }
};

export const wakeNode = (engine: PhysicsEngineInteractionContext, nodeId: string) => {
    const node = engine.nodes.get(nodeId);
    if (node) {
        node.warmth = 1.0;
        node.isSleeping = false;
        node.sleepFrames = 0;
        node.lastCorrectionMag = 0;

        const accum = engine.correctionAccumCache.get(nodeId);
        if (accum) {
            accum.dx = 0;
            accum.dy = 0;
        }
    }
};

export const wakeNeighbors = (engine: PhysicsEngineInteractionContext, nodeId: string) => {
    const neighbors = engine.adjacencyMap.get(nodeId);
    if (neighbors) {
        for (const nbId of neighbors) {
            wakeNode(engine, nbId);
        }
    }
};

export const wakeAll = (engine: PhysicsEngineInteractionContext) => {
    for (const node of engine.nodes.values()) {
        node.warmth = 1.0;
        node.isSleeping = false;
        node.sleepFrames = 0;
    }
};

export const updateBounds = (engine: PhysicsEngineInteractionContext, width: number, height: number) => {
    engine.worldWidth = width;
    engine.worldHeight = height;
    wakeAll(engine);
};

export const grabNode = (engine: PhysicsEngineInteractionContext, nodeId: string, position: { x: number; y: number }) => {
    if (engine.nodes.has(nodeId)) {
        engine.draggedNodeId = nodeId;
        engine.lastDraggedNodeId = nodeId;

        const node = engine.nodes.get(nodeId);
        if (node) {
            // FIX: Initialize dragTarget to NODE position, not cursor
            // This prevents the initial huge jump that causes explosion
            // The lerp in applyKinematicDrag will smoothly move toward cursor
            engine.dragTarget = { x: node.x, y: node.y };

            node.isFixed = true;

            node.vx = 0;
            node.vy = 0;
            node.fx = 0;
            node.fy = 0;

            node.prevFx = 0;
            node.prevFy = 0;
            node.correctionResidual = undefined;
            delete node.lastCorrectionDir;
        }

        wakeNode(engine, nodeId);
        wakeNeighbors(engine, nodeId);
    }
};

export const moveDrag = (engine: PhysicsEngineInteractionContext, position: { x: number; y: number }) => {
    if (engine.draggedNodeId && engine.dragTarget) {
        engine.dragTarget = { ...position };

        wakeNode(engine, engine.draggedNodeId);

        const now = getNowMs();
        if (now - engine.lastWakeTime > 100) {
            wakeNeighbors(engine, engine.draggedNodeId);
            engine.lastWakeTime = now;
        }
    }
};

export const releaseNode = (engine: PhysicsEngineInteractionContext) => {
    if (engine.draggedNodeId) {
        // Run 7: Track release for telemetry
        engine.lastReleasedNodeId = engine.draggedNodeId;
        engine.lastReleaseFrame = (engine as any).frameIndex || 0; // Cast for safety if context missing frameIndex

        const node = engine.nodes.get(engine.draggedNodeId);
        if (node) {
            // Run 7: Momentum Preservation
            // Do NOT zero velocity here. Let the solver/integrator inherit the "throw".
            // node.vx = 0;
            // node.vy = 0;
            node.fx = 0;
            node.fy = 0;
            node.prevFx = 0;
            node.prevFy = 0;

            node.correctionResidual = undefined;
            delete node.lastCorrectionDir;
            node.lastCorrectionMag = 0;

            node.isFixed = false;
        }
    }
    engine.draggedNodeId = null;
    engine.dragTarget = null;
    engine.lastDraggedNodeId = null;
    engine.grabOffset = null; // Clear drag distance clamp
    engine.idleFrames = 0;
};

export const requestImpulse = (engine: PhysicsEngineInteractionContext) => {
    if (engine.config.initStrategy !== 'legacy') {
        return;
    }
    const now = getNowMs();

    if (now - engine.lastImpulseTime < 1000) {
        return;
    }

    if (engine.draggedNodeId) {
        return;
    }

    fireInitialImpulse(engine as any, now);
    engine.lastImpulseTime = now;
    engine.hasFiredImpulse = true;
    engine.idleFrames = 0;
};
