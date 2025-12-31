import type { PhysicsEngine } from '../engine';
import type { PhysicsNode } from '../types';

export type IntegrationResult = {
    centroidX: number;
    centroidY: number;
};

export const integrateNodes = (
    engine: PhysicsEngine,
    nodeList: PhysicsNode[],
    dt: number,
    energy: number,
    effectiveDamping: number,
    maxVelocityEffective: number
): IntegrationResult => {
    let clampHitCount = 0;

    // Calculate live centroid (needed for global spin and anisotropic damping)
    let centroidX = 0, centroidY = 0;
    for (const node of nodeList) {
        centroidX += node.x;
        centroidY += node.y;
    }
    centroidX /= nodeList.length;
    centroidY /= nodeList.length;

    // =====================================================================
    // ROTATING MEDIUM: Spin decays with energy, angle accumulates
    // (Rotation is applied at RENDER time, physics doesn't see it)
    // No capture moment. Spin was initialized at birth and just fades.
    // =====================================================================
    engine.globalAngularVel *= Math.exp(-engine.config.spinDamping * dt);
    engine.globalAngle += engine.globalAngularVel * dt;

    // =====================================================================
    // WATER MICRO-DRIFT: The water is alive, not glass
    // Very slow, very tiny drift to globalAngle - "water touching the underside"
    // =====================================================================
    const t = engine.lifecycle;
    const microDrift =
        Math.sin(t * 0.3) * 0.0008 +  // ~20 second period, tiny amplitude
        Math.sin(t * 0.7) * 0.0004 +  // ~9 second period, tinier
        Math.sin(t * 1.1) * 0.0002;   // ~6 second period, tiniest
    engine.globalAngle += microDrift * dt;

    // =====================================================================
    // INTEGRATION: Simple unified damping (no radial/tangent split)
    // All forces already scaled by energy. Damping increases as energy falls.
    // =====================================================================
    for (const node of nodeList) {
        if (node.isFixed) continue;

        // DEGREE-BASED INERTIA: High-degree nodes feel heavier
        // Prevents hub overshoot → no visible corrections
        let inertiaDeg = 0;
        for (const link of engine.links) {
            if (link.source === node.id || link.target === node.id) inertiaDeg++;
        }
        const massFactor = 0.4;  // How much degree increases mass
        const effectiveMass = node.mass * (1 + massFactor * Math.max(inertiaDeg - 1, 0));

        const ax = node.fx / effectiveMass;
        const ay = node.fy / effectiveMass;

        // Update Velocity
        node.vx += ax * dt;
        node.vy += ay * dt;

        // EARLY-PHASE SYMMETRY BREAKING: Prevent symmetric force cancellation in hubs
        // Only active during early expansion (energy > 0.7), fades out smoothly
        // Deterministic direction based on node ID hash
        if (energy > 0.7) {
            // Count degree inline
            let deg = 0;
            for (const link of engine.links) {
                if (link.source === node.id || link.target === node.id) deg++;
            }

            if (deg >= 3) {
                // TRAPPED HUB CARRIER FLOW
                // Detect trapped hub: low net force AND low velocity
                const fMag = Math.sqrt(node.fx * node.fx + node.fy * node.fy);
                const vMag = Math.sqrt(node.vx * node.vx + node.vy * node.vy);
                const forceEpsilon = 1.0;
                const velocityThreshold = 0.5;

                const isTrapped = fMag < forceEpsilon && vMag < velocityThreshold;

                if (isTrapped) {
                    // Compute local cluster centroid (nearby hub nodes)
                    let clusterCx = 0, clusterCy = 0;
                    let clusterCount = 0;

                    for (const otherNode of nodeList) {
                        if (otherNode.id === node.id) continue;
                        const dx = otherNode.x - node.x;
                        const dy = otherNode.y - node.y;
                        const dist = Math.sqrt(dx * dx + dy * dy);

                        // Only nearby nodes (within 2x minNodeDistance)
                        if (dist < engine.config.minNodeDistance * 2) {
                            clusterCx += otherNode.x;
                            clusterCy += otherNode.y;
                            clusterCount++;
                        }
                    }

                    if (clusterCount > 0) {
                        clusterCx /= clusterCount;
                        clusterCy /= clusterCount;

                        // Direction from centroid to node
                        const toCx = node.x - clusterCx;
                        const toCy = node.y - clusterCy;
                        const toD = Math.sqrt(toCx * toCx + toCy * toCy);

                        if (toD > 0.1) {
                            // Perpendicular direction (tangent to centroid)
                            const perpX = -toCy / toD;
                            const perpY = toCx / toD;

                            // Fade: 1.0 at energy=1.0, 0.0 at energy=0.7
                            const fade = Math.min((energy - 0.7) / 0.3, 1);
                            const smoothFade = fade * fade * (3 - 2 * fade);

                            // Very small velocity bias
                            const carrierStrength = 0.05 * smoothFade;

                            node.vx += perpX * carrierStrength;
                            node.vy += perpY * carrierStrength;

                            // RELIABILITY GATE: only store direction if well-defined
                            const centroidEpsilon = 2.0;  // Minimum centroid distance
                            const forceEpsilon = 0.5;     // Minimum net force
                            const directionReliable = toD > centroidEpsilon || fMag > forceEpsilon;

                            if (directionReliable) {
                                // STORE CARRIER DIRECTION for directional persistence
                                engine.carrierDir.set(node.id, { x: perpX, y: perpY });
                                engine.carrierTimer.set(node.id, 20);  // ~330ms at 60fps
                            } else {
                                // Direction ill-defined - HARD DISABLE persistence
                                engine.carrierDir.delete(node.id);
                                engine.carrierTimer.delete(node.id);
                            }
                        } else {
                            // Too close to centroid - disable persistence
                            engine.carrierDir.delete(node.id);
                            engine.carrierTimer.delete(node.id);
                        }
                    }
                }
            }

            // DIRECTIONAL PERSISTENCE: filter spring forces that oppose carrier direction
            const cDir = engine.carrierDir.get(node.id);
            const cTimer = engine.carrierTimer.get(node.id) || 0;

            if (cDir && cTimer > 0) {
                // Decrement timer
                engine.carrierTimer.set(node.id, cTimer - 1);

                // Check if velocity exceeds threshold (symmetry broken, persistence no longer needed)
                const vMagNow = Math.sqrt(node.vx * node.vx + node.vy * node.vy);
                if (vMagNow > 3.0) {
                    // Clear persistence
                    engine.carrierDir.delete(node.id);
                    engine.carrierTimer.delete(node.id);
                } else {
                    // Filter spring force: project out component opposing carrier direction
                    const fDotC = node.fx * cDir.x + node.fy * cDir.y;
                    if (fDotC < 0) {
                        // Force opposes carrier direction - remove opposing component
                        const filterStrength = 0.7;  // How much to filter (1.0 = complete)
                        node.fx -= fDotC * cDir.x * filterStrength;
                        node.fy -= fDotC * cDir.y * filterStrength;
                    }
                }
            } else if (cTimer <= 0 && cDir) {
                // Timer expired, clear carrier direction
                engine.carrierDir.delete(node.id);
                engine.carrierTimer.delete(node.id);
            }
        }

        // Apply unified damping (increases as energy falls)
        node.vx *= (1 - effectiveDamping * dt * 5.0);
        node.vy *= (1 - effectiveDamping * dt * 5.0);

        // HUB INERTIA: High-degree nodes feel heavier (slower velocity response)
        // This is mass-like behavior during velocity integration, NOT damping
        // Computed inline to avoid second loop
        let nodeDeg = 0;
        for (const link of engine.links) {
            if (link.source === node.id || link.target === node.id) nodeDeg++;
        }
        if (nodeDeg > 2) {
            const hubFactor = Math.min((nodeDeg - 2) / 4, 1);
            const hubVelocityScale = 0.7;  // How slow hubs respond
            const velScale = 1.0 - hubFactor * (1.0 - hubVelocityScale);
            node.vx *= velScale;
            node.vy *= velScale;
        }

        // Clamp Velocity
        const vSq = node.vx * node.vx + node.vy * node.vy;
        if (vSq > maxVelocityEffective * maxVelocityEffective) {
            const v = Math.sqrt(vSq);
            node.vx = (node.vx / v) * maxVelocityEffective;
            node.vy = (node.vy / v) * maxVelocityEffective;
            clampHitCount++;
        }

        // Update Position
        node.x += node.vx * dt;
        node.y += node.vy * dt;

        // Sleep Check (optional - keeps physics running but zeros micro-motion)
        if (engine.config.velocitySleepThreshold) {
            const velSq = node.vx * node.vx + node.vy * node.vy;
            const threshSq = engine.config.velocitySleepThreshold * engine.config.velocitySleepThreshold;
            if (velSq < threshSq) {
                node.vx = 0;
                node.vy = 0;
            }
        }
    }

    return {
        centroidX,
        centroidY,
    };
};
