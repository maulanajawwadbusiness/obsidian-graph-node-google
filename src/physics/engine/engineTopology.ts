import type { PhysicsLink, PhysicsNode, ForceConfig } from '../types';
import type { XpbdSpatialGrid } from './xpbd';
import { createInitialPhysicsHudHistory, createInitialPhysicsHudSnapshot, type PhysicsHudHistory, type PhysicsHudSnapshot } from './physicsHud';
import { getNowMs } from './engineTime';

export type PhysicsEngineTopologyContext = {
    nodes: Map<string, PhysicsNode>;
    links: PhysicsLink[];
    config: ForceConfig;
    nodeListCache: PhysicsNode[];
    awakeList: PhysicsNode[];
    sleepingList: PhysicsNode[];
    nodeListDirty: boolean;
    correctionAccumCache: Map<string, { dx: number; dy: number }>;
    topologyLinkKeys: Set<string>;
    nodeLinkCounts: Map<string, number>;
    adjacencyMap: Map<string, string[]>;
    spacingHotPairs: Set<string>;
    neighborCache: Map<string, Set<string>>;
    xpbdSpatialGrid: XpbdSpatialGrid | null;
    xpbdCanaryApplied: boolean;
    lifecycle: number;
    hasFiredImpulse: boolean;
    // FIX D: Scale
    triangleCache: [string, string, string][] | null;
    spacingGate: number;
    spacingGateActive: boolean;
    globalAngle: number;
    globalAngularVel: number;
    hudSnapshot: PhysicsHudSnapshot;
    hudHistory: PhysicsHudHistory;
    hudSettleState: PhysicsHudSnapshot['settleState'];
    hudSettleStateAt: number;
    perfCounters: {
        nodeListBuilds: number;
        correctionNewEntries: number;
        topologySkipped: number;
        topologyDuplicates: number;
    };
    preRollFrames: number;
    clampedPairs: Set<string>;
    wakeNode: (id: string) => void;
    wakeAll: () => void;
    invalidateWarmStart: (reason: string) => void;
    resetStartupStats: () => void;
};

export const addNodeToEngine = (engine: PhysicsEngineTopologyContext, node: PhysicsNode) => {
    engine.nodes.set(node.id, node);
    node.lastGoodX = node.x;
    node.lastGoodY = node.y;
    node.lastGoodVx = node.vx;
    node.lastGoodVy = node.vy;
    engine.nodeListDirty = true;
    if (!engine.nodeLinkCounts.has(node.id)) {
        engine.nodeLinkCounts.set(node.id, 0);
    }
    if (!engine.adjacencyMap.has(node.id)) {
        engine.adjacencyMap.set(node.id, []);
    }
    engine.wakeNode(node.id);
    engine.invalidateWarmStart('TOPOLOGY_CHANGE');

    // FIX D: Scale - Invalidate Cache
    engine.triangleCache = null;
};

export const addLinkToEngine = (engine: PhysicsEngineTopologyContext, link: PhysicsLink) => {
    const source = link.source;
    const target = link.target;
    const key = source < target ? `${source}:${target}` : `${target}:${source}`;

    if (engine.topologyLinkKeys.has(key)) {
        engine.perfCounters.topologyDuplicates += 1;
        if (engine.config.debugPerf) console.warn(`[Topology] Duplicate rejected: ${key}`);
        return;
    }

    const sourceCount = engine.nodeLinkCounts.get(source) || 0;
    const targetCount = engine.nodeLinkCounts.get(target) || 0;

    if (sourceCount >= engine.config.maxLinksPerNode || targetCount >= engine.config.maxLinksPerNode) {
        engine.perfCounters.topologySkipped += 1;
        if (engine.config.debugPerf) {
            console.warn(`[Topology] Degree Limit s=${sourceCount} t=${targetCount} cap=${engine.config.maxLinksPerNode}`);
        }
        return;
    }
    if (engine.links.length >= engine.config.maxTotalLinks) {
        engine.perfCounters.topologySkipped += 1;
        if (engine.config.debugPerf) console.warn('[Topology] Max total links reached');
        return;
    }

    engine.links.push(link);
    engine.topologyLinkKeys.add(key);
    engine.nodeLinkCounts.set(source, sourceCount + 1);
    engine.nodeLinkCounts.set(target, targetCount + 1);

    if (!engine.adjacencyMap.has(source)) engine.adjacencyMap.set(source, []);
    if (!engine.adjacencyMap.has(target)) engine.adjacencyMap.set(target, []);
    engine.adjacencyMap.get(source)?.push(target);
    engine.adjacencyMap.get(target)?.push(source);

    engine.wakeNode(link.source);
    engine.wakeNode(link.target);
    engine.wakeNode(link.target);
    engine.invalidateWarmStart('TOPOLOGY_CHANGE');

    // FIX D: Scale - Invalidate Cache
    engine.triangleCache = null;
};

export const invalidateWarmStart = (engine: PhysicsEngineTopologyContext, reason: string) => {
    engine.clampedPairs.clear();

    for (const node of engine.nodes.values()) {
        delete node.lastCorrectionDir;
        node.correctionResidual = undefined;
        node.prevFx = 0;
        node.prevFy = 0;
    }

    if (engine.config.debugPerf) {
        console.log(`[WarmStart] Invalidation Triggered: ${reason}`);
    }
};

export const clearEngineState = (engine: PhysicsEngineTopologyContext) => {
    engine.nodes.clear();
    engine.links = [];
    engine.nodeListCache.length = 0;
    engine.awakeList.length = 0;
    engine.sleepingList.length = 0;
    engine.nodeListDirty = true;
    engine.correctionAccumCache.clear();
    engine.topologyLinkKeys.clear();
    engine.nodeLinkCounts.clear();
    engine.adjacencyMap.clear();
    engine.spacingHotPairs.clear();
    engine.neighborCache.clear();
    engine.lifecycle = 0;
    engine.hasFiredImpulse = false;
    engine.spacingGate = 0;
    engine.spacingGateActive = false;
    engine.globalAngle = 0;
    engine.globalAngularVel = 0;
    engine.xpbdCanaryApplied = false;
    if (engine.xpbdSpatialGrid) {
        engine.xpbdSpatialGrid.clear();
    }
    engine.hudSnapshot = createInitialPhysicsHudSnapshot();
    engine.hudHistory = createInitialPhysicsHudHistory();
    engine.hudSettleState = 'moving';
    engine.hudSettleStateAt = getNowMs();
    engine.resetStartupStats();
};

export const updateEngineConfig = (engine: PhysicsEngineTopologyContext, newConfig: Partial<ForceConfig>) => {
    engine.config = { ...engine.config, ...newConfig };
    engine.wakeAll();
    engine.invalidateWarmStart('CONFIG_CHANGE');
};
