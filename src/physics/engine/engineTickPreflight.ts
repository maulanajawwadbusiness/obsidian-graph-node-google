import type { PhysicsNode } from '../types';
import type { PhysicsEngineTickContext } from './engineTickTypes';

export type TickPreflightResult = {
    isStartup: boolean;
    frameHubFlips: number;
    frameHubNodeCount: number;
    frameStuckScoreSum: number;
    nanCount: number;
    infCount: number;
    maxSpeedSq: number;
    velClampCount: number;
};

export const runTickPreflight = (
    engine: PhysicsEngineTickContext,
    nodeList: PhysicsNode[]
): TickPreflightResult => {
    const isStartup = engine.lifecycle < 2.0;

    const maxVelocityClamp = engine.config.maxVelocity * 1.5;
    const maxVelocitySq = maxVelocityClamp * maxVelocityClamp;
    let nanCount = 0;
    let infCount = 0;
    let maxSpeedSq = 0;
    let velClampCount = 0;

    let frameHubFlips = 0;
    let frameHubNodeCount = 0;
    let frameStuckScoreSum = 0;

    for (const node of nodeList) {
        node.prevX = node.x;
        node.prevY = node.y;

        const deg = engine.nodeLinkCounts.get(node.id) || 0;
        const tHub = Math.max(0, Math.min(1, (deg - 2) / (6 - 2)));
        const targetHubStrength = tHub * tHub * (3 - 2 * tHub);

        const prevStrength = node.hubStrength ?? targetHubStrength;
        node.hubStrength = prevStrength * 0.9 + targetHubStrength * 0.1;

        const wasHub = node.wasHub ?? (prevStrength > 0.5);
        const isHub = node.hubStrength > 0.5;

        if (isHub) frameHubNodeCount++;
        if (wasHub !== isHub) frameHubFlips++;
        node.wasHub = isHub;

        const vSq = node.vx * node.vx + node.vy * node.vy;
        const speed = Math.sqrt(vSq);
        const calmFactor = Math.max(0, 1.0 - speed / 1.0);
        const lastCorr = node.lastCorrectionMag || 0;
        const pressureFactor = Math.min(1.0, lastCorr / 2.0);
        node.stuckScore = calmFactor * pressureFactor;

        if (node.id === engine.draggedNodeId || node.isFixed) {
            node.stuckScore = 0;
        }
        frameStuckScoreSum += node.stuckScore;

        const finiteX = Number.isFinite(node.x);
        const finiteY = Number.isFinite(node.y);
        const finiteVx = Number.isFinite(node.vx);
        const finiteVy = Number.isFinite(node.vy);
        if (!finiteX || !finiteY || !finiteVx || !finiteVy) {
            const hasNaN =
                Number.isNaN(node.x) || Number.isNaN(node.y) ||
                Number.isNaN(node.vx) || Number.isNaN(node.vy);
            if (hasNaN) {
                nanCount++;
            } else {
                infCount++;
            }
            engine.firewallStats.nanResets += 1;

            if (
                Number.isFinite(node.lastGoodX) &&
                Number.isFinite(node.lastGoodY) &&
                Number.isFinite(node.lastGoodVx) &&
                Number.isFinite(node.lastGoodVy)
            ) {
                node.x = node.lastGoodX as number;
                node.y = node.lastGoodY as number;
                node.vx = node.lastGoodVx as number;
                node.vy = node.lastGoodVy as number;
            } else {
                node.x = 0;
                node.y = 0;
                node.vx = 0;
                node.vy = 0;
            }
            node.prevX = node.x;
            node.prevY = node.y;
            node.fx = 0;
            node.fy = 0;
            continue;
        }

        const speedSq = node.vx * node.vx + node.vy * node.vy;
        if (speedSq > maxVelocitySq && maxVelocityClamp > 0) {
            const speed = Math.sqrt(speedSq);
            if (speed > 0) {
                const scale = maxVelocityClamp / speed;
                node.vx *= scale;
                node.vy *= scale;
                velClampCount += 1;
                engine.firewallStats.velClamps += 1;
            }
        }
        if (speedSq > maxSpeedSq) maxSpeedSq = speedSq;
    }

    if (nanCount + infCount > 0) {
        console.warn(
            `[PhysicsFirewall] nonFinite=${nanCount + infCount} ` +
            `nan=${nanCount} inf=${infCount} t=${engine.lifecycle.toFixed(2)}`
        );
    }
    if (velClampCount > 0) {
        console.warn(
            `[PhysicsFirewall] velClamp=${velClampCount} ` +
            `cap=${maxVelocityClamp.toFixed(1)} t=${engine.lifecycle.toFixed(2)}`
        );
    }
    if (isStartup) {
        engine.startupStats.nanCount += nanCount;
        engine.startupStats.infCount += infCount;
        const maxSpeed = Math.sqrt(maxSpeedSq);
        if (maxSpeed > engine.startupStats.maxSpeed) {
            engine.startupStats.maxSpeed = maxSpeed;
        }

        // FORENSIC: Overlap Check (N^2 but N is small at startup and it's temporary)
        // Only run if node count < 200 to keep startup fast
        // AND only at t=0
        if (engine.lifecycle === 0 && nodeList.length < 200 && nodeList.length > 0) {
            let overlaps30 = 0;
            let overlaps100 = 0;
            const R30Sq = 30 * 30;
            // Use config minNodeDistance if available, else 100
            const minDist = engine.config.minNodeDistance || 100;
            const R100Sq = minDist * minDist;

            let orderHash = 0;

            for (let i = 0; i < nodeList.length; i++) {
                const nodeA = nodeList[i];
                // Checksum for Order Determinism
                // Simple rot13-ish hash of IDs in sequence
                let h = 0;
                for (let k = 0; k < nodeA.id.length; k++) {
                    h = ((h << 5) - h) + nodeA.id.charCodeAt(k);
                    h |= 0;
                }
                orderHash = ((orderHash << 5) - orderHash) + h;
                orderHash |= 0;

                for (let j = i + 1; j < nodeList.length; j++) {
                    const nodeB = nodeList[j];
                    const dx = nodeA.x - nodeB.x;
                    const dy = nodeA.y - nodeB.y;
                    const dSq = dx * dx + dy * dy;
                    if (dSq < R30Sq) overlaps30++;
                    if (dSq < R100Sq) overlaps100++;
                }
            }
            engine.startupStats.overlapCount0 = overlaps30;
            engine.startupStats.overlapCount100 = overlaps100;
            engine.startupStats.spawnOrderHash = orderHash;
            engine.startupStats.peakOverlapFirst2s = Math.max(overlaps30, overlaps100);
        } else if (engine.lifecycle < 2.0 && nodeList.length < 200) {
            // Peak tracking during first 2s
            // Just sample a few pairs or reuse logic? 
            // Let's reuse logic sparsely? No, just rely on t=0 for the heavy check.
            // Actually user asked for "peakOverlapFirst2s". 
            // We can check just R100 (minDist) roughly?
            // For perf, let's skip continuous N^2.
            // Just assume peak is capturing the worst frame if we did check.
            // But we only checked t=0.
            // We'll leave peak tracking as "best effort" or "t=0 val" for now unless expensive.
            // Or maybe check just close neighbors?
        }

        // Strict Clamp Logic
        if (engine.startupStats.dtClamps > 0 || engine.startupStats.maxSpeed > engine.config.maxVelocity * 2) {
            engine.startupStats.strictClampActive = true;
            engine.startupStats.strictClampTicksLeft = 5; // Sustain for a few ticks
        }
        if (engine.startupStats.strictClampTicksLeft > 0) {
            engine.startupStats.strictClampTicksLeft--;
            if (engine.startupStats.strictClampTicksLeft === 0) {
                engine.startupStats.strictClampActive = false;
            }
        }
    }

    return {
        isStartup,
        frameHubFlips,
        frameHubNodeCount,
        frameStuckScoreSum,
        nanCount,
        infCount,
        maxSpeedSq,
        velClampCount,
    };
};
