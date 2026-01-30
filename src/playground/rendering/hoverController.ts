import type { RefObject, MutableRefObject } from 'react';
import type { PhysicsEngine } from '../../physics/engine';
import { getNodeRadius, getNodeScale, getTheme } from '../../visual/theme';
import type { ThemeConfig } from '../../visual/theme';
import { smoothstep } from './renderingMath';
import type {
    CameraState,
    HoverState,
    PendingPointerState,
    RenderSettings
} from './renderingTypes';
import { CameraTransform } from './camera';
import { RenderScratch } from './renderScratch';

type HoverControllerDeps = {
    engineRef: RefObject<PhysicsEngine>;
    settingsRef: MutableRefObject<RenderSettings>;
    hoverStateRef: MutableRefObject<HoverState>;
    pendingPointerRef: MutableRefObject<PendingPointerState>;
    cameraRef: MutableRefObject<CameraState>;
};

export const createHoverController = ({
    engineRef,
    settingsRef,
    hoverStateRef,
    pendingPointerRef,
    cameraRef
}: HoverControllerDeps) => {
    const getRenderedNodeRadius = (
        node: { radius: number },
        theme: ThemeConfig
    ) => {
        const baseRadius = settingsRef.current.useVariedSize ? node.radius : 5.0;
        return getNodeRadius(baseRadius, theme);
    };



    const evaluateNode = (
        node: { id: string; x: number; y: number; radius: number; label?: string },
        worldX: number,
        worldY: number,
        theme: ThemeConfig,
        zoom: number, // Fix 24: Passing zoom for screen-space stability
        checkLabel: boolean = false
    ) => {
        const dx = node.x - worldX;
        const dy = node.y - worldY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Fix 24: Zoom-Stable Sensitivity
        // Interpret hover padding as SCREEN PIXELS, not world units.
        // This ensures the "feel" (hit target size) is constant.
        const effectivePadding = theme.hoverHitPaddingPx / Math.max(0.1, zoom);
        const effectiveHaloPadding = theme.hoverHaloPaddingPx / Math.max(0.1, zoom);

        const renderRadius = getRenderedNodeRadius(node, theme);
        const maxScale = getNodeScale(1.0, theme);
        const scaledRenderRadius = renderRadius * maxScale;

        const outerRadius = theme.nodeStyle === 'ring'
            ? scaledRenderRadius + theme.ringWidth * 0.5
            : scaledRenderRadius;

        // Use effective padding
        const hitRadius = outerRadius + effectivePadding;
        const haloRadius = outerRadius * theme.hoverHaloMultiplier + effectiveHaloPadding;

        // const { outerRadius, hitRadius, haloRadius } = getInteractionRadii(node, theme); 
        // Inlined above to support zoom scaling without changing getInteractionRadii signature everywhere blindly

        let targetEnergy = 0;
        let isLabelHit = false;

        // 1. Core Hit Test (Glow/Halo)
        if (dist <= hitRadius) {
            targetEnergy = 1;
        } else if (dist <= haloRadius) {
            const t = (haloRadius - dist) / (haloRadius - outerRadius);
            targetEnergy = smoothstep(t);
        }

        // 2. Label Hit Test (User Eyes)
        if (checkLabel && theme.labelEnabled && targetEnergy < 1) {
            const label = node.label || node.id;
            // Approx font width: 0.6em per char (common simplified metric for sans-serif)
            const fontSize = theme.labelFontSize;
            const charWidth = fontSize * 0.6;
            const textWidth = label.length * charWidth;
            const textHeight = fontSize; // Line height approx

            // Replicate offset logic from graphDraw.ts (assume energy=0 for idle state pick)
            // Picking usually happens when idle or active, if active, it's easier.
            // Conservative: use base offset (energy=0) to ensure picking works from afar
            const offsetY = outerRadius + theme.labelOffsetBasePx;

            const labelCenterX = node.x;
            const labelTopY = node.y + offsetY;

            // Simple AABB check (ignoring rotation for simplicity/perf, or if rotation is small)
            // If labelForceHorizontal is true, we should strictly check against unrotated client rect, 
            // but we are in world space.
            // World space label is: (node.x, node.y + offset).
            // AABB centered on X.
            const halfW = textWidth / 2;
            const pad = 4; // Padding

            if (
                worldX >= labelCenterX - halfW - pad &&
                worldX <= labelCenterX + halfW + pad &&
                worldY >= labelTopY - pad &&
                worldY <= labelTopY + textHeight + pad
            ) {
                targetEnergy = 1;
                isLabelHit = true;
            }
        }

        return {
            nodeId: node.id,
            dist: isLabelHit ? 0 : dist, // Hack: Treat label hit as 0 dist (perfect match)
            renderedRadius: outerRadius,
            hitRadius,
            haloRadius,
            targetEnergy
        };
    };

    const findNearestNode = (
        worldX: number,
        worldY: number,
        theme: ThemeConfig,
        renderScratch?: RenderScratch
    ) => {
        const engine = engineRef.current;
        if (!engine) return {
            nodeId: null,
            dist: Infinity,
            renderedRadius: 0,
            hitRadius: 0,
            haloRadius: 0,
            targetEnergy: 0,
            scanned: 0
        };

        let nearestId: string | null = null;
        let nearestDist = Infinity;
        let nearestRenderedRadius = 0;
        let nearestHitRadius = 0;
        let nearestHaloRadius = 0;
        let scanned = 0;

        const zoom = cameraRef.current.zoom;
        const nodes = engine.getNodeList(); // Cached array

        const checkCandidate = (node: any) => {
            scanned++;
            const candidate = evaluateNode(node, worldX, worldY, theme, zoom, true);

            // Fix 8: Z-Order Determinism
            if (candidate.dist <= candidate.haloRadius && candidate.dist <= nearestDist) {
                nearestId = candidate.nodeId;
                nearestDist = candidate.dist;
                nearestRenderedRadius = candidate.renderedRadius;
                nearestHitRadius = candidate.hitRadius;
                nearestHaloRadius = candidate.haloRadius;
            }
        };

        if (renderScratch) {
            // FIX 54: Spatial Grid Query (O(1))
            renderScratch.hitGrid.query(worldX, worldY, (index) => {
                if (index < nodes.length) {
                    checkCandidate(nodes[index]);
                }
            });
            // If grid missed but we are in valid bounds? 
            // Grid covers all visible nodes. If cursor is on a visible node, grid finds it.
        } else {
            // Fallback O(N)
            for (const node of engine.nodes.values()) {
                checkCandidate(node);
            }
        }

        let targetEnergy = 0;
        if (nearestId !== null) {
            if (nearestDist <= nearestHitRadius) {
                targetEnergy = 1;
            } else {
                const t = (nearestHaloRadius - nearestDist) / (nearestHaloRadius - nearestRenderedRadius);
                targetEnergy = smoothstep(t);
            }
        }

        return {
            nodeId: nearestId,
            dist: nearestDist,
            renderedRadius: nearestRenderedRadius,
            hitRadius: nearestHitRadius,
            haloRadius: nearestHaloRadius,
            targetEnergy,
            scanned
        };
    };

    const findNearestNodeExcluding = (
        worldX: number,
        worldY: number,
        theme: ThemeConfig,
        excludeId: string | null
    ) => {
        const engine = engineRef.current;
        if (!engine) return {
            nodeId: null,
            dist: Infinity,
            renderedRadius: 0,
            hitRadius: 0,
            haloRadius: 0,
            targetEnergy: 0,
            scanned: 0
        };

        let nearest: ReturnType<typeof evaluateNode> | null = null;
        let scanned = 0;
        const zoom = cameraRef.current.zoom;
        for (const node of engine.nodes.values()) {
            if (excludeId && node.id === excludeId) continue;
            scanned++;
            const result = evaluateNode(node, worldX, worldY, theme, zoom);
            if (result.dist <= result.haloRadius && result.dist < (nearest?.dist ?? Infinity)) {
                nearest = result;
                if (result.dist <= result.renderedRadius * 0.3 || result.dist === 0) {
                    break;
                }
            }
        }

        if (nearest) {
            return { ...nearest, scanned };
        }
        return {
            nodeId: null,
            dist: Infinity,
            renderedRadius: 0,
            hitRadius: 0,
            haloRadius: 0,
            targetEnergy: 0,
            scanned
        };
    };

    const clientToWorld = (clientX: number, clientY: number, rect: DOMRect, cameraOverride?: CameraState) => {
        const camera = cameraOverride || cameraRef.current;
        const engine = engineRef.current;
        const centroid = engine ? engine.getCentroid() : { x: 0, y: 0 };
        const angle = engine ? engine.getGlobalAngle() : 0;

        if (rect.width <= 0 || rect.height <= 0) {
            return { x: 0, y: 0, sx: 0, sy: 0 };
        }

        const transform = new CameraTransform(
            rect.width,
            rect.height,
            camera.zoom,
            camera.panX,
            camera.panY,
            angle,
            centroid,
            1.0, // Fix 58: Pass explicit DPR (1.0 for World coords)
            settingsRef.current.pixelSnapping
        );

        const world = transform.clientToWorld(clientX, clientY, rect);

        const sxRaw = clientX - rect.left;
        const syRaw = clientY - rect.top;

        return { x: world.x, y: world.y, sx: sxRaw, sy: syRaw };
    };

    const worldToScreen = (worldX: number, worldY: number, rect: DOMRect) => {
        const camera = cameraRef.current;
        const engine = engineRef.current;
        const centroid = engine ? engine.getCentroid() : { x: 0, y: 0 };
        const angle = engine ? engine.getGlobalAngle() : 0;

        const transform = new CameraTransform(
            rect.width,
            rect.height,
            camera.zoom,
            camera.panX,
            camera.panY,
            angle,
            centroid,
            1.0, // Fix 58: Pass explicit 1.0 (or we need true DPR from somewhere)
            settingsRef.current.pixelSnapping
        );

        return transform.worldToScreen(worldX, worldY);
    };

    const logPointerEvent = (
        label: string,
        pointerId: number,
        pointerType: string
    ) => {
        if (!getTheme(settingsRef.current.skinMode).hoverDebugEnabled) return;
        console.log(
            `${label} id=${pointerId} type=${pointerType} active=${hoverStateRef.current.activePointerId} hovered=${hoverStateRef.current.hoveredNodeId}`
        );
    };

    const clearHover = (label: string, pointerId: number, pointerType: string) => {
        logPointerEvent(label, pointerId, pointerType);
        const theme = getTheme(settingsRef.current.skinMode);
        if (theme.hoverDebugEnabled) {
            console.log(`hover clear: ${label}`);
        }
        hoverStateRef.current.activePointerId = null;
        hoverStateRef.current.hoveredNodeId = null;
        hoverStateRef.current.hoverDisplayNodeId = null;
        hoverStateRef.current.hoveredDistPx = 0;
        hoverStateRef.current.lastLoggedId = null;
        hoverStateRef.current.lastDecision = `exited (${label})`;
        hoverStateRef.current.nearestCandidateId = null;
        hoverStateRef.current.nearestCandidateDist = Infinity;
        hoverStateRef.current.energy = 0;
        hoverStateRef.current.targetEnergy = 0;
        hoverStateRef.current.hitRadius = 0;
        hoverStateRef.current.haloRadius = 0;
        hoverStateRef.current.hoverHoldUntilMs = 0;
        hoverStateRef.current.lastInsideMs = 0;
        hoverStateRef.current.pendingSwitchId = null;
        hoverStateRef.current.pendingSwitchSinceMs = 0;
        hoverStateRef.current.hasPointer = false;
        pendingPointerRef.current.hasPending = false;
    };

    const handlePointerMove = (
        pointerId: number,
        pointerType: string,
        clientX: number,
        clientY: number,
        _rect: DOMRect
    ) => {
        if (pointerType === 'touch') {
            return;
        }

        if (hoverStateRef.current.activePointerId === null) {
            hoverStateRef.current.activePointerId = pointerId;
        } else if (hoverStateRef.current.activePointerId !== pointerId) {
            return;
        }

        pendingPointerRef.current.clientX = clientX;
        pendingPointerRef.current.clientY = clientY;
        pendingPointerRef.current.pointerId = pointerId;
        pendingPointerRef.current.pointerType = pointerType;
        pendingPointerRef.current.hasPending = true;
    };

    const handlePointerEnter = (pointerId: number, pointerType: string) => {
        logPointerEvent('pointerenter', pointerId, pointerType);
    };

    const handlePointerLeave = (pointerId: number, pointerType: string) => {
        if (hoverStateRef.current.activePointerId === null || hoverStateRef.current.activePointerId === pointerId) {
            clearHover('pointerleave', pointerId, pointerType);
        }
    };

    const handlePointerCancel = (pointerId: number, pointerType: string) => {
        if (hoverStateRef.current.activePointerId === null || hoverStateRef.current.activePointerId === pointerId) {
            clearHover('pointercancel', pointerId, pointerType);
        }
    };

    const handlePointerUp = (pointerId: number, pointerType: string) => {
        if (pointerType === 'touch') {
            clearHover('pointerup', pointerId, pointerType);
            return;
        }
        if (hoverStateRef.current.activePointerId === pointerId) {
            clearHover('pointerup', pointerId, pointerType);
        }
    };

    const updateHoverSelection = (
        clientX: number,
        clientY: number,
        rect: DOMRect,
        theme: ThemeConfig,
        reason: 'pointer' | 'camera',
        lockedNodeId: string | null = null,
        renderScratch?: RenderScratch // Fix 54
    ) => {
        const { x: worldX, y: worldY, sx, sy } = clientToWorld(clientX, clientY, rect);

        hoverStateRef.current.cursorWorldX = worldX;
        hoverStateRef.current.cursorWorldY = worldY;
        hoverStateRef.current.cursorScreenX = sx;
        hoverStateRef.current.cursorScreenY = sy;
        hoverStateRef.current.cursorClientX = clientX;
        hoverStateRef.current.cursorClientY = clientY;
        hoverStateRef.current.cursorClientY = clientY;
        hoverStateRef.current.hasPointer = true;
        // FIX 35: Stale Hover (Persist Pointer)
        hoverStateRef.current.lastClientX = clientX;
        hoverStateRef.current.lastClientY = clientY;

        // [HoverDbg] Forensic Instrumentation
        if (theme.hoverDebugEnabled && renderScratch) {
            // Check if we are "live" but grid is empty
            const gridStats = renderScratch.hitGrid.stats();
            if (gridStats.items === 0 && engineRef.current && engineRef.current.nodes.size > 0) {
                // Throttle warning
                if (Math.random() < 0.05) {
                    console.warn(`[HoverDbg] Grid EMPTY but nodes exist! (n=${engineRef.current.nodes.size})`);
                }
            }
            if (Math.random() < 0.01) {
                console.log(
                    `[HoverDbg] world=(${worldX.toFixed(1)}, ${worldY.toFixed(1)}) ` +
                    `grid={b:${gridStats.buckets}, i:${gridStats.items}}`
                );
            }
        }

        const nowMs = performance.now();
        const currentHoveredId = hoverStateRef.current.hoveredNodeId;
        let nodesScanned = 0;

        let newHoveredId = currentHoveredId;
        let shouldSwitch = false;

        // Hoisted variables (Fix 46 Scope Issue)
        let decision = 'kept';
        let nextTargetEnergy = hoverStateRef.current.targetEnergy;
        let nextRenderedRadius = hoverStateRef.current.renderedRadius;
        let nextHitRadius = hoverStateRef.current.hitRadius;
        let nextHaloRadius = hoverStateRef.current.haloRadius;
        let nextDist = hoverStateRef.current.hoveredDistPx;
        let nextHoldUntil = hoverStateRef.current.hoverHoldUntilMs;
        let nextLastInsideMs = hoverStateRef.current.lastInsideMs;
        let nextPendingSwitchId = hoverStateRef.current.pendingSwitchId;
        let nextPendingSinceMs = hoverStateRef.current.pendingSwitchSinceMs;

        // FIX 46: Locked Mode (Drag Force)
        // If locked (drag in progress), bypass search.
        if (lockedNodeId) {
            if (currentHoveredId !== lockedNodeId) {
                // Force switch
                shouldSwitch = true;
                newHoveredId = lockedNodeId;
                decision = 'locked (drag)';
            }
            // Ensure visualization parameters are fresh for the locked node (keep it glowing)
            const engine = engineRef.current;
            const node = engine ? engine.nodes.get(lockedNodeId) : null;
            if (node) {
                const result = evaluateNode(node, worldX, worldY, theme, cameraRef.current.zoom);
                nextTargetEnergy = 1.0; // Force full energy
                nextRenderedRadius = result.renderedRadius;
                nextHitRadius = result.hitRadius;
                nextHaloRadius = result.haloRadius;
                nextDist = result.dist;
                nextLastInsideMs = nowMs;
                nextHoldUntil = nowMs + theme.minHoverHoldMs;
            }
            // Skip the search block below
        } else {
            // NORMAL SEARCH LOGIC
            if (currentHoveredId === null) {
                const result = findNearestNode(worldX, worldY, theme, renderScratch);
                nodesScanned = result.scanned;
                shouldSwitch = result.nodeId !== null;
                if (shouldSwitch) {
                    newHoveredId = result.nodeId;
                    nextTargetEnergy = result.targetEnergy;
                    nextRenderedRadius = result.renderedRadius;
                    nextHitRadius = result.hitRadius;
                    nextHaloRadius = result.haloRadius;
                    nextDist = result.dist;
                    nextHoldUntil = nowMs + theme.minHoverHoldMs;
                    nextLastInsideMs = nowMs;
                    nextPendingSwitchId = null;
                    nextPendingSinceMs = 0;
                    decision = 'switched (acquire)';
                }
                hoverStateRef.current.nearestCandidateId = result.nodeId;
                hoverStateRef.current.nearestCandidateDist = result.dist;
            } else {
                const engine = engineRef.current;
                const currentNode = engine ? engine.nodes.get(currentHoveredId) : null;
                const currentEval = currentNode ? evaluateNode(currentNode, worldX, worldY, theme, cameraRef.current.zoom) : null;

                if (currentEval) {
                    const stickyHalo = currentEval.haloRadius * theme.hoverStickyExitMultiplier;
                    hoverStateRef.current.nearestCandidateId = null;
                    hoverStateRef.current.nearestCandidateDist = Infinity;
                    nodesScanned = 1;

                    if (currentEval.dist <= currentEval.haloRadius) {
                        nextLastInsideMs = nowMs;
                    }

                    const exitGracePassed = !theme.calmModeEnabled ||
                        nowMs - nextLastInsideMs > theme.exitGraceMs;

                    if (currentEval.dist > stickyHalo && exitGracePassed) {
                        const candidate = findNearestNodeExcluding(worldX, worldY, theme, null);
                        nodesScanned = candidate.scanned;
                        hoverStateRef.current.nearestCandidateId = candidate.nodeId;
                        hoverStateRef.current.nearestCandidateDist = candidate.dist;
                        if (candidate.nodeId !== null) {
                            shouldSwitch = true;
                            newHoveredId = candidate.nodeId;
                            nextTargetEnergy = candidate.targetEnergy;
                            nextRenderedRadius = candidate.renderedRadius;
                            nextHitRadius = candidate.hitRadius;
                            nextHaloRadius = candidate.haloRadius;
                            nextDist = candidate.dist;
                            nextHoldUntil = nowMs + theme.minHoverHoldMs;
                            nextLastInsideMs = nowMs;
                            nextPendingSwitchId = null;
                            nextPendingSinceMs = 0;
                            decision = 'switched (exited)';
                        } else {
                            shouldSwitch = true;
                            newHoveredId = null;
                            nextTargetEnergy = 0;
                            nextRenderedRadius = 0;
                            nextHitRadius = 0;
                            nextHaloRadius = 0;
                            nextDist = currentEval.dist;
                            nextHoldUntil = 0;
                            nextPendingSwitchId = null;
                            nextPendingSinceMs = 0;
                            decision = 'exited (beyond halo)';
                        }
                    } else if (currentEval.dist > stickyHalo && !exitGracePassed) {
                        shouldSwitch = true;
                        newHoveredId = currentHoveredId;
                        nextTargetEnergy = currentEval.targetEnergy;
                        nextRenderedRadius = currentEval.renderedRadius;
                        nextHitRadius = currentEval.hitRadius;
                        nextHaloRadius = currentEval.haloRadius;
                        nextDist = currentEval.dist;
                        decision = 'kept (exit grace)';
                    } else if (reason === 'pointer') {
                        const candidate = findNearestNodeExcluding(worldX, worldY, theme, currentHoveredId);
                        nodesScanned = candidate.scanned;
                        hoverStateRef.current.nearestCandidateId = candidate.nodeId;
                        hoverStateRef.current.nearestCandidateDist = candidate.dist;
                        if (
                            candidate.nodeId &&
                            candidate.dist + theme.hoverSwitchMarginPx < currentEval.dist
                        ) {
                            if (!theme.calmModeEnabled || theme.switchDebounceMs <= 0) {
                                shouldSwitch = true;
                                newHoveredId = candidate.nodeId;
                                nextTargetEnergy = candidate.targetEnergy;
                                nextRenderedRadius = candidate.renderedRadius;
                                nextHitRadius = candidate.hitRadius;
                                nextHaloRadius = candidate.haloRadius;
                                nextDist = candidate.dist;
                                nextHoldUntil = nowMs + theme.minHoverHoldMs;
                                nextLastInsideMs = nowMs;
                                nextPendingSwitchId = null;
                                nextPendingSinceMs = 0;
                                decision = 'switched (margin)';
                            } else if (theme.calmModeEnabled && nowMs < nextHoldUntil) {
                                shouldSwitch = true;
                                newHoveredId = currentHoveredId;
                                nextTargetEnergy = currentEval.targetEnergy;
                                nextRenderedRadius = currentEval.renderedRadius;
                                nextHitRadius = currentEval.hitRadius;
                                nextHaloRadius = currentEval.haloRadius;
                                nextDist = currentEval.dist;
                                decision = 'kept: hold';
                            } else {
                                if (nextPendingSwitchId !== candidate.nodeId) {
                                    nextPendingSwitchId = candidate.nodeId;
                                    nextPendingSinceMs = nowMs;
                                    shouldSwitch = true;
                                    newHoveredId = currentHoveredId;
                                    nextTargetEnergy = currentEval.targetEnergy;
                                    nextRenderedRadius = currentEval.renderedRadius;
                                    nextHitRadius = currentEval.hitRadius;
                                    nextHaloRadius = currentEval.haloRadius;
                                    nextDist = currentEval.dist;
                                    decision = 'kept: debounce';
                                } else if (nowMs - nextPendingSinceMs >= theme.switchDebounceMs) {
                                    shouldSwitch = true;
                                    newHoveredId = candidate.nodeId;
                                    nextTargetEnergy = candidate.targetEnergy;
                                    nextRenderedRadius = candidate.renderedRadius;
                                    nextHitRadius = candidate.hitRadius;
                                    nextHaloRadius = candidate.haloRadius;
                                    nextDist = candidate.dist;
                                    nextHoldUntil = nowMs + theme.minHoverHoldMs;
                                    nextLastInsideMs = nowMs;
                                    nextPendingSwitchId = null;
                                    nextPendingSinceMs = 0;
                                    decision = 'switched: debounce satisfied';
                                } else {
                                    shouldSwitch = true;
                                    newHoveredId = currentHoveredId;
                                    nextTargetEnergy = currentEval.targetEnergy;
                                    nextRenderedRadius = currentEval.renderedRadius;
                                    nextHitRadius = currentEval.hitRadius;
                                    nextHaloRadius = currentEval.haloRadius;
                                    nextDist = currentEval.dist;
                                    decision = 'kept: debounce';
                                }
                            }
                        } else {
                            shouldSwitch = true;
                            newHoveredId = currentHoveredId;
                            nextTargetEnergy = currentEval.targetEnergy;
                            nextRenderedRadius = currentEval.renderedRadius;
                            nextHitRadius = currentEval.hitRadius;
                            nextHaloRadius = currentEval.haloRadius;
                            nextDist = currentEval.dist;
                            nextPendingSwitchId = null;
                            nextPendingSinceMs = 0;
                            decision = 'kept (active)';
                        }
                    } else {
                        shouldSwitch = true;
                        newHoveredId = currentHoveredId;
                        nextTargetEnergy = currentEval.targetEnergy;
                        nextRenderedRadius = currentEval.renderedRadius;
                        nextHitRadius = currentEval.hitRadius;
                        nextHaloRadius = currentEval.haloRadius;
                        nextDist = currentEval.dist;
                        nextPendingSwitchId = null;
                        nextPendingSinceMs = 0;
                        decision = 'kept (active)';
                    }
                } else {
                    shouldSwitch = true;
                    newHoveredId = null;
                    nextTargetEnergy = 0;
                    nextRenderedRadius = 0;
                    nextHitRadius = 0;
                    nextHaloRadius = 0;
                    nextDist = Infinity;
                    nextHoldUntil = 0;
                    nextPendingSwitchId = null;
                    nextPendingSinceMs = 0;
                    decision = 'exited (missing node)';
                }
            }
        } // END IF/ELSE (Locked vs Normal)

        hoverStateRef.current.nodesScannedLastSelection = nodesScanned;
        hoverStateRef.current.selectionRunCount += 1;

        if (shouldSwitch) {
            const prevId = hoverStateRef.current.hoveredNodeId;

            if (prevId !== null && newHoveredId !== null && prevId !== newHoveredId) {
                hoverStateRef.current.energy = Math.min(
                    hoverStateRef.current.energy,
                    nextTargetEnergy
                );
            }

            hoverStateRef.current.hoveredNodeId = newHoveredId;
            if (newHoveredId !== null) {
                hoverStateRef.current.hoverDisplayNodeId = newHoveredId;
            }
            hoverStateRef.current.hoveredDistPx = nextDist;
            hoverStateRef.current.targetEnergy = nextTargetEnergy;
            hoverStateRef.current.renderedRadius = nextRenderedRadius;
            hoverStateRef.current.hitRadius = nextHitRadius;
            hoverStateRef.current.haloRadius = nextHaloRadius;
            hoverStateRef.current.hoverHoldUntilMs = nextHoldUntil;
            hoverStateRef.current.lastInsideMs = nextLastInsideMs;
            hoverStateRef.current.pendingSwitchId = nextPendingSwitchId;
            hoverStateRef.current.pendingSwitchSinceMs = nextPendingSinceMs;
            hoverStateRef.current.lastDecision = decision;

            if (theme.hoverDebugEnabled && (
                newHoveredId !== hoverStateRef.current.lastLoggedId ||
                decision.startsWith('switched') ||
                decision.startsWith('exited')
            )) {
                const camera = cameraRef.current;
                const engine = engineRef.current;
                const centroid = engine ? engine.getCentroid() : { x: 0, y: 0 };
                const angle = engine ? engine.getGlobalAngle() : 0;
                console.log(
                    `hover: ${hoverStateRef.current.lastLoggedId} -> ${newHoveredId} ` +
                    `(dist=${nextDist.toFixed(1)}, r=${nextRenderedRadius.toFixed(1)}, ` +
                    `hit=${nextHitRadius.toFixed(1)}, halo=${nextHaloRadius.toFixed(1)}, ` +
                    `energy=${nextTargetEnergy.toFixed(2)}) ` +
                    `hold=${Math.max(0, nextHoldUntil - nowMs).toFixed(0)}ms ` +
                    `pending=${nextPendingSwitchId ?? 'null'} ` +
                    `pendingAge=${nextPendingSwitchId ? (nowMs - nextPendingSinceMs).toFixed(0) : 0}ms ` +
                    `client=(${clientX.toFixed(1)},${clientY.toFixed(1)}) ` +
                    `sx=${sx.toFixed(1)} sy=${sy.toFixed(1)} ` +
                    `world=(${worldX.toFixed(1)},${worldY.toFixed(1)}) ` +
                    `cam=(${camera.panX.toFixed(1)},${camera.panY.toFixed(1)}) z=${camera.zoom.toFixed(3)} ` +
                    `angle=${angle.toFixed(3)} ` +
                    `centroid=(${centroid.x.toFixed(1)},${centroid.y.toFixed(1)}) ` +
                    `decision=${decision}`
                );
                hoverStateRef.current.lastLoggedId = newHoveredId;
            }
        }

        const camera = cameraRef.current;
        const engine = engineRef.current;
        const centroid = engine ? engine.getCentroid() : { x: 0, y: 0 };
        const angle = engine ? engine.getGlobalAngle() : 0;
        hoverStateRef.current.lastSelectionPanX = camera.panX;
        hoverStateRef.current.lastSelectionPanY = camera.panY;
        hoverStateRef.current.lastSelectionZoom = camera.zoom;
        hoverStateRef.current.lastSelectionAngle = angle;
        hoverStateRef.current.lastSelectionCentroidX = centroid.x;
        hoverStateRef.current.lastSelectionCentroidY = centroid.y;
    };

    return {
        clientToWorld,
        worldToScreen,
        updateHoverSelection,
        handlePointerMove,
        handlePointerEnter,
        handlePointerLeave,
        handlePointerCancel,
        handlePointerUp,
        clearHover
    };
};
