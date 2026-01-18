import type { RefObject, MutableRefObject } from 'react';
import type { PhysicsEngine } from '../../physics/engine';
import { getNodeRadius, getTheme } from '../../visual/theme';
import type { ThemeConfig } from '../../visual/theme';
import { rotateAround, smoothstep } from './renderingMath';
import type {
    CameraState,
    HoverState,
    PendingPointerState,
    RenderSettingsRef
} from './renderingTypes';

type HoverControllerDeps = {
    engineRef: RefObject<PhysicsEngine>;
    settingsRef: MutableRefObject<RenderSettingsRef>;
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

    const getInteractionRadii = (
        node: { radius: number },
        theme: ThemeConfig
    ) => {
        const renderRadius = getRenderedNodeRadius(node, theme);
        const outerRadius = theme.nodeStyle === 'ring'
            ? renderRadius + theme.ringWidth * 0.5
            : renderRadius;
        const hitRadius = outerRadius + theme.hoverHitPaddingPx;
        const haloRadius = outerRadius * theme.hoverHaloMultiplier + theme.hoverHaloPaddingPx;
        return { renderRadius, outerRadius, hitRadius, haloRadius };
    };

    const evaluateNode = (
        node: { id: string; x: number; y: number; radius: number },
        worldX: number,
        worldY: number,
        theme: ThemeConfig
    ) => {
        const dx = node.x - worldX;
        const dy = node.y - worldY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        const { outerRadius, hitRadius, haloRadius } = getInteractionRadii(node, theme);

        let targetEnergy = 0;
        if (dist <= hitRadius) {
            targetEnergy = 1;
        } else if (dist <= haloRadius) {
            const t = (haloRadius - dist) / (haloRadius - outerRadius);
            targetEnergy = smoothstep(t);
        }

        return {
            nodeId: node.id,
            dist,
            renderedRadius: outerRadius,
            hitRadius,
            haloRadius,
            targetEnergy
        };
    };

    const findNearestNode = (worldX: number, worldY: number, theme: ThemeConfig) => {
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

        for (const node of engine.nodes.values()) {
            scanned++;
            const dx = node.x - worldX;
            const dy = node.y - worldY;
            const dist = Math.sqrt(dx * dx + dy * dy);

            const { outerRadius, hitRadius, haloRadius } = getInteractionRadii(node, theme);

            if (dist <= haloRadius && dist < nearestDist) {
                nearestId = node.id;
                nearestDist = dist;
                nearestRenderedRadius = outerRadius;
                nearestHitRadius = hitRadius;
                nearestHaloRadius = haloRadius;
                if (dist <= outerRadius * 0.3 || dist === 0) {
                    break;
                }
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
        for (const node of engine.nodes.values()) {
            if (excludeId && node.id === excludeId) continue;
            scanned++;
            const result = evaluateNode(node, worldX, worldY, theme);
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

    const clientToWorld = (clientX: number, clientY: number, rect: DOMRect) => {
        const camera = cameraRef.current;
        const engine = engineRef.current;
        const centroid = engine ? engine.getCentroid() : { x: 0, y: 0 };
        const angle = engine ? engine.getGlobalAngle() : 0;

        if (rect.width <= 0 || rect.height <= 0) {
            return { x: 0, y: 0, sx: 0, sy: 0 };
        }

        const sx = clientX - rect.left;
        const sy = clientY - rect.top;
        const cssX = sx - rect.width / 2;
        const cssY = sy - rect.height / 2;

        const unrotatedX = cssX / camera.zoom - camera.panX;
        const unrotatedY = cssY / camera.zoom - camera.panY;
        const world = rotateAround(unrotatedX, unrotatedY, centroid.x, centroid.y, -angle);

        return { x: world.x, y: world.y, sx, sy };
    };

    const worldToScreen = (worldX: number, worldY: number, rect: DOMRect) => {
        const camera = cameraRef.current;
        const engine = engineRef.current;
        const centroid = engine ? engine.getCentroid() : { x: 0, y: 0 };
        const angle = engine ? engine.getGlobalAngle() : 0;

        const rotated = rotateAround(worldX, worldY, centroid.x, centroid.y, angle);
        const viewX = (rotated.x + camera.panX) * camera.zoom;
        const viewY = (rotated.y + camera.panY) * camera.zoom;
        return {
            x: viewX + rect.width / 2,
            y: viewY + rect.height / 2
        };
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
        hoverStateRef.current.activePointerId = null;
        hoverStateRef.current.hoveredNodeId = null;
        hoverStateRef.current.hoveredDistPx = 0;
        hoverStateRef.current.lastLoggedId = null;
        hoverStateRef.current.lastDecision = `exited (${label})`;
        hoverStateRef.current.nearestCandidateId = null;
        hoverStateRef.current.nearestCandidateDist = Infinity;
        hoverStateRef.current.targetEnergy = 0;
        hoverStateRef.current.hitRadius = 0;
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
        reason: 'pointer' | 'camera'
    ) => {
        const { x: worldX, y: worldY, sx, sy } = clientToWorld(clientX, clientY, rect);

        hoverStateRef.current.cursorWorldX = worldX;
        hoverStateRef.current.cursorWorldY = worldY;
        hoverStateRef.current.cursorScreenX = sx;
        hoverStateRef.current.cursorScreenY = sy;
        hoverStateRef.current.cursorClientX = clientX;
        hoverStateRef.current.cursorClientY = clientY;
        hoverStateRef.current.hasPointer = true;

        const currentHoveredId = hoverStateRef.current.hoveredNodeId;
        let nodesScanned = 0;

        let newHoveredId = currentHoveredId;
        let shouldSwitch = false;
        let decision = 'kept';
        let nextTargetEnergy = hoverStateRef.current.targetEnergy;
        let nextRenderedRadius = hoverStateRef.current.renderedRadius;
        let nextHitRadius = hoverStateRef.current.hitRadius;
        let nextHaloRadius = hoverStateRef.current.haloRadius;
        let nextDist = hoverStateRef.current.hoveredDistPx;

        if (currentHoveredId === null) {
            const result = findNearestNode(worldX, worldY, theme);
            nodesScanned = result.scanned;
            shouldSwitch = result.nodeId !== null;
            if (shouldSwitch) {
                newHoveredId = result.nodeId;
                nextTargetEnergy = result.targetEnergy;
                nextRenderedRadius = result.renderedRadius;
                nextHitRadius = result.hitRadius;
                nextHaloRadius = result.haloRadius;
                nextDist = result.dist;
                decision = 'switched (acquire)';
            }
            hoverStateRef.current.nearestCandidateId = result.nodeId;
            hoverStateRef.current.nearestCandidateDist = result.dist;
        } else {
            const engine = engineRef.current;
            const currentNode = engine ? engine.nodes.get(currentHoveredId) : null;
            const currentEval = currentNode ? evaluateNode(currentNode, worldX, worldY, theme) : null;

            if (currentEval) {
                const stickyHalo = currentEval.haloRadius * theme.hoverStickyExitMultiplier;
                hoverStateRef.current.nearestCandidateId = null;
                hoverStateRef.current.nearestCandidateDist = Infinity;
                nodesScanned = 1;

                if (currentEval.dist > stickyHalo) {
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
                        decision = 'switched (exited)';
                    } else {
                        shouldSwitch = true;
                        newHoveredId = null;
                        nextTargetEnergy = 0;
                        nextRenderedRadius = 0;
                        nextHitRadius = 0;
                        nextHaloRadius = 0;
                        nextDist = currentEval.dist;
                        decision = 'exited (beyond halo)';
                    }
                } else if (reason === 'pointer') {
                    const candidate = findNearestNodeExcluding(worldX, worldY, theme, currentHoveredId);
                    nodesScanned = candidate.scanned;
                    hoverStateRef.current.nearestCandidateId = candidate.nodeId;
                    hoverStateRef.current.nearestCandidateDist = candidate.dist;
                    if (
                        candidate.nodeId &&
                        candidate.dist + theme.hoverSwitchMarginPx < currentEval.dist
                    ) {
                        shouldSwitch = true;
                        newHoveredId = candidate.nodeId;
                        nextTargetEnergy = candidate.targetEnergy;
                        nextRenderedRadius = candidate.renderedRadius;
                        nextHitRadius = candidate.hitRadius;
                        nextHaloRadius = candidate.haloRadius;
                        nextDist = candidate.dist;
                        decision = 'switched (margin)';
                    } else {
                        shouldSwitch = true;
                        newHoveredId = currentHoveredId;
                        nextTargetEnergy = currentEval.targetEnergy;
                        nextRenderedRadius = currentEval.renderedRadius;
                        nextHitRadius = currentEval.hitRadius;
                        nextHaloRadius = currentEval.haloRadius;
                        nextDist = currentEval.dist;
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
                decision = 'exited (missing node)';
            }
        }

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
            hoverStateRef.current.hoveredDistPx = nextDist;
            hoverStateRef.current.targetEnergy = nextTargetEnergy;
            hoverStateRef.current.renderedRadius = nextRenderedRadius;
            hoverStateRef.current.hitRadius = nextHitRadius;
            hoverStateRef.current.haloRadius = nextHaloRadius;
            hoverStateRef.current.lastDecision = decision;

            if (theme.hoverDebugEnabled && newHoveredId !== hoverStateRef.current.lastLoggedId) {
                const camera = cameraRef.current;
                const engine = engineRef.current;
                const centroid = engine ? engine.getCentroid() : { x: 0, y: 0 };
                const angle = engine ? engine.getGlobalAngle() : 0;
                console.log(
                    `hover: ${hoverStateRef.current.lastLoggedId} -> ${newHoveredId} ` +
                    `(dist=${nextDist.toFixed(1)}, r=${nextRenderedRadius.toFixed(1)}, ` +
                    `hit=${nextHitRadius.toFixed(1)}, halo=${nextHaloRadius.toFixed(1)}, ` +
                    `energy=${nextTargetEnergy.toFixed(2)}) ` +
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
