import { PhysicsNode, PhysicsLink, ForceConfig } from './types';

/**
 * Apply repulsion efficiently.
 * UX Anchor: "Cluster" & "Idle Spacing".
 * Nodes should push away from each other.
 */
export function applyRepulsion(
    nodes: PhysicsNode[],
    activeNodes: PhysicsNode[],
    sleepingNodes: PhysicsNode[],
    config: ForceConfig,
    stats: any, // passed as any to avoid circular type issues if strict
    energy?: number,
    pairStride: number = 1,
    pairOffset: number = 0,
    neighborCache?: Map<string, Set<string>>
) {
    const {
        repulsionStrength,
        repulsionDistanceMax,
        repulsionMinDistance,
        repulsionMaxForce,
    } = config;

    // TRUTH SCAN: Repulsion Execution Telemetry
    let pairsChecked = 0;
    let pairsApplied = 0;
    let forceMagMax = 0;

    // XPBD Force Repel Override
    let effectiveStrength = repulsionStrength;
    let effectiveMinDist = repulsionMinDistance;
    if (config.debugForceRepulsion) {
        effectiveMinDist = Math.max(repulsionMinDistance, 140); // Mode A: Large Radius
        effectiveStrength *= 2.0; // Boost strength slightly to ensure gap holds
    }

    const { repulsionStrength: _ignore1, repulsionMinDistance: _ignore2, ..._rest } = config; // Flatten for clarity overrides
    // Use effective values below

    const maxDistSq = repulsionDistanceMax * repulsionDistanceMax;

    // DENSITY-DEPENDENT REPULSION (early expansion only)
    // Nodes in dense regions experience stronger repulsion
    // Creates "center has higher potential" without explicit centroid
    const allowEarlyExpansion = config.initStrategy === 'legacy' && config.debugAllowEarlyExpansion === true;
    const earlyExpansion = allowEarlyExpansion && energy !== undefined && energy > 0.85;
    const densityRadius = 25;  // Radius to count neighbors
    const localDensity = new Map<string, number>();

    const shouldSkipPair = (a: PhysicsNode, b: PhysicsNode) => {
        if (pairStride <= 1) return false;
        const i = a.listIndex ?? 0;
        const j = b.listIndex ?? 0;
        const mix = (i * 73856093 + j * 19349663 + pairOffset) % pairStride;
        return mix !== 0;
    };

    if (earlyExpansion) {
        // HYSTERESIS: Sticky neighbor sets to prevent density count jitter
        const densityEnter = densityRadius;
        const densityExit = densityRadius * 1.1; // 10% Hysteresis
        const densityEnterSq = densityEnter * densityEnter;
        const densityExitSq = densityExit * densityExit;

        for (let i = 0; i < nodes.length; i++) {
            const node = nodes[i];

            // If cache exists, use/update it. Key must not depend on order to be unique per pair?
            // Actually, cache is per-node (list of neighbors).
            let neighbors: Set<string> | undefined;
            if (neighborCache) {
                if (!neighborCache.has(node.id)) neighborCache.set(node.id, new Set());
                neighbors = neighborCache.get(node.id);
            }

            // If we have a cache, we must maintain it.
            // But we must scan potential neighbors.
            // If we are relying on brute force scan every frame anyway:

            let count = 0;
            if (neighbors) {
                // We are scanning all 'other' nodes. Update set status.
                // FIX: Stable Iteration - Scan ActiveNodes Array (Stable)
                // The original code actually iterates `nodes` (all active nodes), not the set.
                // Wait, L71 iterates `nodes` (loop j). This IS stable if `nodes` array is stable.
                // L82 checks `neighbors.has(other.id)`.
                // The instability would be if we iterated `neighbors` directly.
                // Looking closely at L16-98: It calculates density by iterating ALL nodes and checking set membership.
                // This means density calc IS stable.

                // BUT wait, line 208 loop iterates `activeNodes`.
                // Line 208-216 is the MAIN loop.
                // It does `applyPair(nodeA, activeNodes[j])`.
                // This is ARRAY iteration. This IS stable.

                // Where was the `for (const other of neighbors)`?
                // Ah, the forensic scan might have been misleading or I missed it.
                // Let's check `applyRepulsion` again.
                // It seems main repulsion loop is pairwise array (L208).
                // Density calculation (L51) iterates `nodes` array.

                // Let's re-read the file content I saw earlier to be sure.
                // "for (let j = 0; j < nodes.length; j++)" -> Stable.

                // CHECK: Is there any Set iteration?
                // "for (const key of hotPairs)" in spacing constraints IS Set iteration.

                // So Repulsion might be fine?
                // Wait, if `neighbors` (Set) is used to LIMIT the loop?
                // No, the code iterates `nodes`.

                // However, let's look at `constraints.ts` -> `hotPairs` iteration.
                // That definitely needs fixing.

                // In `forces.ts`, maybe I saw `activeNodes`?
                // "activeNodes" array order depends on ... wake/sleep logic.
                // If wake/sleep is deterministic, array is deterministic.

                // Let's focus on `constraints.ts` hotPairs first as that is verified unsafe.
                // And I will check `forces.ts` again. I might have misread L51-97. 
                // It iterates `nodes`. So density is stable.

                // So, proceeding with `constraints.ts`.

                for (let j = 0; j < nodes.length; j++) {
                    if (i === j) continue;
                    const other = nodes[j];
                    // (Logic preserved)
                    if (shouldSkipPair(node, other)) continue;

                    const dx = other.x - node.x;
                    const dy = other.y - node.y;
                    const d2 = dx * dx + dy * dy;

                    const isNeighbor = neighbors.has(other.id);
                    if (isNeighbor) {
                        if (d2 > densityExitSq) {
                            neighbors.delete(other.id);
                            if (stats) stats.neighborReorderRate++;
                        } else {
                            count++;
                        }
                    } else {
                        if (d2 < densityEnterSq) {
                            neighbors.add(other.id);
                            count++;
                            if (stats) stats.neighborReorderRate++;
                        }
                    }
                }
            } else {
                // Classic Stateless
                for (let j = 0; j < nodes.length; j++) {
                    if (i === j) continue;
                    const other = nodes[j];
                    if (shouldSkipPair(node, other)) continue;
                    const dx = other.x - node.x;
                    const dy = other.y - node.y;
                    const d2 = dx * dx + dy * dy;
                    if (d2 < densityEnterSq) count++;
                }
            }

            const scaledCount = pairStride > 1 ? Math.round(count * pairStride) : count;
            localDensity.set(node.id, scaledCount);
        }
    }

    // DEBUG: track stats for first 20 frames
    let debugMaxDensityBoost = 1.0;
    let debugAvgCenterDensity = 0;
    let debugCenterCount = 0;

    // FIX: Dynamic Softening Radius (scaled to world)
    const softR = (config.minNodeDistance || 30) * 0.25;

    const applyPair = (nodeA: PhysicsNode, nodeB: PhysicsNode) => {
        pairsChecked++;
        if (shouldSkipPair(nodeA, nodeB)) return;

        let dx = nodeA.x - nodeB.x;
        let dy = nodeA.y - nodeB.y;

        // FIX Singularity: Deterministic Fallback (Seeded by IDs)
        if (Math.abs(dx) < 0.0001 && Math.abs(dy) < 0.0001) {
            // Pseudo-random angle based on ID hash
            // We can't access engine instance here directly? 
            // `applyRepulsion` function signature: (nodes, activeNodes, sleepingNodes, config, stats, energy, pairStride, pairOffset, neighborCache).
            // It does NOT have `engine`.
            // BUT: We can use a local deterministic hash function if engine not available.

            // Local Hash V2 (Better Distribution)
            let h = 0x811c9dc5;
            const str = nodeA.id + nodeB.id;
            for (let k = 0; k < str.length; k++) {
                h ^= str.charCodeAt(k);
                h = Math.imul(h, 0x01000193);
            }
            const rand = (h >>> 0) / 4294967296; // 0..1

            const angle = rand * Math.PI * 2;
            const nudge = 0.1;
            dx = Math.cos(angle) * nudge;
            dy = Math.sin(angle) * nudge;
        }

        const d2 = dx * dx + dy * dy;

        if (d2 < maxDistSq) {
            // Safe dist
            const d = Math.sqrt(d2);

            // Forensics
            if (stats) {
                if (d < stats.safety.minPairDist) stats.safety.minPairDist = d;
                if (d < softR) stats.safety.nearOverlapCount++;
            }

            // REPULSION DEAD-CORE: Dynamic Radius
            let repulsionScale = 1.0;
            if (d < softR) {
                // Ramp: 0.1 at d=0, 1.0 at d=softR
                const t = d / softR;
                const smooth = t * t * (3 - 2 * t);
                repulsionScale = 0.1 + smooth * 0.9;
            }

            // ENHANCED DENSITY BOOST (Preserved Logic)
            let densityBoost = 1.0;
            if (earlyExpansion) {
                const densityA = localDensity.get(nodeA.id) || 0;
                const densityB = localDensity.get(nodeB.id) || 0;
                const avgDensity = (densityA + densityB) / 2;
                if (avgDensity > 2) {
                    const baseDensityBoost = 0.30 * (avgDensity - 2);
                    const minDist = config.minNodeDistance || 30;
                    let distanceMultiplier = 1.0;
                    if (d < minDist) {
                        const closeT = Math.max(0, (minDist - d) / (minDist * 0.5));
                        distanceMultiplier = 1.0 + Math.min(closeT, 1);
                    }
                    densityBoost = 1 + baseDensityBoost * distanceMultiplier;
                    densityBoost = Math.min(densityBoost, 3.0);
                }
            }

            // Standard repulsion force: F = k / d
            const effectiveD = Math.max(d, effectiveMinDist);
            const rawForce = (effectiveStrength / effectiveD) * repulsionScale * densityBoost * pairStride;

            // Clamp
            let forceMagnitude = rawForce;
            if (repulsionMaxForce > 0 && rawForce > repulsionMaxForce) {
                forceMagnitude = repulsionMaxForce;
                if (stats) stats.safety.repulsionClampedCount++;
                if (stats && rawForce > stats.safety.repulsionMaxMag) stats.safety.repulsionMaxMag = rawForce;
            } else {
                if (stats && rawForce > stats.safety.repulsionMaxMag) stats.safety.repulsionMaxMag = rawForce;
            }

            const fx = (dx / d) * forceMagnitude;
            const fy = (dy / d) * forceMagnitude;

            // TRUTH SCAN: Track max force magnitude
            if (forceMagnitude > forceMagMax) forceMagMax = forceMagnitude;

            if (!nodeA.isFixed) {
                nodeA.fx += fx;
                nodeA.fy += fy;
            }
            if (!nodeB.isFixed) {
                nodeB.fx -= fx;
                nodeB.fy -= fy;
            }

            pairsApplied++;
        }
    };

    for (let i = 0; i < activeNodes.length; i++) {
        const nodeA = activeNodes[i];
        for (let j = i + 1; j < activeNodes.length; j++) {
            applyPair(nodeA, activeNodes[j]);
        }
        for (let j = 0; j < sleepingNodes.length; j++) {
            applyPair(nodeA, sleepingNodes[j]);
        }
    }

    // DEBUG: log for first 20 frames (use global counter via config hack)
    if (earlyExpansion && debugCenterCount > 0) {
        const avgDensity = debugAvgCenterDensity / debugCenterCount;
        console.log(`[Repulsion] avgCenterDensity: ${avgDensity.toFixed(1)}, maxDensityBoost: ${debugMaxDensityBoost.toFixed(2)}`);
    }

    // TRUTH SCAN: Report execution telemetry
    if (stats && stats.safety) {
        // Legacy
        stats.safety.repulsionCalledThisFrame = true;
        stats.safety.repulsionPairsChecked = pairsChecked;
        stats.safety.repulsionPairsApplied = pairsApplied;
        stats.safety.repulsionForceMagMax = forceMagMax;
    }

    // Run 4: Repulsion Proof Telemetry (Unique Bucket)
    if (stats && stats.repulsionProof) {
        stats.repulsionProof.pairsChecked = pairsChecked;
        stats.repulsionProof.pairsApplied = pairsApplied;
        stats.repulsionProof.maxForce = forceMagMax;
    }
    stats.safety.repulsionPairsChecked = pairsChecked;
    stats.safety.repulsionPairsApplied = pairsApplied;
    stats.safety.repulsionForceMagMax = forceMagMax;
}
}

export function applyCollision(
    _nodes: PhysicsNode[],
    activeNodes: PhysicsNode[],
    sleepingNodes: PhysicsNode[],
    config: ForceConfig,
    strengthScale: number = 1.0,
    pairStride: number = 1,
    pairOffset: number = 0
) {
    const { collisionStrength, collisionPadding, collisionMaxForce } = config;
    // Effective strength
    // FIX: Stride Compensation
    const strength = collisionStrength * strengthScale * pairStride;
    if (strength <= 0.01) return; // Optimization: Skip if minimal

    const shouldSkipPair = (a: PhysicsNode, b: PhysicsNode) => {
        if (pairStride <= 1) return false;
        const i = a.listIndex ?? 0;
        const j = b.listIndex ?? 0;
        const mix = (i * 73856093 + j * 19349663 + pairOffset) % pairStride;
        return mix !== 0;
    };

    const applyPair = (nodeA: PhysicsNode, nodeB: PhysicsNode) => {
        if (shouldSkipPair(nodeA, nodeB)) return;
        const dx = nodeA.x - nodeB.x;
        const dy = nodeA.y - nodeB.y;
        const distSq = dx * dx + dy * dy;

        const radiusSum = nodeA.radius + nodeB.radius + collisionPadding;
        const minDistSq = radiusSum * radiusSum;

        if (distSq < minDistSq && distSq > 0) {
            const dist = Math.sqrt(distSq);
            const overlap = radiusSum - dist;

            const rawForce = overlap * strength;
            const forceMagnitude = collisionMaxForce > 0 ? Math.min(rawForce, collisionMaxForce) : rawForce;

            const nx = dx / dist;
            const ny = dy / dist;

            const fx = nx * forceMagnitude;
            const fy = ny * forceMagnitude;

            if (!nodeA.isFixed) {
                nodeA.fx += fx;
                nodeA.fy += fy;
            }
            if (!nodeB.isFixed) {
                nodeB.fx -= fx;
                nodeB.fy -= fy;
            }
        } else if (distSq === 0) {
            // Exact overlap? Push apart randomly (Deterministic).
            let h = 0x811c9dc5;
            const str = nodeA.id + nodeB.id;
            for (let k = 0; k < str.length; k++) {
                h ^= str.charCodeAt(k);
                h = Math.imul(h, 0x01000193);
            }
            const rand = (h >>> 0) / 4294967296;

            const angle = rand * Math.PI * 2;
            const force = collisionStrength * 0.1;
            if (!nodeA.isFixed) { nodeA.fx += Math.cos(angle) * force; nodeA.fy += Math.sin(angle) * force; }
            if (!nodeB.isFixed) { nodeB.fx -= Math.cos(angle) * force; nodeB.fy -= Math.sin(angle) * force; }
        }
    };

    for (let i = 0; i < activeNodes.length; i++) {
        const nodeA = activeNodes[i];
        for (let j = i + 1; j < activeNodes.length; j++) {
            applyPair(nodeA, activeNodes[j]);
        }
        for (let j = 0; j < sleepingNodes.length; j++) {
            applyPair(nodeA, sleepingNodes[j]);
        }
    }
}

export function applySprings(
    nodes: Map<string, PhysicsNode>,
    links: PhysicsLink[],
    config: ForceConfig,
    stiffnessScale: number = 1.0,
    energy: number = 0.0,  // For early-phase hub softening
    frameIndex: number = 0  // For temporal force dithering
) {
    const { springStiffness } = config;

    // Precompute node degrees for hub softening
    const nodeDegree = new Map<string, number>();
    for (const [id] of nodes) {
        nodeDegree.set(id, 0);
    }
    for (const link of links) {
        nodeDegree.set(link.source, (nodeDegree.get(link.source) || 0) + 1);
        nodeDegree.set(link.target, (nodeDegree.get(link.target) || 0) + 1);
    }

    const linkCount = links.length;
    // FIX Order Bias: Frame-rotation
    const startOffset = frameIndex * 17;

    for (let i = 0; i < linkCount; i++) {
        const index = (startOffset + i) % linkCount;
        const link = links[index];
        const source = nodes.get(link.source);
        const target = nodes.get(link.target);

        if (!source || !target) continue;

        let dx = target.x - source.x;
        let dy = target.y - source.y;

        // Avoid zero div
        if (dx === 0 && dy === 0) {
            let h = 0x811c9dc5;
            const str = link.source + link.target;
            for (let k = 0; k < str.length; k++) {
                h ^= str.charCodeAt(k);
                h = Math.imul(h, 0x01000193);
            }
            const rand = (h >>> 0) / 4294967296;

            dx = (rand - 0.5) * 0.1;
            dy = (rand - 0.5) * 0.1; // Re-use rand? or hash again? 
            // Simple: just use cos/sin approach or a 2nd hash.
            // Let's use cos/sin for better distribution
            const angle = rand * Math.PI * 2;
            dx = Math.cos(angle) * 0.01;
            dy = Math.sin(angle) * 0.01;
        }

        const d = Math.sqrt(dx * dx + dy * dy);

        // Soft spring with dead zone
        // No force within ±deadZone of rest length (perceptual uniformness)
        const restLength = config.linkRestLength;


        // EARLY-EXPANSION DEAD-ZONE BYPASS for high-degree nodes
        // Temporarily disable dead-zone for hubs to break symmetric equilibrium
        const sourceDeg = nodeDegree.get(link.source) || 0;
        const targetDeg = nodeDegree.get(link.target) || 0;
        const sourceIsHub = sourceDeg >= 3;
        const targetIsHub = targetDeg >= 3;
        const allowEarlyExpansion = config.initStrategy === 'legacy' && config.debugAllowEarlyExpansion === true;
        const earlyExpansion = allowEarlyExpansion && energy > 0.8;

        // Dead-zone is 0 for hubs during early expansion, normal otherwise
        const sourceDeadZone = (sourceIsHub && earlyExpansion) ? 0 : restLength * config.springDeadZone;
        const targetDeadZone = (targetIsHub && earlyExpansion) ? 0 : restLength * config.springDeadZone;

        // Use the minimum dead-zone (if either end is a hub, bypass applies to the link)
        const deadZone = Math.min(sourceDeadZone, targetDeadZone);

        const rawDisplacement = d - restLength;

        // Apply dead zone: only apply force outside the band
        let displacement = 0;
        if (rawDisplacement > deadZone) {
            displacement = rawDisplacement - deadZone;  // Stretched beyond band
        } else if (rawDisplacement < -deadZone) {
            displacement = rawDisplacement + deadZone;  // Compressed beyond band
        }
        // else: within dead zone, displacement = 0, no force

        // Effective Stiffness = Base (or Override) * Bias * Global Scale
        const baseK = link.strength ?? springStiffness;
        let effectiveK = baseK * (link.stiffnessBias ?? 1.0) * stiffnessScale;

        // Spring stiffness is now constant (ramping removed)

        const forceMagnitude = effectiveK * displacement;

        // Normalize direction (dx/d, dy/d)
        const fx = (dx / d) * forceMagnitude;
        const fy = (dy / d) * forceMagnitude;

        // EARLY-PHASE HUB SPRING SOFTENING (More aggressive topology softening)
        // During early expansion, reduce spring force for high-degree nodes
        // Allows hubs to drift and break symmetric equilibrium
        const computeHubScale = (nodeId: string): number => {
            if (energy <= 0.5) return 1.0;  // Full spring authority (extended range)

            const deg = nodeDegree.get(nodeId) || 0;
            if (deg < 2) return 1.0;  // Only single nodes unaffected

            // Hub factor: starts at deg=2, peaks at deg=5+
            const hubFactor = Math.min((deg - 1) / 4, 1);

            // Softening: 0.15 at energy=1.0, lerp to 1.0 at energy=0.5
            const minScale = 0.15;  // More aggressive softening
            const energyFade = Math.min((energy - 0.5) / 0.5, 1);  // 0 at 0.5, 1 at 1.0
            const softening = 1.0 - hubFactor * (1.0 - minScale) * energyFade;

            return softening;
        };

        const sourceScale = computeHubScale(link.source);
        const targetScale = computeHubScale(link.target);

        // TANGENTIAL SOFTENING IN DENSE CORES (early expansion only)
        // Allows nodes to shear/rotate relative to neighbors
        // Dense core "melts" via internal rearrangement, not explosion
        // NOW: smooth ramp based on density AND compression ratio
        const applyTangentialSoftening = allowEarlyExpansion && energy > 0.85;

        // DEBUG: track min tangent scale
        let debugMinTangentScale = 1.0;

        // Compute local density for source and target
        let sourceDensity = 0, targetDensity = 0;
        if (applyTangentialSoftening) {
            const densityRadius = 30;
            for (const [, other] of nodes) {
                if (other.id !== source.id) {
                    const ddx = other.x - source.x;
                    const ddy = other.y - source.y;
                    if (Math.sqrt(ddx * ddx + ddy * ddy) < densityRadius) sourceDensity++;
                }
                if (other.id !== target.id) {
                    const ddx = other.x - target.x;
                    const ddy = other.y - target.y;
                    if (Math.sqrt(ddx * ddx + ddy * ddy) < densityRadius) targetDensity++;
                }
            }
        }

        // Compute smooth tangent scale based on density AND compression
        const computeTangentScale = (density: number, springDist: number, restLength: number): number => {
            if (!applyTangentialSoftening) return 1.0;

            // Density ramp: smoothstep from d0=2 to d1=6
            const d0 = 2, d1 = 6;
            const densityT = Math.min(Math.max((density - d0) / (d1 - d0), 0), 1);
            const densitySmooth = densityT * densityT * (3 - 2 * densityT);  // smoothstep

            // Compression ramp: stronger softening when spring is compressed
            // 1.0 at dist/rest >= 1.0, 1.5 at dist/rest <= 0.5
            const compressionRatio = Math.min(springDist / restLength, 1);
            const compressionBoost = 1 + (1 - compressionRatio) * 0.5;  // 1.0 → 1.5

            // Combined: scale from 1.0 (no softening) to 0.05 (max softening)
            const minTangent = 0.05;
            const tangentScale = 1.0 - densitySmooth * compressionBoost * (1.0 - minTangent);

            return Math.max(tangentScale, minTangent);
        };

        // Apply with hub softening (and tangential softening for dense regions)
        if (!source.isFixed) {
            let sfx = fx * sourceScale;
            let sfy = fy * sourceScale;

            // Tangential softening: decompose and reduce tangential component
            const sourceTangentScale = computeTangentScale(sourceDensity, d, restLength);
            if (sourceTangentScale < 1.0) {
                // Unit vector along spring
                const ux = dx / d;
                const uy = dy / d;

                // Radial component (along spring direction)
                const radialMag = sfx * ux + sfy * uy;
                const radialFx = radialMag * ux;
                const radialFy = radialMag * uy;

                // Tangential component (perpendicular)
                const tangentFx = sfx - radialFx;
                const tangentFy = sfy - radialFy;

                // Recombine with softened tangential
                sfx = radialFx + tangentFx * sourceTangentScale;
                sfy = radialFy + tangentFy * sourceTangentScale;

                debugMinTangentScale = Math.min(debugMinTangentScale, sourceTangentScale);
            }

            source.fx += sfx;
            source.fy += sfy;
        }
        if (!target.isFixed) {
            let tfx = -fx * targetScale;
            let tfy = -fy * targetScale;

            // Tangential softening for target
            const targetTangentScale = computeTangentScale(targetDensity, d, restLength);
            if (targetTangentScale < 1.0) {
                const ux = dx / d;
                const uy = dy / d;

                const radialMag = tfx * ux + tfy * uy;
                const radialFx = radialMag * ux;
                const radialFy = radialMag * uy;

                const tangentFx = tfx - radialFx;
                const tangentFy = tfy - radialFy;

                tfx = radialFx + tangentFx * targetTangentScale;
                tfy = radialFy + tangentFy * targetTangentScale;

                debugMinTangentScale = Math.min(debugMinTangentScale, targetTangentScale);
            }

            target.fx += tfx;
            target.fy += tfy;
        }

        // DENSE-CORE FORCE DITHERING (Temporal Null-Gradient Perturbation)
        // Adds tiny time-varying tangential force to break force equilibrium
        // Zero-mean over time, no geometric encoding
        const ditherStrength = 0.02;  // Tiny force magnitude
        const ditherDensityThreshold = 4;
        const ditherEnergyGate = allowEarlyExpansion && energy > 0.85;

        if (ditherEnergyGate && (sourceDensity >= ditherDensityThreshold || targetDensity >= ditherDensityThreshold)) {
            // Hash edge ID + frameIndex for deterministic time-varying phase
            const edgeKey = source.id < target.id
                ? `${source.id}:${target.id}`
                : `${target.id}:${source.id}`;

            let edgeHash = frameIndex;  // Start with frame (temporal component)
            for (let i = 0; i < edgeKey.length; i++) {
                edgeHash = ((edgeHash << 5) - edgeHash) + edgeKey.charCodeAt(i);
                edgeHash |= 0;
            }

            // Map to [-1, 1] oscillatory phase (changes every frame)
            const normalizedHash = ((edgeHash % 2000) + 2000) % 2000 / 1000 - 1;  // -1 to +1

            // Tangential direction (perpendicular to spring)
            const ux = dx / d;
            const uy = dy / d;
            const tangentX = -uy;  // 90° rotation
            const tangentY = ux;

            // Apply oscillatory tangential perturbation
            const ditherFx = tangentX * normalizedHash * ditherStrength;
            const ditherFy = tangentY * normalizedHash * ditherStrength;

            if (!source.isFixed) {
                source.fx += ditherFx;
                source.fy += ditherFy;
            }
            if (!target.isFixed) {
                target.fx -= ditherFx;  // Opposite for pairwise symmetry
                target.fy -= ditherFy;
            }
        }

        // DEBUG: log min tangent scale
        if (applyTangentialSoftening && debugMinTangentScale < 1.0) {
            console.log(`[Springs] minTangentScale: ${debugMinTangentScale.toFixed(3)}, srcDensity: ${sourceDensity}, tgtDensity: ${targetDensity}`);
        }
    }
}

/**
 * PBD (Position Based Dynamics) Constraint for Snap Phase.
         * Directly projects nodes to their target distance.
         * This ignores mass and inertia, strictly enforcing geometry.
         */
export function applySpringConstraint(
    nodes: Map<string, PhysicsNode>,
    links: PhysicsLink[],
    config: ForceConfig,
    strength: number = 0.5 // How much of the error to correct per frame (0.0 - 1.0)
) {

    for (const link of links) {
        const source = nodes.get(link.source);
        const target = nodes.get(link.target);

        if (!source || !target) continue;
        if (source.isFixed && target.isFixed) continue;

        let dx = target.x - source.x;
        let dy = target.y - source.y;

        // Zero shim
        if (dx === 0 && dy === 0) {
            dx = (Math.random() - 0.5) * 0.1;
            dy = (Math.random() - 0.5) * 0.1;
        }

        const d = Math.sqrt(dx * dx + dy * dy);

        // Uniform rest length for all springs
        const targetLen = config.linkRestLength;

        // Difference
        const diff = d - targetLen;

        // PBD Correction vector
        // We want to move them closer/further by `diff`.
        // Fraction to move per node:
        const correction = diff * strength;

        // Normalize
        const ndx = dx / d;
        const ndy = dy / d;

        // Move amount
        // If both free: split 50/50. If one fixed: move other 100%.
        let wS = source.isFixed ? 0 : 0.5;
        let wT = target.isFixed ? 0 : 0.5;

        // Rescale if one is fixed
        if (wS === 0 && wT === 0.5) wT = 1.0;
        if (wT === 0 && wS === 0.5) wS = 1.0;

        // Apply Position Shift immediately
        if (wS > 0) {
            const sdx = ndx * correction * wS;
            const sdy = ndy * correction * wS;
            source.x += sdx;
            source.y += sdy;
            if (source.prevX !== undefined) source.prevX += sdx;
            if (source.prevY !== undefined) source.prevY += sdy;
        }
        if (wT > 0) {
            const tdx = ndx * correction * wT;
            const tdy = ndy * correction * wT;
            target.x -= tdx;
            target.y -= tdy;
            if (target.prevX !== undefined) target.prevX -= tdx;
            if (target.prevY !== undefined) target.prevY -= tdy;
        }
    }
}

/**
 * Apply center gravity.
 * UX Anchor: "Center-of-Mass".
 * Keeps everything from drifting to infinity.
 */
export function applyCenterGravity(
    nodes: PhysicsNode[],
    config: ForceConfig,
    center: { x: number, y: number } = { x: 0, y: 0 }
) {
    const { gravityCenterStrength, gravityBaseRadius } = config;
    if (nodes.length === 0) return;

    // UX Anchor: "Organism Sizing"
    // Calculate dynamic "safe radius" based on population.
    // 20 nodes -> ~4.5 * base -> base should be small (~30).
    // Let's use: base + (sqrt(N) * spacingFactor)
    // Or simpler: base * log(N+1)
    // User wants: 20 nodes -> small. 400 nodes -> fits screen.
    // Let's try: Radius = base + (N * 2) 
    const populationRadius = gravityBaseRadius + (nodes.length * 3);

    // UX Anchor: "Elliptical Comfort" (Aspect Ratio)
    // We want to squeeze vertically more than horizontally.
    // We can do this by scaling Y distance higher than X distance before checking against radius.
    // effectively making the safe zone an ellipse (wider than tall).
    const verticalPenalty = 2.5; // Y axis is 2.5x more "expensive"

    for (const node of nodes) {
        if (node.isFixed) continue;

        const dx = center.x - node.x;
        const dy = center.y - node.y;

        // Elliptical distance metric
        // We stretch dy effectively.
        const effectiveDist = Math.sqrt(dx * dx + (dy * verticalPenalty) * (dy * verticalPenalty));

        if (effectiveDist > populationRadius) {
            const distOutside = effectiveDist - populationRadius;

            // Direction TO center
            const d = Math.sqrt(dx * dx + dy * dy); // True geometric distance for normalization
            const nx = dx / d;
            const ny = dy / d;

            // Force
            const force = distOutside * gravityCenterStrength;

            node.fx += nx * force;
            node.fy += ny * force;
        }
    }
}

/**
 * Apply soft boundary force.
 * UX Anchor: "Screen Containment".
 * Pushes nodes back if they get too close to the world bounds.
 * Forces are zero if > margin away. Ramps up linearly as they approach/cross edge.
 */
export function applyBoundaryForce(
    nodes: PhysicsNode[],
    config: ForceConfig,
    worldWidth: number,
    worldHeight: number
) {
    const { boundaryMargin, boundaryStrength } = config;
    const halfW = worldWidth / 2;
    const halfH = worldHeight / 2;

    const minX = -halfW + boundaryMargin;
    const maxX = halfW - boundaryMargin;
    const minY = -halfH + boundaryMargin;
    const maxY = halfH - boundaryMargin;

    // We assume world is centered at 0,0
    for (const node of nodes) {
        if (node.isFixed) continue;

        // Check Left
        if (node.x < minX) {
            // Distance into the margin or past it
            const penetration = minX - node.x;
            // Normalized 0..1 (if we used margin as scale) but simplest is direct force * penetration
            // Force points RIGHT (positive)
            node.fx += penetration * boundaryStrength * 0.01;
        }

        // Check Right
        if (node.x > maxX) {
            const penetration = node.x - maxX;
            // Force points LEFT (negative)
            node.fx -= penetration * boundaryStrength * 0.01;
        }

        // Check Top
        if (node.y < minY) {
            const penetration = minY - node.y;
            // Force points DOWN (positive)
            node.fy += penetration * boundaryStrength * 0.01;
        }

        // Check Bottom
        if (node.y > maxY) {
            const penetration = node.y - maxY;
            // Force points UP (negative)
            node.fy -= penetration * boundaryStrength * 0.01;
        }
    }
}
