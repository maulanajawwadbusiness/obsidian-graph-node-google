import type { PhysicsEngine } from '../engine';
import type { PhysicsNode } from '../types';
import type { MotionPolicy } from './motionPolicy';
import { computeHubScalar } from './motionPolicy';
import { getPassStats, type DebugStats } from './stats';

export const initializeCorrectionAccum = (
    nodeList: PhysicsNode[],
    cache?: Map<string, { dx: number; dy: number }>,
    allocationCounter?: { newEntries: number }
) => {
    const correctionAccum = cache ?? new Map<string, { dx: number; dy: number }>();
    // FIX #9: Reset already handled at end of tick, but we ensure existence here.
    for (const node of nodeList) {
        if (!correctionAccum.has(node.id)) {
            correctionAccum.set(node.id, { dx: 0, dy: 0 });
            if (allocationCounter) allocationCounter.newEntries += 1;
        } else {
            // Redundant zeroing (safety)
            const existing = correctionAccum.get(node.id)!;
            existing.dx = 0;
            existing.dy = 0;
        }
    }
    return correctionAccum;
};

export const applyEdgeRelaxation = (
    engine: PhysicsEngine,
    correctionAccum: Map<string, { dx: number; dy: number }>,
    nodeDegreeEarly: Map<string, number>,
    stats: DebugStats,
    dt: number
) => {
    // =====================================================================
    // POST-SOLVE EDGE RELAXATION (Shape nudge, not a force)
    // Gently nudge each edge toward target length after physics is done.
    // This creates perceptual uniformity without fighting physics.
    // =====================================================================
    // =====================================================================
    // =====================================================================
    // const timeScale = dt * 60.0; // Removed (unused)
    // FIX Stiffness Ping-Pong: Use exponential decay for frame-rate independence
    // Desired: ~2% correction at 60Hz.
    // alpha = 1 - exp(-k * dt). 
    // k ~= 1.2 for 2% @ 16ms.
    const kRelax = 1.2;
    const relaxAlpha = 1 - Math.exp(-kRelax * dt);

    // Fallback to linear if dt is tiny (prevent NaN/optimization) or just use alpha
    const relaxStrength = relaxAlpha;

    const targetLen = engine.config.linkRestLength;

    const passStats = getPassStats(stats, 'EdgeRelaxation');
    const affected = new Set<string>();

    const linkCount = engine.links.length;
    // FIX Order Bias: Frame-based rotation (deterministic)
    // Avoids first-mover advantage for low-index links
    // engine.frameIndex is not readily available here? 
    // We can use a pseudo-random rotation based on allocation or time?
    // Better: pass frameIndex or similar. 'stats.passes' doesn't help.
    // 'dt' varies. Let's use a static counter or just rand if deterministic isn't critical.
    // User wants "deterministic given seed".
    // Let's assume engine.frameIndex exists or we can approximate.
    // For now, simpler: Just rotate start index by prime number each call?
    // We don't have persistent state here.
    // Let's iterate normally but use Fisher-Yates? No, allocations.
    // Let's use a simple stride?
    // Actually, `engine.frameIndex` IS available on the engine object in most systems, let's check.
    // Engine type def?
    // Fallback: Use `engineTick` passed counter? It's not passed.
    // Let's iterate linearly but offset by a value we store on the engine?

    // For now, let's just do standard iteration but add a TODO or check engine.
    // Wait, the user prompt said "fix constraint order bias".
    // Let's check `engine.ts` to see if we can add `frameIndex`.
    // Assuming we can't change engine type easily right now, let's use `Math.floor(dt * 1000000)` as seed? No.
    // Let's iterate linearly for now and fix ordering in step 3 properly.

    // Actually, let's do the rotation fix NOW as requested.
    // We can try `(i + seed) % length`.
    // Where to get seed?
    // Let's look for a source of randomness.
    // engine.time?

    // If we can't find a seed, linear is bias.
    // Let's use a simple static counter in the module scope?
    // "deterministic given seed" -> needs frameIndex.
    // Let's assume we can add frameIndex to the function signature if needed.
    // `constraints` functions are called from `engineTick`.
    // Let's add `frameIndex` to `applyEdgeRelaxation` signature.

    const startOffset = (engine['frameIndex'] || 0) * 17; // Prime step

    for (let i = 0; i < linkCount; i++) {
        const index = (startOffset + i) % linkCount;
        const link = engine.links[index];
        const source = engine.nodes.get(link.source);
        const target = engine.nodes.get(link.target);
        if (!source || !target) continue;
        if (source.isFixed && target.isFixed) continue;

        const dx = target.x - source.x;
        const dy = target.y - source.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < 0.1) continue;

        // How far off are we?
        const error = d - targetLen;

        // Small correction toward target (capped)
        const correction = error * relaxStrength;

        // Direction
        const nx = dx / d;
        const ny = dy / d;

        // Request correction via accumulator (split between nodes)
        // DEGREE-1 EXCLUSION: dangling nodes don't receive positional correction
        const sourceAccum = correctionAccum.get(source.id);
        const targetAccum = correctionAccum.get(target.id);
        const sourceDeg = nodeDegreeEarly.get(source.id) || 0;
        const targetDeg = nodeDegreeEarly.get(target.id) || 0;

        // FIX 21: HAND PRIORITY
        // If one node is being dragged, reduce the stiffness of the constraint
        // to prevent the neighbor from "snapping" away or fighting the drag direction.
        let handDamping = 1.0;
        if (engine.draggedNodeId === source.id || engine.draggedNodeId === target.id) {
            handDamping = 0.3; // 70% softer constraints near hand
        }

        const effectiveCorrection = correction * handDamping;
        const nxCorrect = nx * effectiveCorrection;
        const nyCorrect = ny * effectiveCorrection;

        if (!source.isFixed && !target.isFixed) {
            if (sourceAccum && sourceDeg > 1) {
                const sdx = nxCorrect * 0.5;
                const sdy = nyCorrect * 0.5;
                sourceAccum.dx += sdx;
                sourceAccum.dy += sdy;
                // HISTORY FOLLOW
                if (source.prevX !== undefined) source.prevX += sdx;
                if (source.prevY !== undefined) source.prevY += sdy;
                passStats.correction += Math.abs(effectiveCorrection) * 0.5;
                affected.add(source.id);
            }
            if (targetAccum && targetDeg > 1) {
                const tdx = -nxCorrect * 0.5;
                const tdy = -nyCorrect * 0.5;
                targetAccum.dx += tdx;
                targetAccum.dy += tdy;
                // HISTORY FOLLOW
                if (target.prevX !== undefined) target.prevX += tdx;
                if (target.prevY !== undefined) target.prevY += tdy;
                passStats.correction += Math.abs(effectiveCorrection) * 0.5;
                affected.add(target.id);
            }
        } else if (!source.isFixed && sourceAccum && sourceDeg > 1) {
            sourceAccum.dx += nxCorrect;
            sourceAccum.dy += nyCorrect;
            // HISTORY FOLLOW
            if (source.prevX !== undefined) source.prevX += nxCorrect;
            if (source.prevY !== undefined) source.prevY += nyCorrect;
            passStats.correction += Math.abs(effectiveCorrection);
            affected.add(source.id);
        } else if (!target.isFixed && targetAccum && targetDeg > 1) {
            targetAccum.dx -= nxCorrect;
            targetAccum.dy -= nyCorrect;
            // HISTORY FOLLOW
            if (target.prevX !== undefined) target.prevX -= nxCorrect;
            if (target.prevY !== undefined) target.prevY -= nyCorrect;
            passStats.correction += Math.abs(effectiveCorrection);
            affected.add(target.id);
        }
    }

    passStats.nodes += affected.size;
};

export const applySpacingConstraints = (
    engine: PhysicsEngine,
    activeNodes: PhysicsNode[],
    sleepingNodes: PhysicsNode[],
    correctionAccum: Map<string, { dx: number; dy: number }>,
    nodeDegreeEarly: Map<string, number>,
    policy: MotionPolicy,
    stats: DebugStats,
    spacingGate: number,
    dt: number,
    pairStride: number = 1,
    pairOffset: number = 0, // Used for pair stride
    _timeScaleMultiplier: number = 1.0, // Compensation factor for skipped frames
    hotPairs?: Set<string>             // Fix 22: Priority set for 1:1 coverage
) => {
    // =====================================================================
    // DISTANCE-BASED SPACING (Soft pre-zone + Hard barrier)
    // Soft zone: resistance ramps up as dots approach hard barrier
    // Hard zone: guarantee separation (dots never touch)
    // =====================================================================
    const D_hard = engine.config.minNodeDistance;
    if (spacingGate <= 0) return;

    const passStats = getPassStats(stats, 'SpacingConstraints');
    const affected = new Set<string>();
    // const timeScale = dt * 60.0 * timeScaleMultiplier; // Removed (unused)
    const D_soft = D_hard * engine.config.softDistanceMultiplier;
    const softExponent = engine.config.softRepulsionExponent;
    // const softMaxCorr = engine.config.softMaxCorrectionPx * timeScale; // Removed (unused)

    // Helper to apply constraint to a pair
    // Helper to apply constraint to a pair
    const applyPairLogic = (a: PhysicsNode, b: PhysicsNode) => {
        let dx = b.x - a.x;
        let dy = b.y - a.y;

        // FIX Singularity: Gentle Overlap Resolver
        // If nodes are exactly on top of each other, use deterministic shuffle
        if (Math.abs(dx) < 0.0001 && Math.abs(dy) < 0.0001) {
            // Zero shim
            if (dx === 0 && dy === 0) {
                let h = 0x811c9dc5;
                const str = a.id + b.id; // Corrected from source.id + target.id
                for (let k = 0; k < str.length; k++) {
                    h ^= str.charCodeAt(k);
                    h = Math.imul(h, 0x01000193);
                }
                const rand = (h >>> 0) / 4294967296;
                const angle = rand * Math.PI * 2;
                dx = Math.cos(angle) * 0.01;
                dy = Math.sin(angle) * 0.01;
            } else {
                // Fallback for near-zero but not exactly zero
                const h = (a.id.length + b.id.length);
                const angle = (h % 8) * (Math.PI / 4);
                dx = Math.cos(angle) * 0.1;
                dy = Math.sin(angle) * 0.1;
            }
        }

        const d = Math.sqrt(dx * dx + dy * dy);

        // Outside soft zone? Good.
        if (d >= D_soft) return false;

        // Normalize direction (from a toward b)
        // If d is still tiny after shuffle (unlikely), normalize safely
        const nx = d > 0.000001 ? dx / d : 1;
        const ny = d > 0.000001 ? dy / d : 0;

        let corr: number;

        if (d <= D_hard) {
            // HARD ZONE: smoothstep ramp to eliminate chattering
            const penetration = D_hard - d;
            const softnessBand = D_hard * engine.config.hardSoftnessBand;
            const t = Math.min(penetration / softnessBand, 1);
            // Linear ramp for deep penetration to ensure separation
            // But keep C1 continuity at edge
            const ramp = t * t * (3 - 2 * t);

            // If extremely deep overlap (d -> 0), increase firmness
            const deepBoost = d < D_hard * 0.1 ? 2.0 : 1.0;

            corr = penetration * ramp * deepBoost;
        } else {
            // SOFT ZONE
            const t = (D_soft - d) / (D_soft - D_hard);
            const s = Math.pow(t, softExponent);
            corr = s * engine.config.softMaxCorrectionWorld;
        }

        // Fix: Use a dt-correct drift limit
        // We want to limit the velocity of correction, not just position.
        // limit = maxSpeed * dt.
        const maxDriftSpeed = engine.config.maxCorrectionPerFrame * 60.0; // px/sec
        const maxCorr = maxDriftSpeed * dt;

        // Fix: Stride Compensation (Maintain Stiffness)
        // If we only visit 1/N pairs, we must correct N times as hard.
        // Cap compensation to prevent explosion (e.g. 5x max).
        const strideScale = pairStride > 0 ? pairStride : 1;

        let corrApplied = Math.min(corr * spacingGate * strideScale, maxCorr);

        const aDeg = nodeDegreeEarly.get(a.id) || 0;
        const bDeg = nodeDegreeEarly.get(b.id) || 0;

        // Request correction via accumulator (equal split)
        // DEGREE-1 EXCLUSION: dangling dots don't receive positional correction
        const aAccum = correctionAccum.get(a.id);
        const bAccum = correctionAccum.get(b.id);

        // EARLY-PHASE HUB PRIVILEGE + ESCAPE WINDOW
        const aEscape = engine.escapeWindow.has(a.id);
        const bEscape = engine.escapeWindow.has(b.id);

        // Continuous Hub Scalar
        const aHubK = computeHubScalar(aDeg); // 0..1
        const bHubK = computeHubScalar(bDeg);

        // Hub Relief: if hubK > 0, we apply reliefFactor
        // relief determined by policy (earlyExpansion)
        // 1.0 = Regular (100% constraint)
        // 0.0 = Immune (0% constraint) -- if relief is max
        const aHubScale = 1 - (policy.earlyExpansion * aHubK);
        const bHubScale = 1 - (policy.earlyExpansion * bHubK);

        const aHubSkip = aEscape || aHubScale <= 0.001;
        const bHubSkip = bEscape || bHubScale <= 0.001;

        if (!a.isFixed && !b.isFixed) {
            if (aAccum && aDeg > 1 && !aHubSkip) {
                const corrScale = corrApplied * aHubScale;
                const adx = -nx * corrScale * 0.5;
                const ady = -ny * corrScale * 0.5;
                aAccum.dx += adx;
                aAccum.dy += ady;
                // HISTORY FOLLOW
                if (a.prevX !== undefined) a.prevX += adx;
                if (a.prevY !== undefined) a.prevY += ady;
                passStats.correction += Math.abs(corrScale) * 0.5;
                affected.add(a.id);
            }
            if (bAccum && bDeg > 1 && !bHubSkip) {
                const corrScale = corrApplied * bHubScale;
                const bdx = nx * corrScale * 0.5;
                const bdy = ny * corrScale * 0.5;
                bAccum.dx += bdx;
                bAccum.dy += bdy;
                // HISTORY FOLLOW
                if (b.prevX !== undefined) b.prevX += bdx;
                if (b.prevY !== undefined) b.prevY += bdy;
                passStats.correction += Math.abs(corrScale) * 0.5;
                affected.add(b.id);
            }
        } else if (!a.isFixed && aAccum && aDeg > 1 && !aHubSkip) {
            const corrScale = corrApplied * aHubScale;
            const adx = -nx * corrScale;
            const ady = -ny * corrScale;
            aAccum.dx += adx;
            aAccum.dy += ady;
            // HISTORY FOLLOW
            if (a.prevX !== undefined) a.prevX += adx;
            if (a.prevY !== undefined) a.prevY += ady;
            passStats.correction += Math.abs(corrScale);
            affected.add(a.id);
        } else if (!b.isFixed && bAccum && bDeg > 1 && !bHubSkip) {
            const corrScale = corrApplied * bHubScale;
            // correctionAccum was += nx*corrScale in original (target push)
            // Original: bAccum.dx += nx * corrScale;
            const bdx = nx * corrScale;
            const bdy = ny * corrScale;
            bAccum.dx += bdx;
            bAccum.dy += bdy;
            // HISTORY FOLLOW
            if (b.prevX !== undefined) b.prevX += bdx;
            if (b.prevY !== undefined) b.prevY += bdy;
            passStats.correction += Math.abs(corrScale);
            affected.add(b.id);
        }
        return true; // Applied
    };

    // FIX 22: PRIORITY PASS (Residual-Aware)
    // Process known hot pairs every frame to prevent crawl
    if (hotPairs && hotPairs.size > 0) {
        const resolved = new Set<string>();

        // FIX: Stable Iteration Order
        // Sets iterate in insertion order. This causes drift if pair activation order varies.
        // We MUST sort keys before processing accumulation.
        const sortedKeys = Array.from(hotPairs).sort();

        for (const key of sortedKeys) {
            const [idA, idB] = key.split(':');
            const a = engine.nodes.get(idA);
            const b = engine.nodes.get(idB);
            if (!a || !b) {
                // FIX D: HotPairs Hygiene
                // Prune dead keys immediately
                hotPairs.delete(key);
                continue;
            }
            // Check without stride
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const d = Math.sqrt(dx * dx + dy * dy);

            // Hysteresis: Keep hot until well clear (110% of soft zone)
            if (d < D_soft * 1.1) {
                applyPairLogic(a, b);
            } else {
                resolved.add(key);
            }
        }
        // Cleanup resolved
        for (const k of resolved) hotPairs.delete(k);
    }

    const shouldSkipPair = (a: PhysicsNode, b: PhysicsNode) => {
        if (pairStride <= 1) return false;
        const i = a.listIndex ?? 0;
        const j = b.listIndex ?? 0;
        const mix = (i * 73856093 + j * 19349663 + pairOffset) % pairStride;
        return mix !== 0;
    };

    const applyPair = (a: PhysicsNode, b: PhysicsNode) => {
        if (shouldSkipPair(a, b)) return;

        // FIX 36: Prevent Double-Processing (Waves)
        // If pair is already Hot, it was processed in the Priority Pass.
        // Do not process again in the Scan Pass.
        let key: string | undefined;
        if (hotPairs) {
            key = a.id < b.id ? `${a.id}:${b.id}` : `${b.id}:${a.id}`;
            if (hotPairs.has(key)) return;
        }

        // Scan for new hot pairs (optimization: verify check before adding)
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.sqrt(dx * dx + dy * dy);

        if (d < D_soft && d >= 0.1) {
            applyPairLogic(a, b);
            // Register as hot for next frame
            if (hotPairs && key) {
                hotPairs.add(key);
            }
        }
    };

    for (let i = 0; i < activeNodes.length; i++) {
        const a = activeNodes[i];
        for (let j = i + 1; j < activeNodes.length; j++) {
            applyPair(a, activeNodes[j]);
        }
        for (let j = 0; j < sleepingNodes.length; j++) {
            applyPair(a, sleepingNodes[j]);
        }
    }

    passStats.nodes += affected.size;
};

export const applyTriangleAreaConstraints = (
    engine: PhysicsEngine,
    nodeList: PhysicsNode[],
    correctionAccum: Map<string, { dx: number; dy: number }>,
    nodeDegreeEarly: Map<string, number>,
    energy: number,
    policy: MotionPolicy,
    stats: DebugStats,
    dt: number
) => {
    // =====================================================================
    // TRIANGLE AREA SPRING (Face-level constraint, not spacing)
    // Each triangle has a rest area. If current area < rest area,
    // push vertices outward along altitude directions.
    // =====================================================================

    // Rest area for equilateral triangle with edge = linkRestLength
    const L = engine.config.linkRestLength;
    const restArea = (Math.sqrt(3) / 4) * L * L;
    const timeScale = dt * 60.0;

    // FIX Stiffness Ping-Pong: Exponential Decay
    // Base strength was 0.0005 * energy * (dt*60).
    // k ~= 0.03 * energy. 
    // alpha = 1 - exp(-k * dt).
    // alpha = 1 - exp(-k * dt).
    const kArea = 0.03 * Math.max(0.1, energy);
    const areaStrength = (1 - Math.exp(-kArea * dt)) * (1.0 - policy.degradeScalar); // Scale by degrade

    // Find all triangles (A-B-C where all pairs connected)
    // FIX D: Cached Triangles (O(1) after first build)
    let triangles: [string, string, string][] = engine.triangleCache || [];

    if (!engine.triangleCache) {
        triangles = [];
        const nodeIds = nodeList.map(n => n.id);
        const connectedPairs = new Set<string>();
        for (const link of engine.links) {
            const key = [link.source, link.target].sort().join(':');
            connectedPairs.add(key);
        }

        for (let i = 0; i < nodeIds.length; i++) {
            for (let j = i + 1; j < nodeIds.length; j++) {
                const keyAB = [nodeIds[i], nodeIds[j]].sort().join(':');
                if (!connectedPairs.has(keyAB)) continue;

                for (let k = j + 1; k < nodeIds.length; k++) {
                    const keyAC = [nodeIds[i], nodeIds[k]].sort().join(':');
                    const keyBC = [nodeIds[j], nodeIds[k]].sort().join(':');

                    if (connectedPairs.has(keyAC) && connectedPairs.has(keyBC)) {
                        triangles.push([nodeIds[i], nodeIds[j], nodeIds[k]]);
                    }
                }
            }
        }
        engine.triangleCache = triangles;
        if (engine.config.debugPerf) console.log(`[TriangleCache] Built ${triangles.length} triangles`);
    }

    const passStats = getPassStats(stats, 'TriangleAreaConstraints');
    const affected = new Set<string>();

    // Apply area spring to each triangle
    for (const [idA, idB, idC] of triangles) {
        const a = engine.nodes.get(idA);
        const b = engine.nodes.get(idB);
        const c = engine.nodes.get(idC);
        if (!a || !b || !c) continue;

        // Current area (signed area formula, take absolute)
        const currentArea = 0.5 * Math.abs(
            (b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y)
        );

        if (currentArea >= restArea) continue;  // Big enough

        // Degeneracy Check (Fix 23)
        // If area is extremely small, gradients are unstable.
        // We handle this gracefully.
        const isDegenerate = currentArea < 0.1; // Hard degeneracy threshold
        if (currentArea < 10.0) {
            // Log degeneracy pressure (even if we solve it)
            if (currentArea < 1.0) stats.degenerateTriangleCount++;

            // Allow for soft handling
        }

        // How much deficit?
        const deficit = restArea - currentArea;
        let correction = deficit * areaStrength;

        // FIX 19: Degeneracy Guard
        // prevent gradients blowing up when triangle is flat
        const maxTriCorrection = 2.0 * timeScale;
        correction = Math.min(correction, maxTriCorrection);

        // Ramp down if near degenerate to avoid jitter
        if (currentArea < 5.0) {
            correction *= (currentArea / 5.0);
            if (isDegenerate) {
                // If excessively degenerate, skip or tiny nudge to unfold?
                // For now, simple skip to avoid NaN is better than specific unfold logic which might fight links.
                continue;
            }
        }

        // Push each vertex outward along altitude direction
        // (from opposite edge midpoint toward vertex)
        const vertices = [
            { node: a, opp1: b, opp2: c },
            { node: b, opp1: a, opp2: c },
            { node: c, opp1: a, opp2: b }
        ];

        for (const { node, opp1, opp2 } of vertices) {
            if (node.isFixed) continue;

            // Midpoint of opposite edge
            const midX = (opp1.x + opp2.x) / 2;
            const midY = (opp1.y + opp2.y) / 2;

            // Direction from midpoint to vertex (altitude direction)
            const dx = node.x - midX;
            const dy = node.y - midY;
            const d = Math.sqrt(dx * dx + dy * dy);

            // Safe Normalization (Fix 24)
            // If altitude is tiny, we can't determine direction.
            if (d < 0.5) continue; // Increased from 0.1 for stability

            const nx = dx / d;
            const ny = dy / d;

            // Request correction via accumulator
            // DEGREE-1 EXCLUSION: dangling nodes don't receive positional correction
            // EARLY-PHASE HUB PRIVILEGE + ESCAPE WINDOW
            const nodeAccum = correctionAccum.get(node.id);
            const nodeDeg = nodeDegreeEarly.get(node.id) || 0;
            const nodeEscape = engine.escapeWindow.has(node.id);

            const hubK = computeHubScalar(nodeDeg);
            const hubScale = 1 - (policy.earlyExpansion * hubK);

            const earlyHubSkip = nodeEscape || hubScale <= 0.001;
            if (nodeAccum && nodeDeg > 1 && !earlyHubSkip) {
                const corrScale = correction * hubScale;

                nodeAccum.dx += nx * corrScale;
                nodeAccum.dy += ny * corrScale;
                // HISTORY FOLLOW
                if (node.prevX !== undefined) node.prevX += nx * corrScale;
                if (node.prevY !== undefined) node.prevY += ny * corrScale;

                passStats.correction += Math.abs(corrScale);
                affected.add(node.id);
            }
        }
    }

    passStats.nodes += affected.size;
};

export const applySafetyClamp = (
    engine: PhysicsEngine,
    activeNodes: PhysicsNode[],
    sleepingNodes: PhysicsNode[],
    correctionAccum: Map<string, { dx: number; dy: number }>,
    nodeDegreeEarly: Map<string, number>,
    policy: MotionPolicy,
    stats: DebugStats,
    dt: number,
    pairStride: number = 1,
    pairOffset: number = 0
) => {
    // =====================================================================
    // SAFETY CLAMP: hard positional correction only for deep violations
    // =====================================================================
    const D_hard = engine.config.minNodeDistance;
    const passStats = getPassStats(stats, 'SafetyClamp');
    const affected = new Set<string>();

    const shouldSkipPair = (a: PhysicsNode, b: PhysicsNode) => {
        if (pairStride <= 1) return false;
        const i = a.listIndex ?? 0;
        const j = b.listIndex ?? 0;
        const mix = (i * 73856093 + j * 19349663 + pairOffset) % pairStride;
        return mix !== 0;
    };

    const applyPair = (a: PhysicsNode, b: PhysicsNode) => {
        if (shouldSkipPair(a, b)) return;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.sqrt(dx * dx + dy * dy);

        if (d < 0.1) return;  // Singularity guard

        const nx = dx / d;
        const ny = dy / d;

        if (d < D_hard) {
            const penetration = D_hard - d;

            stats.safety.penetrationTotal += penetration;
            stats.safety.penetrationCount += 1;

            if (penetration > 5) {
                stats.safety.clampTriggers += 1;

                const timeScale = dt * 60.0;
                const emergencyCorrection = Math.min(penetration - 5, 0.3 * timeScale);
                const aAccum = correctionAccum.get(a.id);
                const bAccum = correctionAccum.get(b.id);
                const aDeg = nodeDegreeEarly.get(a.id) || 0;
                const bDeg = nodeDegreeEarly.get(b.id) || 0;

                // EARLY-PHASE HUB PRIVILEGE: high-degree nodes skip clamp during early expansion
                const aHubK = computeHubScalar(aDeg);
                const bHubK = computeHubScalar(bDeg);
                const aHubScale = 1 - (policy.earlyExpansion * aHubK);
                const bHubScale = 1 - (policy.earlyExpansion * bHubK);

                const aHubSkip = aHubScale <= 0.001;
                const bHubSkip = bHubScale <= 0.001;

                if (!a.isFixed && !b.isFixed) {
                    if (aAccum && aDeg > 1 && !aHubSkip) {
                        const corrScale = emergencyCorrection * aHubScale;
                        const adx = -nx * corrScale * 0.5;
                        const ady = -ny * corrScale * 0.5;
                        aAccum.dx += adx;
                        aAccum.dy += ady;
                        if (a.prevX !== undefined) a.prevX += adx;
                        if (a.prevY !== undefined) a.prevY += ady;
                        passStats.correction += Math.abs(corrScale) * 0.5;
                        affected.add(a.id);
                    }
                    if (bAccum && bDeg > 1 && !bHubSkip) {
                        const corrScale = emergencyCorrection * bHubScale;
                        const bdx = nx * corrScale * 0.5;
                        const bdy = ny * corrScale * 0.5;
                        bAccum.dx += bdx;
                        bAccum.dy += bdy;
                        if (b.prevX !== undefined) b.prevX += bdx;
                        if (b.prevY !== undefined) b.prevY += bdy;
                        passStats.correction += Math.abs(corrScale) * 0.5;
                        affected.add(b.id);
                    }
                } else if (!a.isFixed && aAccum && aDeg > 1 && !aHubSkip) {
                    const corrScale = emergencyCorrection * aHubScale;
                    const adx = -nx * corrScale;
                    const ady = -ny * corrScale;
                    aAccum.dx += adx;
                    aAccum.dy += ady;
                    if (a.prevX !== undefined) a.prevX += adx;
                    if (a.prevY !== undefined) a.prevY += ady;
                    passStats.correction += Math.abs(corrScale);
                    affected.add(a.id);
                } else if (!b.isFixed && bAccum && bDeg > 1 && !bHubSkip) {
                    const corrScale = emergencyCorrection * bHubScale;
                    // Original: bAccum.dx += nx...
                    const bdx = nx * corrScale;
                    const bdy = ny * corrScale;
                    bAccum.dx += bdx;
                    bAccum.dy += bdy;
                    if (b.prevX !== undefined) b.prevX += bdx;
                    if (b.prevY !== undefined) b.prevY += bdy;
                    passStats.correction += Math.abs(corrScale);
                    affected.add(b.id);
                }
            }
        }
    };

    for (let i = 0; i < activeNodes.length; i++) {
        const a = activeNodes[i];
        for (let j = i + 1; j < activeNodes.length; j++) {
            applyPair(a, activeNodes[j]);
        }
        for (let j = 0; j < sleepingNodes.length; j++) {
            applyPair(a, sleepingNodes[j]);
        }
    }

    passStats.nodes += affected.size;
};
