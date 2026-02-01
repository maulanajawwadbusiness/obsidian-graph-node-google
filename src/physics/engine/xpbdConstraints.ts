import type { PhysicsEngine } from '../engine';
import type { PhysicsNode } from '../types';
import type { DebugStats } from './stats';
import { getPassStats } from './stats';
import type { XpbdSpatialHash } from './xpbdSpatialHash';

export const applyXpbdLinkSprings = (
    engine: PhysicsEngine,
    nodeList: PhysicsNode[],
    dt: number,
    stats: DebugStats
) => {
    const passStats = getPassStats(stats, 'XpbdSprings');
    const baseCompliance = engine.config.xpbdSpringCompliance;
    const baseIterations = engine.config.xpbdSpringIterations;
    const forceStiff = engine.config.debugForceStiffSprings === true;
    const iterations = forceStiff ? Math.max(baseIterations, 6) : baseIterations;
    const compliance = forceStiff ? Math.min(baseCompliance, 0.000001) : baseCompliance;

    let springCorrectionSum = 0;
    let springCorrectionMax = 0;
    let springConstraintCount = 0;

    const links = engine.links;
    const linkCount = links.length;
    if (linkCount === 0) return;

    for (const link of links) {
        link.xpbdLambda = 0;
    }

    const alphaBase = compliance > 0 ? compliance / (dt * dt) : 0;
    const targetLenBase = engine.config.linkRestLength;

    for (let iter = 0; iter < iterations; iter++) {
        for (let i = 0; i < linkCount; i++) {
            const link = links[i];
            const source = engine.nodes.get(link.source);
            const target = engine.nodes.get(link.target);
            if (!source || !target) continue;
            if (source.isFixed && target.isFixed) continue;

            let dx = target.x - source.x;
            let dy = target.y - source.y;
            let distSq = dx * dx + dy * dy;
            if (distSq < 0.000001) {
                const rand = engine.pseudoRandom(source.id, target.id);
                const angle = rand * Math.PI * 2;
                dx = Math.cos(angle) * 0.01;
                dy = Math.sin(angle) * 0.01;
                distSq = dx * dx + dy * dy;
            }
            const dist = Math.sqrt(distSq);

            const restLength = (link.length ?? targetLenBase) * (link.lengthBias ?? 1);
            const constraint = dist - restLength;
            if (!Number.isFinite(constraint)) continue;

            const invMassA = source.isFixed ? 0 : 1 / Math.max(0.0001, source.mass || 1);
            const invMassB = target.isFixed ? 0 : 1 / Math.max(0.0001, target.mass || 1);
            const invMassSum = invMassA + invMassB;
            if (invMassSum === 0) continue;

            const stiffness = link.strength ?? engine.config.springStiffness;
            const complianceScaled = stiffness > 0 ? alphaBase / stiffness : alphaBase;
            const alpha = complianceScaled;
            const lambdaPrev = link.xpbdLambda || 0;
            const deltaLambda = (-constraint - alpha * lambdaPrev) / (invMassSum + alpha);
            link.xpbdLambda = lambdaPrev + deltaLambda;

            const nx = dx / dist;
            const ny = dy / dist;
            const corrX = nx * deltaLambda;
            const corrY = ny * deltaLambda;

            if (!source.isFixed) {
                source.x += corrX * invMassA;
                source.y += corrY * invMassA;
                if (source.prevX !== undefined) source.prevX += corrX * invMassA;
                if (source.prevY !== undefined) source.prevY += corrY * invMassA;
            }
            if (!target.isFixed) {
                target.x -= corrX * invMassB;
                target.y -= corrY * invMassB;
                if (target.prevX !== undefined) target.prevX -= corrX * invMassB;
                if (target.prevY !== undefined) target.prevY -= corrY * invMassB;
            }

            const corrMag = Math.abs(deltaLambda);
            springCorrectionSum += corrMag;
            springCorrectionMax = Math.max(springCorrectionMax, corrMag);
            springConstraintCount += 1;
            passStats.correction += corrMag;
        }
    }

    passStats.nodes += nodeList.length;
    stats.xpbd.springCorrectionSum += springCorrectionSum;
    stats.xpbd.springCorrectionMax = Math.max(stats.xpbd.springCorrectionMax, springCorrectionMax);
    stats.xpbd.springConstraintCount += springConstraintCount;
};

export const applyXpbdMinDistance = (
    engine: PhysicsEngine,
    nodeList: PhysicsNode[],
    dt: number,
    stats: DebugStats,
    spatialHash: XpbdSpatialHash
) => {
    const passStats = getPassStats(stats, 'XpbdRepulsion');
    const baseCompliance = engine.config.xpbdRepulsionCompliance;
    const baseIterations = engine.config.xpbdRepulsionIterations;
    const forceRepel = engine.config.debugForceRepulsion === true;
    const iterations = forceRepel ? Math.max(baseIterations, 2) : baseIterations;
    const compliance = forceRepel ? Math.min(baseCompliance, 0.000001) : baseCompliance;

    let repelCorrectionSum = 0;
    let repelCorrectionMax = 0;
    let repelPairCount = 0;
    let repelOverlapCount = 0;

    let maxRadius = 0;
    for (const node of nodeList) {
        if (node.radius > maxRadius) maxRadius = node.radius;
    }
    const padding = engine.config.collisionPadding;
    const maxMinDist = Math.max(1, maxRadius * 2 + padding);
    spatialHash.setCellSize(maxMinDist);
    spatialHash.clear();

    for (let i = 0; i < nodeList.length; i++) {
        const node = nodeList[i];
        spatialHash.add(node.x, node.y, i);
    }

    const alphaBase = compliance > 0 ? compliance / (dt * dt) : 0;
    let currentIndex = 0;

    const processNeighbor = (otherIndex: number) => {
        if (otherIndex <= currentIndex) return;
        const a = nodeList[currentIndex];
        const b = nodeList[otherIndex];
        if (!a || !b) return;
        if (a.isFixed && b.isFixed) return;

        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let distSq = dx * dx + dy * dy;
        if (distSq < 0.000001) {
            const rand = engine.pseudoRandom(a.id, b.id);
            const angle = rand * Math.PI * 2;
            dx = Math.cos(angle) * 0.01;
            dy = Math.sin(angle) * 0.01;
            distSq = dx * dx + dy * dy;
        }
        const dist = Math.sqrt(distSq);

        const minDist = a.radius + b.radius + padding;
        if (dist >= minDist) return;

        if (dist < minDist * 0.5) {
            repelOverlapCount += 1;
        }

        const invMassA = a.isFixed ? 0 : 1 / Math.max(0.0001, a.mass || 1);
        const invMassB = b.isFixed ? 0 : 1 / Math.max(0.0001, b.mass || 1);
        const invMassSum = invMassA + invMassB;
        if (invMassSum === 0) return;

        const constraint = minDist - dist;
        const correctionMag = constraint / (invMassSum + alphaBase);
        const nx = dx / dist;
        const ny = dy / dist;
        const corrX = nx * correctionMag;
        const corrY = ny * correctionMag;

        if (!a.isFixed) {
            a.x -= corrX * invMassA;
            a.y -= corrY * invMassA;
            if (a.prevX !== undefined) a.prevX -= corrX * invMassA;
            if (a.prevY !== undefined) a.prevY -= corrY * invMassA;
        }
        if (!b.isFixed) {
            b.x += corrX * invMassB;
            b.y += corrY * invMassB;
            if (b.prevX !== undefined) b.prevX += corrX * invMassB;
            if (b.prevY !== undefined) b.prevY += corrY * invMassB;
        }

        repelCorrectionSum += correctionMag;
        repelCorrectionMax = Math.max(repelCorrectionMax, correctionMag);
        repelPairCount += 1;
        passStats.correction += correctionMag;
    };

    for (let iter = 0; iter < iterations; iter++) {
        for (let i = 0; i < nodeList.length; i++) {
            currentIndex = i;
            const node = nodeList[i];
            spatialHash.query(node.x, node.y, processNeighbor);
        }
    }

    passStats.nodes += nodeList.length;
    stats.xpbd.repelCorrectionSum += repelCorrectionSum;
    stats.xpbd.repelCorrectionMax = Math.max(stats.xpbd.repelCorrectionMax, repelCorrectionMax);
    stats.xpbd.repelPairCount += repelPairCount;
    stats.xpbd.repelOverlapCount += repelOverlapCount;
};
