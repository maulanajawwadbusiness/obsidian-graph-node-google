import type { Dispatch, SetStateAction, MutableRefObject } from 'react';
import type { PhysicsEngine } from '../../physics/engine';
import type { ForceConfig } from '../../physics/types';
import { getTheme } from '../../visual/theme';
import { generateRandomGraph } from '../graphRandom';
import type { PlaygroundMetrics } from '../playgroundTypes';
import { updateCameraContainment, CameraTransform } from './camera';
import { drawVignetteBackground, withCtx } from './canvasUtils';
import { updateHoverEnergy } from './hoverEnergy';
import { drawHoverDebugOverlay, drawLabels, drawLinks, drawNodes, drawPointerCrosshair } from './graphDraw';
import { createMetricsTracker } from './metrics';
import {
    CameraState,
    HoverState,
    RenderSettings,
    PendingPointerState,
    RenderDebugInfo,
    SurfaceSnapshot
} from './renderingTypes';
import { RenderScratch } from './renderScratch';
import { textMetricsCache } from './textCache';
import { createOverloadState, createPerfSample, recordPerfSample } from './renderLoopPerf';
import { runPhysicsScheduler, type SchedulerState } from './renderLoopScheduler';
import { updateCanvasSurface } from './renderLoopSurface';
import { enforceCameraSafety, stabilizeCentroid } from './renderLoopCamera';

type Ref<T> = { current: T };

type ThemeConfig = ReturnType<typeof getTheme>;

type UpdateHoverSelection = (
    clientX: number,
    clientY: number,
    rect: DOMRect,
    theme: ThemeConfig,
    reason: 'pointer' | 'camera',
    draggedNodeId: string | null,
    renderScratch?: RenderScratch
) => void;

type GraphRenderLoopDeps = {
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    engine: PhysicsEngine;
    config: ForceConfig;
    seed: number;
    spawnCount: number;
    setMetrics: Dispatch<SetStateAction<PlaygroundMetrics>>;
    cameraRef: Ref<CameraState>;
    settingsRef: Ref<RenderSettings>;
    pendingPointerRef: Ref<PendingPointerState>;
    hoverStateRef: Ref<HoverState>;
    renderDebugRef: Ref<RenderDebugInfo>;
    dragAnchorRef: Ref<{ x: number; y: number } | null>;
    stableCentroidRef: Ref<{ x: number; y: number }>;
    lastSafeCameraRef: Ref<CameraState>;
    activeDprRef: Ref<number>;
    dprStableFramesRef: Ref<number>;
    surfaceSnapshotRef: Ref<SurfaceSnapshot>;
    clientToWorld: (clientX: number, clientY: number, rect: DOMRect) => { x: number; y: number };
    updateHoverSelection: UpdateHoverSelection;
    clearHover: (reason: string, id: number, source: string) => void;
    renderScratch: RenderScratch;
};

const ensureSeededGraph = (engine: PhysicsEngine, config: ForceConfig, seed: number, spawnCount: number) => {
    if (engine.nodes.size === 0) {
        const { nodes, links } = generateRandomGraph(
            spawnCount,
            config.targetSpacing,
            config.initScale,
            seed,
            config.initStrategy,
            config.minNodeDistance
        );
        nodes.forEach(n => engine.addNode(n));
        links.forEach(l => engine.addLink(l));
    }
};

// Hardening Phase 5: Hit Map Cache Invalidation
// We track "generations" of state to invalidate stale hit results.
let globalSurfaceGeneration = 0;

export const updateHoverSelectionIfNeeded = (
    pendingPointerState: PendingPointerState,
    hoverStateRef: MutableRefObject<HoverState>,
    cameraRef: MutableRefObject<CameraState>,
    engine: PhysicsEngine,
    rect: DOMRect,
    theme: ThemeConfig,
    surfaceChanged: boolean,
    renderScratch: RenderScratch,
    updateHoverSelection: (
        x: number,
        y: number,
        rect: DOMRect,
        theme: ThemeConfig,
        trigger: 'pointer' | 'camera',
        draggedNodeId: string | null,
        renderScratch?: RenderScratch
    ) => void
) => {
    // 1. Detect Environmental Changes (Surface or Camera)
    let envChanged = false;

    // Surface Change (Resize/DPR) -> Bump Generation
    if (surfaceChanged) {
        globalSurfaceGeneration++;
        envChanged = true;
    }

    // Camera Change -> Check against stored generation in HoverState (if we had one, or just check values)
    // We'll trust the caller to call this function on every frame.
    // If camera changed significantly, we MUST re-run hit test, even if mouse didn't move.
    // We'll trust the caller to call this function on every frame.
    // If camera changed significantly, we MUST re-run hit test, even if mouse didn't move.
    const camera = cameraRef.current;

    // FIX 31: Knife-Sharp Hover (High Precision Check)
    const EPSILON = 0.0001;
    const sameCam =
        Math.abs(camera.panX - hoverStateRef.current.lastSelectionPanX) < EPSILON &&
        Math.abs(camera.panY - hoverStateRef.current.lastSelectionPanY) < EPSILON &&
        Math.abs(camera.zoom - hoverStateRef.current.lastSelectionZoom) < EPSILON &&
        Math.abs(engine.getGlobalAngle() - hoverStateRef.current.lastSelectionAngle) < EPSILON;

    if (!sameCam) {
        envChanged = true;
    }

    if (globalSurfaceGeneration !== hoverStateRef.current.surfaceGeneration) {
        envChanged = true;
        hoverStateRef.current.surfaceGeneration = globalSurfaceGeneration;
    }

    // 2. Decide if we need to run hit test
    // Run if:
    // - Mouse moved (pendingPointerState.hasPending)
    // - Environment changed (Camera/Surface) AND we have a valid pointer cached
    // - Periodic scan is due
    const hasPending = pendingPointerState.hasPending;
    const shouldRun = hasPending || (envChanged && hoverStateRef.current.hasPointer);

    // Existing throttling logic...
    const now = performance.now();
    const timeSinceLast = now - hoverStateRef.current.lastSelectionTime;

    // Heartbeat: Force reliable 10Hz updates even if input loop is stalled
    const heartbeat = timeSinceLast > 100;

    // We bypass throttling if Env Changed (Must be correct instantly)
    if (shouldRun || heartbeat) { // 10hz fallback
        if (hoverStateRef.current.hasPointer || hasPending) {
            // FIX: Use FRESH pointer data if available!
            let targetX = hoverStateRef.current.lastClientX || 0;
            let targetY = hoverStateRef.current.lastClientY || 0;

            if (hasPending) {
                targetX = pendingPointerState.clientX;
                targetY = pendingPointerState.clientY;
                // CONSUME the pending event so we don't re-process
                pendingPointerState.hasPending = false;
            }

            updateHoverSelection(
                targetX,
                targetY,
                rect,
                theme,
                'camera',
                engine.draggedNodeId,
                renderScratch
            );
            hoverStateRef.current.lastSelectionTime = now;
        }
    }
};
const applyDragTargetSync = (
    engine: PhysicsEngine,
    hoverStateRef: Ref<HoverState>,
    clientToWorld: (clientX: number, clientY: number, rect: DOMRect, camera?: CameraState) => { x: number; y: number },
    rect: DOMRect,
    camera: CameraState
) => {
    if (engine.draggedNodeId && hoverStateRef.current.hasPointer) {
        const { x, y } = clientToWorld(
            hoverStateRef.current.cursorClientX,
            hoverStateRef.current.cursorClientY,
            rect,
            camera
        );
        engine.moveDrag({ x, y });
    }

    if (engine.draggedNodeId && engine.dragTarget) {
        const dragged = engine.nodes.get(engine.draggedNodeId);
        if (dragged) {
            dragged.x = engine.dragTarget.x;
            dragged.y = engine.dragTarget.y;
        }
    }
};

const syncHoverPerfCounters = (
    hoverStateRef: Ref<HoverState>,
    theme: ThemeConfig,
    now: number,
    ctx: CanvasRenderingContext2D
) => {
    if (theme.hoverDebugEnabled) {
        if (hoverStateRef.current.lastPerfSampleTime === 0) {
            hoverStateRef.current.lastPerfSampleTime = now;
        }
        const perfElapsed = now - hoverStateRef.current.lastPerfSampleTime;
        if (perfElapsed >= 1000) {
            hoverStateRef.current.selectionRunsPerSecond = hoverStateRef.current.selectionRunCount;
            hoverStateRef.current.energyUpdatesPerSecond = hoverStateRef.current.energyUpdateCount;
            hoverStateRef.current.selectionRunCount = 0;
            hoverStateRef.current.energyUpdateCount = 0;
            hoverStateRef.current.lastPerfSampleTime = now;
        }
    } else {
        hoverStateRef.current.lastPerfSampleTime = 0;
        hoverStateRef.current.selectionRunCount = 0;
        hoverStateRef.current.energyUpdateCount = 0;
        hoverStateRef.current.selectionRunsPerSecond = 0;
        hoverStateRef.current.energyUpdatesPerSecond = 0;
        hoverStateRef.current.spikeLogged = false;
    }

    if (theme.hoverDebugStateSentinel) {
        if (!hoverStateRef.current.debugStateLogged) {
            console.log(
                `hover ctx state: stroke=${String(ctx.strokeStyle)} ` +
                `dash=[${ctx.getLineDash().join(',')}] ` +
                `alpha=${ctx.globalAlpha} shadowBlur=${ctx.shadowBlur}`
            );
            hoverStateRef.current.debugStateLogged = true;
        }
    } else {
        hoverStateRef.current.debugStateLogged = false;
    }
};

export const startGraphRenderLoop = (deps: GraphRenderLoopDeps) => {
    const {
        canvas,
        ctx,
        engine,
        config,
        seed,
        spawnCount,
        setMetrics,
        cameraRef,
        settingsRef,
        pendingPointerRef,
        hoverStateRef,
        renderDebugRef,
        dragAnchorRef,
        stableCentroidRef,
        lastSafeCameraRef,
        activeDprRef,
        dprStableFramesRef,
        surfaceSnapshotRef,
        clientToWorld,
        updateHoverSelection,
        clearHover,
        renderScratch,
    } = deps;

    let frameId = 0;
    const schedulerState: SchedulerState = {
        lastTime: performance.now(),
        accumulatorMs: 0,
    };

    const perfSample = createPerfSample();
    const overloadState = createOverloadState();
    const trackMetrics = createMetricsTracker(setMetrics, () => renderDebugRef.current);

    ensureSeededGraph(engine, config, seed, spawnCount);
    engine.updateBounds(canvas.width, canvas.height);

    const render = () => {
        // FIX 36: Deferred Drag Start (First Frame Continuity)
        // Apply the grab using the EXACT camera/surface state of this frame.
        if (pendingPointerRef.current.pendingDragStart) {
            // FIX: Secondary Gate (Phantom Grab Protection)
            // If interactionLock is FALSE, it means handleDragEnd ran between the click and this frame.
            // We must drop the stale start request.
            if (!engine.interactionLock) {
                console.warn(`[StuckLockTrace] RenderLoop: Dropping stale pendingDragStart (Lock=FALSE).`);
                pendingPointerRef.current.pendingDragStart = null;
            } else {
                const { nodeId, clientX, clientY } = pendingPointerRef.current.pendingDragStart;
                console.log(`[StuckLockTrace] RenderLoop: Consuming pendingDragStart for ${nodeId} (Race Check: isFixed=${engine.nodes.get(nodeId)?.isFixed})`);
                const rect = canvas.getBoundingClientRect(); // Live rect for instant sync
                const { x, y } = clientToWorld(clientX, clientY, rect);
                engine.grabNode(nodeId, { x, y });
                console.log(`[PointerTrace] RenderLoop: Grabbed node ${nodeId} at ${x.toFixed(1)},${y.toFixed(1)} (dragged=${engine.draggedNodeId})`);
                pendingPointerRef.current.pendingDragStart = null;
            }
        }

        const now = performance.now();
        const schedulerResult = runPhysicsScheduler(engine, schedulerState, overloadState, perfSample);

        if (engine.config.debugPerf) {
            recordPerfSample(
                perfSample,
                overloadState,
                schedulerResult.stepsThisFrame,
                schedulerResult.tickMsTotal,
                schedulerResult.droppedMs,
                schedulerResult.dtMs,
                schedulerResult.accumulatorMs,
                schedulerResult.physicsMs,
                schedulerResult.baseBudget,
                now
            );
        }

        const rect = canvas.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) {
            frameId = requestAnimationFrame(render);
            return;
        }

        const { dpr, surfaceChanged } = updateCanvasSurface(
            canvas,
            rect,
            engine,
            activeDprRef,
            dprStableFramesRef,
            surfaceSnapshotRef
        );

        const width = rect.width;
        const height = rect.height;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        const theme = getTheme(settingsRef.current.skinMode);


        if (theme.hoverDebugEnabled && schedulerResult.dtMs > 200 && !hoverStateRef.current.spikeLogged) {
            console.log(`render spike detected: dt=${schedulerResult.dtMs.toFixed(1)}ms`);
            hoverStateRef.current.spikeLogged = true;
        }

        updateHoverEnergy(hoverStateRef, theme, schedulerResult.dtMs);

        if (settingsRef.current.debugNoRenderMotion) {
            hoverStateRef.current.energy = 0;
            hoverStateRef.current.targetEnergy = 0;
        }

        ctx.clearRect(0, 0, width, height);

        // --- RENDER PASS 1: BACKGROUND & VIGNETTE ---
        withCtx(ctx, () => {
            ctx.globalAlpha = 1;
            ctx.globalCompositeOperation = 'source-over';
            ctx.setLineDash([]);
            ctx.shadowBlur = 0;
            ctx.shadowColor = 'transparent';
            ctx.filter = 'none';
            drawVignetteBackground(ctx, width, height, theme);
        });

        const nodes = engine.getNodeList();

        if (!engine.draggedNodeId) {
            updateCameraContainment(
                cameraRef,
                nodes,
                width,
                height,
                schedulerResult.dtMs / 1000,
                settingsRef.current.cameraLocked,
                engine.getGlobalAngle(),
                engine.getCentroid(),
                !!engine.draggedNodeId
            );
        }

        ctx.save();
        const camera = cameraRef.current;
        const centroid = stabilizeCentroid(engine, dragAnchorRef, stableCentroidRef);
        const globalAngle = engine.getGlobalAngle();

        enforceCameraSafety(cameraRef, lastSafeCameraRef);

        // --- PHASE 6: SNAP HYSTERESIS ---
        // Detect motion
        const isSceneMoving =
            schedulerResult.physicsMs > 0 || // Physics active
            Math.abs(schedulerResult.dtMs - 16.6) > 20 || // Heavy lag/catchup (heuristic)
            pendingPointerRef.current || // Mouse moving
            engine.getGlobalAngle() !== 0 || // Rotation usually implies motion
            hoverStateRef.current.energy > 0.01; // Hover animation active

        // Check Camera Motion (heuristic comparison with last frame)
        // We already have 'cameraChanged' logic in updateHoverSelection?
        // Let's use cameraKey from Phase 5 logic if available, or just check camera properties.
        const camKey = `${camera.panX.toFixed(2)}:${camera.panY.toFixed(2)}:${camera.zoom.toFixed(3)}`;
        const cameraMoved = hoverStateRef.current.cameraKey !== camKey; // Note: cameraKey update logic is in updateHoverSelection loop, careful with order.

        // Actually, we can just detect if targeted pan/zoom differs from current? no, that's animation.
        // Let's stick to simple "Are we effectively moving?"

        const isMoving = isSceneMoving || cameraMoved;

        if (isMoving) {
            hoverStateRef.current.isMoving = true;
            hoverStateRef.current.lastMoveTime = now;
            hoverStateRef.current.snapEnabled = false; // Disable immediately on motion
        } else {
            hoverStateRef.current.isMoving = false;
            // Hysteresis: Enable snap only if stable for > 150ms
            if (now - hoverStateRef.current.lastMoveTime > 150) {
                hoverStateRef.current.snapEnabled = true;
            }
        }

        // Force snap ON if user explicitly requests "Pixel Snapping" setting?
        // Or does the user setting mean "Allow snapping behavior"?
        // Usually, user settings.pixelSnapping means "Enable the feature".
        // So we combine: settings.pixelSnapping AND hoverState.snapEnabled.
        const effectiveSnapping = settingsRef.current.pixelSnapping && hoverStateRef.current.snapEnabled;

        const transform = new CameraTransform(
            width,
            height,
            camera.zoom,
            camera.panX,
            camera.panY,
            globalAngle,
            centroid,
            dpr,
            effectiveSnapping
        );

        const project = (x: number, y: number) => transform.worldToScreen(x, y);
        const worldToScreen = project;
        const visibleBounds = transform.getVisibleBounds(200);

        renderScratch.prepare(engine, visibleBounds);
        updateHoverSelectionIfNeeded(
            pendingPointerRef.current,
            hoverStateRef,
            cameraRef,
            engine,
            rect,
            theme,
            surfaceChanged,
            renderScratch,
            updateHoverSelection
        );

        if (settingsRef.current.showDebugGrid) {
            ctx.save();
            transform.applyToContext(ctx);
            const scale = 1 / camera.zoom;
            ctx.lineWidth = scale;
            // Draw Grid... (omitted in this view, assuming it's here or called)
            ctx.restore();
        }

        // --- RENDER PASS 2: EDGES (BATCHED) ---
        drawLinks(ctx, engine, theme, worldToScreen, visibleBounds);

        // --- RENDER PASS 3: NODES (ITERATED) ---
        drawNodes(
            ctx,
            engine,
            theme,
            settingsRef,
            hoverStateRef,
            camera.zoom,
            renderDebugRef,
            dpr,
            worldToScreen,
            visibleBounds,
            renderScratch // Fix 55
        );

        // --- RENDER PASS 4: LABELS ---
        drawLabels(
            ctx,
            engine,
            theme,
            settingsRef,
            hoverStateRef,
            camera.zoom,
            dpr,
            worldToScreen,
            visibleBounds,
        );

        // --- RENDER PASS 5: OVERLAYS (DEBUG) ---
        // Moved to end of loop to ensure correct layering and 'worldToScreen' availability
        if (theme.hoverDebugEnabled && (hoverStateRef.current.hoveredNodeId || hoverStateRef.current.hoverDisplayNodeId)) {
            ctx.save();
            drawHoverDebugOverlay(ctx, engine, hoverStateRef, worldToScreen);
            ctx.restore();
        }

        if (hoverStateRef.current.hasPointer) {
            drawPointerCrosshair(ctx, rect, hoverStateRef, worldToScreen);
        }

        ctx.restore();
        // Render Debug Reset
        const renderDebug = renderDebugRef.current;
        if (renderDebug) {
            const defaultState = { globalCompositeOperation: 'source-over', globalAlpha: 1, filter: 'none' };
            renderDebug.drawOrder = ['links', 'glow', 'ring', 'labels', 'hoverDebug'];
            renderDebug.idleGlowPassIndex = -1;
            renderDebug.activeGlowPassIndex = -1;
            renderDebug.ringPassIndex = 2;
            renderDebug.idleGlowStateBefore = defaultState;
            renderDebug.idleGlowStateAfter = defaultState;
            renderDebug.idleRingStateBefore = defaultState;
            renderDebug.idleRingStateAfter = defaultState;
            renderDebug.activeGlowStateBefore = defaultState;
            renderDebug.activeGlowStateAfter = defaultState;
            renderDebug.activeRingStateBefore = defaultState;
            renderDebug.activeRingStateAfter = defaultState;
        }

        applyDragTargetSync(engine, hoverStateRef, clientToWorld, rect, camera);

        if (engine.draggedNodeId && Math.random() < 0.05) {
            const { cursorClientX, cursorClientY } = hoverStateRef.current;
            console.log(`[PointerTrace] Sync: Moving drag ${engine.draggedNodeId} to client=${cursorClientX.toFixed(0)},${cursorClientY.toFixed(0)}`);
        }

        window.dispatchEvent(new CustomEvent('graph-render-tick', {
            detail: { transform, dpr, snapEnabled: effectiveSnapping },
        }));

        syncHoverPerfCounters(hoverStateRef, theme, now, ctx);

        trackMetrics(now, engine);

        frameId = requestAnimationFrame(render);
    };

    const handleBlur = () => {
        clearHover('window blur', -1, 'unknown');
    };
    window.addEventListener('blur', handleBlur);

    const handleWheel = (e: WheelEvent) => {
        // FIX 32: strict wheel ownership
        if (e.defaultPrevented) return;

        e.preventDefault();
        e.stopPropagation();

        const rect = canvas.getBoundingClientRect();
        const cx = e.clientX - rect.left;
        const cy = e.clientY - rect.top;

        const ZOOM_SENSITIVITY = 0.002;
        const PAN_SENSITIVITY = 1.0;

        let delta = e.deltaY;
        if (e.deltaMode === 1) {
            delta *= 33;
        } else if (e.deltaMode === 2) {
            delta *= 800;
        }

        // FIX 39: OS Variance Guard (Clamp Massive deltas)
        // Some trackpads send 500+, mice send 100. Normalize.
        // Clamp to +/- 150 to keep zoom controllable.
        delta = Math.max(-150, Math.min(150, delta));

        // FIX 33: Trackpad Inertia Killer
        // Filter tiny deltas that look like decay tails
        if (Math.abs(delta) < 4.0) return;

        const scale = Math.exp(-delta * ZOOM_SENSITIVITY);

        const camera = cameraRef.current;
        const oldZoom = camera.targetZoom;
        const newZoom = Math.max(0.1, Math.min(10.0, oldZoom * scale));

        const vx = cx - rect.width / 2;
        const vy = cy - rect.height / 2;

        const rx = (vx / oldZoom) * PAN_SENSITIVITY;
        const ry = (vy / oldZoom) * PAN_SENSITIVITY;
        const rxx = (vx / newZoom) * PAN_SENSITIVITY;
        const ryy = (vy / newZoom) * PAN_SENSITIVITY;

        camera.targetPanX += (rx - rxx);
        camera.targetPanY += (ry - ryy);
        camera.targetZoom = newZoom;
    };
    canvas.addEventListener('wheel', handleWheel, { passive: false });

    frameId = requestAnimationFrame(render);

    const handleFontLoad = () => {
        textMetricsCache.clear();
        // Force a re-render if needed, though the loop is running 60fps anyway.
    };
    if (document.fonts) {
        document.fonts.ready.then(handleFontLoad);
        document.fonts.addEventListener('loadingdone', handleFontLoad);
    }

    return () => {
        window.removeEventListener('blur', handleBlur);
        cancelAnimationFrame(frameId);
    };
};
