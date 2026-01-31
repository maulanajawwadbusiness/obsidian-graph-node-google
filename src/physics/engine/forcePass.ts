import type { PhysicsEngine } from '../engine';
import type { PhysicsNode } from '../types';
import { applyRepulsion, applySprings, applyBoundaryForce, applyCollision } from '../forces';
import { getPassStats, type DebugStats } from './stats';
import { pseudoRandom } from './random';

export const applyForcePass = (
    engine: PhysicsEngine,
    nodeList: PhysicsNode[],
    activeNodes: PhysicsNode[],
    sleepingNodes: PhysicsNode[],
    forceScale: number,
    _dt: number,
    stats: DebugStats,
    preRollActive: boolean,
    energy?: number,
    frameIndex?: number,
    timing?: { repulsionMs: number; collisionMs: number; springsMs: number },
    nowFn?: () => number,
    pairStride: number = 1,
    pairOffset: number = 0,
    repulsionEnabled: boolean = true,
    collisionEnabled: boolean = true,
    springsEnabled: boolean = true,
    focusActive?: PhysicsNode[],
    focusSleeping?: PhysicsNode[],
    focusRepulsionEnabled: boolean = false,
    focusCollisionEnabled: boolean = false,
    focusPairStride: number = 1,
    focusPairOffset: number = 0
) => {
    const now =
        nowFn ??
        (() => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now()));

    // 1. Clear forces
    for (const node of nodeList) {
        node.fx = 0;
        node.fy = 0;
    }

    if (preRollActive) {
        // PRE-ROLL: apply topology-softened springs and symmetry breaking only
        const preRollDegree = new Map<string, number>();
        engine.nodes.forEach(n => preRollDegree.set(n.id, 0));
        for (const link of engine.links) {
            preRollDegree.set(link.source, (preRollDegree.get(link.source) || 0) + 1);
            preRollDegree.set(link.target, (preRollDegree.get(link.target) || 0) + 1);
        }

        // Pre-roll fade: topology forces ramp from 0 → 1 as pre-roll ends
        // At frame 5: fade = 0, at frame 0: fade = 1
        const topologyFade = 1 - (engine.preRollFrames / 5);

        // Apply springs with HUB TOPOLOGY SCALING
        // Hubs (degree >= 3) get much weaker springs during pre-roll
        const { springStiffness } = engine.config;
        for (const link of engine.links) {
            const source = engine.nodes.get(link.source);
            const target = engine.nodes.get(link.target);
            if (!source || !target) continue;

            let dx = target.x - source.x;
            let dy = target.y - source.y;
            if (dx === 0 && dy === 0) {
                // DETERMINISTIC SINGULARITY GUARD
                // Use listIndex if available, else id length
                const sIdx = source.listIndex || source.id.length;
                const tIdx = target.listIndex || target.id.length;
                const seed = (frameIndex || 0) * 1000 + sIdx * 37 + tIdx;

                dx = (pseudoRandom(seed) - 0.5) * 0.1;
                dy = (pseudoRandom(seed + 1) - 0.5) * 0.1;
            }
            const d = Math.sqrt(dx * dx + dy * dy);
            const restLength = engine.config.linkRestLength;
            const displacement = d - restLength;

            const baseK = link.strength ?? springStiffness;
            const forceMagnitude = baseK * displacement * 0.1;  // Base 10% during pre-roll

            const fx = (dx / d) * forceMagnitude;
            const fy = (dy / d) * forceMagnitude;

            // Hub scaling: degree >= 3 gets 25% of spring force, fading back to 100%
            // Hub scaling: Continuous blend based on hubStrength
            // degree >= 3 equivalent logic: hubStrength > ~0.15
            // Target: Linear blend from 1.0 down to (0.25 + ...) as strength goes 0 -> 1
            const sourceHubStr = source.hubStrength || 0;
            const targetHubStr = target.hubStrength || 0;

            const minScale = 0.25 + 0.75 * topologyFade;
            // lerp(1.0, minScale, strength)
            const sourceHubScale = 1.0 + (minScale - 1.0) * sourceHubStr;
            const targetHubScale = 1.0 + (minScale - 1.0) * targetHubStr;

            if (!source.isFixed) {
                source.fx += fx * sourceHubScale;
                source.fy += fy * sourceHubScale;
            }
            if (!target.isFixed) {
                target.fx -= fx * targetHubScale;
                target.fy -= fy * targetHubScale;
            }
        }

        // NULL-FORCE SYMMETRY BREAKING (individual + cluster-level)
        // When hub nodes have near-zero net force, add tiny deterministic bias
        // Prevents starfish/brick eigenmodes from symmetric force cancellation
        const epsilon = 0.5;  // Near-zero threshold
        const biasStrength = 0.3;  // ~1% of typical spring force
        const clusterBiasStrength = 0.5;  // Stronger for deep clusters

        // Build neighbor map for cluster detection
        const neighborMap = new Map<string, string[]>();
        for (const node of nodeList) {
            neighborMap.set(node.id, []);
        }
        for (const link of engine.links) {
            neighborMap.get(link.source)?.push(link.target);
            neighborMap.get(link.target)?.push(link.source);
        }

        // Precompute which nodes are in "null-force" state
        const isNullForce = new Map<string, boolean>();
        for (const node of nodeList) {
            // hubStrength > 0.15 corresponds approx to degree >= 3
            // We use the continuous metric heavily smoothed in engineTick
            const isHub = (node.hubStrength || 0) > 0.15;
            const fMag = Math.sqrt(node.fx * node.fx + node.fy * node.fy);
            isNullForce.set(node.id, isHub && fMag < epsilon);
        }

        for (const node of nodeList) {
            if (node.isFixed) continue;

            if ((node.hubStrength || 0) < 0.15) continue;  // Only hubs

            const fMag = Math.sqrt(node.fx * node.fx + node.fy * node.fy);
            if (fMag >= epsilon) continue;  // Has meaningful force, no bias needed

            // Check if neighbors are ALSO in null-force state (cluster detection)
            const neighbors = neighborMap.get(node.id) || [];
            let nullNeighborCount = 0;
            let clusterCx = 0, clusterCy = 0;

            for (const nbId of neighbors) {
                if (isNullForce.get(nbId)) {
                    const nb = engine.nodes.get(nbId);
                    if (nb) {
                        nullNeighborCount++;
                        clusterCx += nb.x;
                        clusterCy += nb.y;
                    }
                }
            }

            if (nullNeighborCount > 0) {
                // CLUSTER-LEVEL BIAS: push away from null-force neighbor centroid
                clusterCx /= nullNeighborCount;
                clusterCy /= nullNeighborCount;

                let dx = node.x - clusterCx;
                let dy = node.y - clusterCy;
                const d = Math.sqrt(dx * dx + dy * dy);

                if (d > 0.1) {
                    // Push away from cluster centroid
                    node.fx += (dx / d) * clusterBiasStrength;
                    node.fy += (dy / d) * clusterBiasStrength;
                }

                // Mark this node for ESCAPE WINDOW (skip constraints for next 6 frames)
                engine.escapeWindow.set(node.id, 6);
            } else {
                // Individual bias (original behavior)
                let hash = 0;
                for (let i = 0; i < node.id.length; i++) {
                    hash = ((hash << 5) - hash) + node.id.charCodeAt(i);
                    hash |= 0;
                }
                const angle = (hash % 1000) / 1000 * 2 * Math.PI;
                node.fx += Math.cos(angle) * biasStrength;
                node.fy += Math.sin(angle) * biasStrength;
            }
        }
    } else {
        // 2. Apply Core Forces (scaled by energy)
        if (timing) {
            const repulsionStart = now();
            if (repulsionEnabled) {
                applyRepulsion(nodeList, activeNodes, sleepingNodes, engine.config, stats, energy, pairStride, pairOffset, engine.neighborCache);
                timing.repulsionMs += now() - repulsionStart;
            }

            const collisionStart = now();
            if (collisionEnabled) {
                applyCollision(nodeList, activeNodes, sleepingNodes, engine.config, 1.0, pairStride, pairOffset + 1);
                timing.collisionMs += now() - collisionStart;
            }

            if (focusActive && focusSleeping) {
                const focusStart = now();
                if (focusRepulsionEnabled) {
                    applyRepulsion(nodeList, focusActive, focusSleeping, engine.config, stats, energy, focusPairStride, focusPairOffset);
                }
                if (focusCollisionEnabled) {
                    applyCollision(nodeList, focusActive, focusSleeping, engine.config, 1.0, focusPairStride, focusPairOffset + 1);
                }
                timing.collisionMs += now() - focusStart;
            }

            if (springsEnabled) {
                const springsStart = now();
                applySprings(engine.nodes, engine.links, engine.config, 1.0, forceScale, frameIndex || 0);
                timing.springsMs += now() - springsStart;
            }
        } else {
            if (repulsionEnabled) {
                applyRepulsion(nodeList, activeNodes, sleepingNodes, engine.config, stats, energy, pairStride, pairOffset, engine.neighborCache);
            }
            if (collisionEnabled) {
                applyCollision(nodeList, activeNodes, sleepingNodes, engine.config, 1.0, pairStride, pairOffset + 1);
            }
            if (focusActive && focusSleeping) {
                if (focusRepulsionEnabled) {
                    applyRepulsion(nodeList, focusActive, focusSleeping, engine.config, stats, energy, focusPairStride, focusPairOffset);
                }
                if (focusCollisionEnabled) {
                    applyCollision(nodeList, focusActive, focusSleeping, engine.config, 1.0, focusPairStride, focusPairOffset + 1);
                }
            }
            if (springsEnabled) {
                applySprings(engine.nodes, engine.links, engine.config, 1.0, forceScale, frameIndex || 0);
            }
        }
        applyBoundaryForce(nodeList, engine.config, engine.worldWidth, engine.worldHeight);

        // Scale all forces by energy envelope
        for (const node of nodeList) {
            node.fx *= forceScale;
            node.fy *= forceScale;
        }
    }

    // 3. Apply Mouse Drag Force (NOT scaled - cursor always wins)
    if (engine.draggedNodeId && engine.dragTarget) {
        const node = engine.nodes.get(engine.draggedNodeId);
        if (node) {
            const dx = engine.dragTarget.x - node.x;
            const dy = engine.dragTarget.y - node.y;
            const dragStrength = 200.0;
            node.fx += dx * dragStrength;
            node.fy += dy * dragStrength;
        }
    }

    const passStats = getPassStats(stats, 'ForcePass');
    const affected = new Set<string>();
    for (const node of nodeList) {
        const fMag = Math.sqrt(node.fx * node.fx + node.fy * node.fy);
        if (fMag > 0) {
            passStats.force += fMag;
            affected.add(node.id);
        }
    }
    passStats.nodes += affected.size;
};
