import type { PhysicsEngine } from '../../engine';
import type { PhysicsNode } from '../../types';
import { getPassStats, type DebugStats } from '../stats';

export const applyDistanceBiasVelocity = (
    engine: PhysicsEngine,
    nodeList: PhysicsNode[],
    stats: DebugStats,
    dt: number
) => {
    const passStats = getPassStats(stats, 'DistanceBiasVelocity');
    const affected = new Set<string>();

    const D_hard = engine.config.minNodeDistance;
    const releaseDist = D_hard + engine.config.clampHysteresisMargin;
    const timeScale = dt * 60.0;
    const biasStrength = 15.0 * timeScale;  // Outward velocity bias strength

    for (let i = 0; i < nodeList.length; i++) {
        const a = nodeList[i];
        for (let j = i + 1; j < nodeList.length; j++) {
            const b = nodeList[j];

            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const d = Math.sqrt(dx * dx + dy * dy);

            if (d < 0.1) continue;  // Singularity guard

            const pairKey = a.id < b.id ? `${a.id}:${b.id}` : `${b.id}:${a.id}`;
            const wasClamped = engine.clampedPairs.has(pairKey);

            const nx = dx / d;
            const ny = dy / d;

            // Contact slop zone: gradual velocity projection before hitting hard wall
            const slop = engine.config.contactSlop;
            const slopStart = D_hard + slop;  // Start of gradual resistance zone

            if (d >= D_hard && d < slopStart) {
                // SLOP ZONE: velocity-only projection, no positional correction
                // Strength ramps from 0 (at slopStart) to 1 (at minDist)
                const slopT = (slopStart - d) / slop;  // 0->1 as d approaches minDist
                const slopRamp = slopT * slopT * (3 - 2 * slopT);  // smoothstep

                // Exponential Velocity Removal:
                // We want to remove a fraction 'slopRamp' of velocity per tick (baseline 60hz).
                // factor = 1 - pow(1 - slopRamp, timeScale)
                const removalFactor = 1 - Math.pow(1 - slopRamp, timeScale);

                // Project inward velocity with ramped strength
                if (!a.isFixed) {
                    const beforeVx = a.vx;
                    const beforeVy = a.vy;
                    const aInward = a.vx * nx + a.vy * ny;
                    if (aInward > 0) {
                        a.vx -= aInward * nx * removalFactor;
                        a.vy -= aInward * ny * removalFactor;
                    }
                    const dvx = a.vx - beforeVx;
                    const dvy = a.vy - beforeVy;
                    const deltaMag = Math.sqrt(dvx * dvx + dvy * dvy);
                    if (deltaMag > 0) {
                        passStats.velocity += deltaMag;
                        affected.add(a.id);
                    }
                }
                if (!b.isFixed) {
                    const beforeVx = b.vx;
                    const beforeVy = b.vy;
                    const bInward = b.vx * nx + b.vy * ny;
                    if (bInward < 0) {
                        b.vx -= bInward * nx * removalFactor;
                        b.vy -= bInward * ny * removalFactor;
                    }
                    const dvx = b.vx - beforeVx;
                    const dvy = b.vy - beforeVy;
                    const deltaMag = Math.sqrt(dvx * dvx + dvy * dvy);
                    if (deltaMag > 0) {
                        passStats.velocity += deltaMag;
                        affected.add(b.id);
                    }
                }
            }
            else if (d < D_hard) {
                // CONTINUOUS BIAS: apply outward velocity, ramped by penetration
                const penetration = D_hard - d;
                const t = Math.min(penetration / D_hard, 1);  // 0->1
                const ramp = t * t * (3 - 2 * t);  // Smoothstep
                const bias = ramp * biasStrength;

                if (!a.isFixed && !b.isFixed) {
                    const dvxA = -nx * bias;
                    const dvyA = -ny * bias;
                    const dvxB = nx * bias;
                    const dvyB = ny * bias;
                    a.vx += dvxA;
                    a.vy += dvyA;
                    b.vx += dvxB;
                    b.vy += dvyB;
                    passStats.velocity += Math.sqrt(dvxA * dvxA + dvyA * dvyA);
                    passStats.velocity += Math.sqrt(dvxB * dvxB + dvyB * dvyB);
                    affected.add(a.id);
                    affected.add(b.id);
                } else if (!a.isFixed) {
                    const dvxA = -nx * bias * 2;
                    const dvyA = -ny * bias * 2;
                    a.vx += dvxA;
                    a.vy += dvyA;
                    passStats.velocity += Math.sqrt(dvxA * dvxA + dvyA * dvyA);
                    affected.add(a.id);
                } else if (!b.isFixed) {
                    const dvxB = nx * bias * 2;
                    const dvyB = ny * bias * 2;
                    b.vx += dvxB;
                    b.vy += dvyB;
                    passStats.velocity += Math.sqrt(dvxB * dvxB + dvyB * dvyB);
                    affected.add(b.id);
                }

                // VELOCITY PROJECTION: remove inward component to prevent "invisible wall" bounce
                // n points from a toward b, so:
                // - for a, inward = moving toward b = positive dot with n
                // - for b, inward = moving toward a = negative dot with n
                if (!a.isFixed) {
                    const beforeVx = a.vx;
                    const beforeVy = a.vy;
                    const aInward = a.vx * nx + a.vy * ny;  // positive = moving toward b
                    if (aInward > 0) {
                        a.vx -= aInward * nx;
                        a.vy -= aInward * ny;
                    }
                    const dvx = a.vx - beforeVx;
                    const dvy = a.vy - beforeVy;
                    const deltaMag = Math.sqrt(dvx * dvx + dvy * dvy);
                    if (deltaMag > 0) {
                        passStats.velocity += deltaMag;
                        affected.add(a.id);
                    }
                }
                if (!b.isFixed) {
                    const beforeVx = b.vx;
                    const beforeVy = b.vy;
                    const bInward = b.vx * nx + b.vy * ny;  // negative = moving toward a
                    if (bInward < 0) {
                        b.vx -= bInward * nx;
                        b.vy -= bInward * ny;
                    }
                    const dvx = b.vx - beforeVx;
                    const dvy = b.vy - beforeVy;
                    const deltaMag = Math.sqrt(dvx * dvx + dvy * dvy);
                    if (deltaMag > 0) {
                        passStats.velocity += deltaMag;
                        affected.add(b.id);
                    }
                }

                engine.clampedPairs.add(pairKey);
            }
            else if (wasClamped && d < releaseDist) {
                // HOLD: inside hysteresis buffer, do nothing
            }
            else {
                // RELEASE: outside buffer, clear lock
                engine.clampedPairs.delete(pairKey);
            }
        }
    }

    passStats.nodes += affected.size;
};
