import type { PhysicsEngine } from '../engine';
import type { PhysicsNode } from '../types';
import type { DebugStats } from './stats';

export class XpbdSpatialGrid {
    private cellSize: number;
    private buckets: Map<number, number[]>;
    private arrayPool: number[][] = [];
    private poolIndex: number = 0;

    constructor(cellSize: number) {
        this.cellSize = cellSize;
        this.buckets = new Map();
    }

    setCellSize(cellSize: number) {
        if (cellSize > 0 && cellSize !== this.cellSize) {
            this.cellSize = cellSize;
            this.clear();
        }
    }

    clear() {
        for (const bucket of this.buckets.values()) {
            bucket.length = 0;
            if (this.poolIndex < this.arrayPool.length) {
                this.arrayPool[this.poolIndex] = bucket;
            } else {
                this.arrayPool.push(bucket);
            }
            this.poolIndex++;
        }
        this.buckets.clear();
    }

    add(x: number, y: number, index: number) {
        const key = this.getKey(x, y);
        let bucket = this.buckets.get(key);
        if (!bucket) {
            if (this.poolIndex > 0) {
                this.poolIndex--;
                bucket = this.arrayPool[this.poolIndex];
            } else {
                bucket = [];
            }
            this.buckets.set(key, bucket);
        }
        bucket.push(index);
    }

    query(x: number, y: number, callback: (index: number) => void) {
        const cx = Math.floor(x / this.cellSize);
        const cy = Math.floor(y / this.cellSize);

        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                const key = (((cx + dx) & 0xffff) << 16) | ((cy + dy) & 0xffff);
                const bucket = this.buckets.get(key);
                if (!bucket) continue;
                for (let i = 0; i < bucket.length; i++) {
                    callback(bucket[i]);
                }
            }
        }
    }

    private getKey(x: number, y: number): number {
        const cx = Math.floor(x / this.cellSize);
        const cy = Math.floor(y / this.cellSize);
        return ((cx & 0xffff) << 16) | (cy & 0xffff);
    }
}

export type XpbdConstraintOptions = {
    enableSprings: boolean;
    enableRepulsion: boolean;
    forceStiffSprings: boolean;
    forceRepulsion: boolean;
};

export const ensureXpbdSpatialGrid = (engine: PhysicsEngine, cellSize: number) => {
    if (!engine.xpbdSpatialGrid) {
        engine.xpbdSpatialGrid = new XpbdSpatialGrid(cellSize);
    } else {
        engine.xpbdSpatialGrid.setCellSize(cellSize);
    }
    return engine.xpbdSpatialGrid;
};

export const applyXpbdConstraints = (
    engine: PhysicsEngine,
    nodeList: PhysicsNode[],
    dt: number,
    stats: DebugStats,
    options: XpbdConstraintOptions
) => {
    const dtSq = dt * dt;
    if (dtSq <= 0) return;

    if (options.enableSprings) {
        applyXpbdLinkSprings(engine, dtSq, stats, options.forceStiffSprings);
    }
    if (options.enableRepulsion) {
        applyXpbdMinDistance(engine, nodeList, dtSq, stats, options.forceRepulsion);
    }
};

const applyXpbdLinkSprings = (
    engine: PhysicsEngine,
    dtSq: number,
    stats: DebugStats,
    forceStiff: boolean
) => {
    const links = engine.links;
    if (links.length === 0) return;

    const baseCompliance = forceStiff
        ? Math.min(engine.config.xpbdSpringCompliance, 0.00002)
        : engine.config.xpbdSpringCompliance;
    const iterations = forceStiff
        ? Math.max(engine.config.xpbdSpringIterations, 6)
        : engine.config.xpbdSpringIterations;

    const frameIndex = engine.frameIndex;
    const linkCount = links.length;
    const startOffset = frameIndex * 17;

    for (let iter = 0; iter < iterations; iter++) {
        for (let i = 0; i < linkCount; i++) {
            const index = (startOffset + i) % linkCount;
            const link = links[index];
            const source = engine.nodes.get(link.source);
            const target = engine.nodes.get(link.target);
            if (!source || !target) continue;
            if (source.isFixed && target.isFixed) continue;

            let dx = target.x - source.x;
            let dy = target.y - source.y;
            if (Math.abs(dx) < 0.0001 && Math.abs(dy) < 0.0001) {
                const rand = engine.pseudoRandom(source.id, target.id);
                const angle = rand * Math.PI * 2;
                dx = Math.cos(angle) * 0.01;
                dy = Math.sin(angle) * 0.01;
            }

            const distSq = dx * dx + dy * dy;
            if (distSq <= 0.000001) continue;
            const dist = Math.sqrt(distSq);

            const baseLen = link.length ?? engine.config.linkRestLength;
            const restLen = baseLen * (link.lengthBias ?? 1);
            const C = dist - restLen;

            const invMassA = source.isFixed ? 0 : 1 / Math.max(0.0001, source.mass);
            const invMassB = target.isFixed ? 0 : 1 / Math.max(0.0001, target.mass);
            const invMassSum = invMassA + invMassB;
            if (invMassSum <= 0) continue;

            const compliance = baseCompliance / Math.max(0.0001, link.strength ?? 1);
            const denom = invMassSum + compliance / dtSq;
            if (denom <= 0) continue;

            const lambda = -C / denom;
            const nx = dx / dist;
            const ny = dy / dist;

            const corrA = lambda * invMassA;
            const corrB = lambda * invMassB;

            if (!source.isFixed) {
                source.x -= nx * corrA;
                source.y -= ny * corrA;
            }
            if (!target.isFixed) {
                target.x += nx * corrB;
                target.y += ny * corrB;
            }

            const pairCorrection = Math.abs(lambda) * invMassSum;
            stats.xpbdSpringCorrSum += pairCorrection;
            if (pairCorrection > stats.xpbdSpringCorrMax) stats.xpbdSpringCorrMax = pairCorrection;
            stats.xpbdSpringConstraintCount += 1;
        }
    }
};

const applyXpbdMinDistance = (
    engine: PhysicsEngine,
    nodeList: PhysicsNode[],
    dtSq: number,
    stats: DebugStats,
    forceStiff: boolean
) => {
    const nodeCount = nodeList.length;
    if (nodeCount === 0) return;

    let maxRadius = 1;
    for (let i = 0; i < nodeCount; i++) {
        if (nodeList[i].radius > maxRadius) maxRadius = nodeList[i].radius;
    }

    const padding = engine.config.collisionPadding ?? 0;
    const cellSize = Math.max(8, maxRadius * 2 + padding);
    const grid = ensureXpbdSpatialGrid(engine, cellSize);
    grid.clear();

    for (let i = 0; i < nodeCount; i++) {
        const node = nodeList[i];
        grid.add(node.x, node.y, i);
    }

    const baseCompliance = forceStiff
        ? Math.min(engine.config.xpbdRepulsionCompliance, 0.00002)
        : engine.config.xpbdRepulsionCompliance;
    const iterations = forceStiff
        ? Math.max(engine.config.xpbdRepulsionIterations, 4)
        : engine.config.xpbdRepulsionIterations;

    let activeNode: PhysicsNode | null = null;
    let activeIndex = 0;
    const visitNeighbor = (j: number) => {
        if (!activeNode) return;
        if (j <= activeIndex) return;
        const nodeB = nodeList[j];
        if (activeNode.isFixed && nodeB.isFixed) return;

        let dx = nodeB.x - activeNode.x;
        let dy = nodeB.y - activeNode.y;
        if (Math.abs(dx) < 0.0001 && Math.abs(dy) < 0.0001) {
            const rand = engine.pseudoRandom(activeNode.id, nodeB.id);
            const angle = rand * Math.PI * 2;
            dx = Math.cos(angle) * 0.01;
            dy = Math.sin(angle) * 0.01;
        }

        const distSq = dx * dx + dy * dy;
        if (distSq <= 0.000001) return;
        const dist = Math.sqrt(distSq);
        const minDist = activeNode.radius + nodeB.radius + padding;
        if (dist >= minDist) return;

        if (dist < minDist * 0.5) {
            stats.xpbdOverlapCount += 1;
        }

        const invMassA = activeNode.isFixed ? 0 : 1 / Math.max(0.0001, activeNode.mass);
        const invMassB = nodeB.isFixed ? 0 : 1 / Math.max(0.0001, nodeB.mass);
        const invMassSum = invMassA + invMassB;
        if (invMassSum <= 0) return;

        const C = dist - minDist;
        const denom = invMassSum + baseCompliance / dtSq;
        if (denom <= 0) return;

        const lambda = -C / denom;
        const nx = dx / dist;
        const ny = dy / dist;

        const corrA = lambda * invMassA;
        const corrB = lambda * invMassB;

        if (!activeNode.isFixed) {
            activeNode.x -= nx * corrA;
            activeNode.y -= ny * corrA;
        }
        if (!nodeB.isFixed) {
            nodeB.x += nx * corrB;
            nodeB.y += ny * corrB;
        }

        const pairCorrection = Math.abs(lambda) * invMassSum;
        stats.xpbdRepelCorrSum += pairCorrection;
        if (pairCorrection > stats.xpbdRepelCorrMax) stats.xpbdRepelCorrMax = pairCorrection;
        stats.xpbdRepelPairs += 1;
    };

    for (let iter = 0; iter < iterations; iter++) {
        for (let i = 0; i < nodeCount; i++) {
            activeNode = nodeList[i];
            activeIndex = i;
            grid.query(activeNode.x, activeNode.y, visitNeighbor);
        }
    }
};
