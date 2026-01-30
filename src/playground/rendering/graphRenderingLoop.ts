import type { Dispatch, SetStateAction, MutableRefObject } from 'react';
import type { PhysicsEngine } from '../../physics/engine';
import type { ForceConfig } from '../../physics/types';
import { getTheme } from '../../visual/theme';
import { generateRandomGraph } from '../graphRandom';
import type { PlaygroundMetrics } from '../playgroundTypes';
import { updateCameraContainment, CameraTransform, verifyMappingIntegrity } from './camera';
import { drawVignetteBackground, withCtx } from './canvasUtils';
import { updateHoverEnergy } from './hoverEnergy';
import { drawHoverDebugOverlay, drawLabels, drawLinks, drawNodes, drawPointerCrosshair } from './graphDraw';
import { createMetricsTracker } from './metrics';
import {
    CameraState,
    HoverState,
    RenderSettings,
    PendingPointerState,
    RenderDebugInfo
} from './renderingTypes';
import { gradientCache } from './gradientCache';
import { isDebugEnabled } from './debugUtils';
import { textMetricsCache } from './textCache';

type Ref<T> = { current: T };

type ThemeConfig = ReturnType<typeof getTheme>;

type UpdateHoverSelection = (
    clientX: number,
    clientY: number,
    rect: DOMRect,
    theme: ThemeConfig,
    reason: 'pointer' | 'camera',
    draggedNodeId: string | null
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
    clientToWorld: (clientX: number, clientY: number, rect: DOMRect) => { x: number; y: number };
    updateHoverSelection: UpdateHoverSelection;
    clearHover: (reason: string, id: number, source: string) => void;
};

type PerfSample = {
    lastReportAt: number;
    frameCount: number;
    tickCount: number;
    tickMsTotal: number;
    tickMsMax: number;
    tickMsSamples: number[];
    droppedMsTotal: number;
    maxTicksPerFrame: number;
    lastDtMs: number;
    lastAccumulatorMs: number;
    lastSteps: number;
    lastDroppedMs: number;
    lastPhysicsMs: number;
};

type OverloadState = {
    active: boolean;
    reason: string;
    severity: 'NONE' | 'SOFT' | 'HARD';
    overloadCount: number;
    freezeCount: number;
    debtFrames: number;
    lastLogAt: number;
    lastOverloadAt: number;
    lastFreezeAt: number;
    pendingHardFreeze: boolean;
    pendingReason: string;
    degradeLevel: number;
    degradeReason: string;
    degradeHoldFrames: number;
};

const createPerfSample = (): PerfSample => ({
    lastReportAt: 0,
    frameCount: 0,
    tickCount: 0,
    tickMsTotal: 0,
    tickMsMax: 0,
    tickMsSamples: [],
    droppedMsTotal: 0,
    maxTicksPerFrame: 0,
    lastDtMs: 0,
    lastAccumulatorMs: 0,
    lastSteps: 0,
    lastDroppedMs: 0,
    lastPhysicsMs: 0,
});

const createOverloadState = (): OverloadState => ({
    active: false,
    reason: 'NONE',
    severity: 'NONE',
    overloadCount: 0,
    freezeCount: 0,
    debtFrames: 0,
    lastLogAt: 0,
    lastOverloadAt: 0,
    lastFreezeAt: 0,
    pendingHardFreeze: false,
    pendingReason: 'NONE',
    degradeLevel: 0,
    degradeReason: 'NONE',
    degradeHoldFrames: 0,
});

const ensureSeededGraph = (engine: PhysicsEngine, config: ForceConfig, seed: number, spawnCount: number) => {
    if (engine.nodes.size === 0) {
        const { nodes, links } = generateRandomGraph(spawnCount, config.targetSpacing, config.initScale, seed);
        nodes.forEach(n => engine.addNode(n));
        links.forEach(l => engine.addLink(l));
    }
};

    }
};

// FIX 50: Context State Restoration (Canonical State)
const restoreContextState = (ctx: CanvasRenderingContext2D, dpr: number) => {
    // 1. Reset Transform to DPR scale
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // 2. Reset Composition
    ctx.globalAlpha = 1.0;
    ctx.globalCompositeOperation = 'source-over';

    // 3. Reset Styling
    ctx.filter = 'none';
    ctx.imageSmoothingEnabled = true;
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';
    ctx.lineWidth = 1;
    ctx.lineCap = 'butt';
    ctx.lineJoin = 'miter';
};

const updateCanvasSurface = (
    canvas: HTMLCanvasElement,
    rect: DOMRect,
    engine: PhysicsEngine,
    activeDprRef: Ref<number>,
    dprStableFramesRef: Ref<number>,
    surfaceSnapshotRef: Ref<SurfaceSnapshot>
) => {
    // FIX 40: Safe DPR Read (No NaN/Zero)
    // FIX 47: Guard DPR = 0 / undefined / NaN
    let rawDpr = window.devicePixelRatio || 1;
    if (!Number.isFinite(rawDpr) || rawDpr <= 0) {
        // Fallback to last known good DPR if available, otherwise 1
        rawDpr = surfaceSnapshotRef.current.dpr || 1;
        // console.warn('[Surface] Invalid DPR detected, falling back to:', rawDpr);
    } else {
        // Clamp to sane range to avoid memory explosion (e.g. dpr=15 bug)
        rawDpr = Math.max(0.1, Math.min(8.0, rawDpr));
    }

    // FIX 41 & 48: Rapid DPR Stabilization (Debounce + Hysteresis)
    // Require 4 consecutive frames of stable new DPR before committing.
    // This avoids resync storms during monitor swaps.
    let dpr = activeDprRef.current;

    // Check if distinct change from current active
    if (Math.abs(rawDpr - dpr) > 0.001) {
        dprStableFramesRef.current++;
        // 4 frames @ 60fps ~= 66ms. @ 120fps ~= 33ms.
        // Enough to filter glitches, fast enough to feel responsive.
        if (dprStableFramesRef.current > 4) {
            dpr = rawDpr;
            activeDprRef.current = dpr;
            dprStableFramesRef.current = 0;
            // console.log('[Surface] DPR stabilized to:', dpr);
        }
    } else {
        dprStableFramesRef.current = 0;
    }

    // FIX 46: Handle Transient 0x0 Backing Safely
    // If layout is thrashing or minimized, we might get 0x0. 
    // NEVER resize backing to 0. Freeze on last good snapshot.
    if (rect.width <= 0 || rect.height <= 0) {
        // console.warn('[Surface] Invalid Rect (0x0) detected. Freezing surface.');
        return {
            dpr: surfaceSnapshotRef.current.dpr,
            surfaceChanged: false
        };
    }

    const displayWidth = Math.max(1, Math.round(rect.width * dpr));
    const displayHeight = Math.max(1, Math.round(rect.height * dpr));

    let surfaceChanged = false;

    // Resize backing if changed
    if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
        canvas.width = displayWidth;
        canvas.height = displayHeight;
        engine.updateBounds(rect.width, rect.height);

        // FIX 32 & 33: Stale Rect / Cache Invalidation
        surfaceChanged = true;

        // Update Snapshot (Commit Good State)
        surfaceSnapshotRef.current = {
            displayWidth,
            displayHeight,
            rectWidth: rect.width,
            rectHeight: rect.height,
            dpr
        };

        // CACHE INVALIDATION (DPR Change / Resize)
        gradientCache.clear();
        textMetricsCache.clear();

        if (process.env.NODE_ENV !== 'production' && Math.random() < 0.05) {
            // console.log('[RenderLoop] Caches cleared due to surface change');
        }
    }

    return { dpr, surfaceChanged };
};

const stabilizeCentroid = (
    engine: PhysicsEngine,
    dragAnchorRef: Ref<{ x: number; y: number } | null>,
    stableCentroidRef: Ref<{ x: number; y: number }>
) => {
    const rawCentroid = engine.getCentroid();
    let centroid = rawCentroid;

    if (engine.draggedNodeId) {
        if (!dragAnchorRef.current) {
            dragAnchorRef.current = { ...rawCentroid };
        }
        centroid = dragAnchorRef.current;
        // Sync stable ref so we don't jump on release
        stableCentroidRef.current = centroid;
    } else {
        dragAnchorRef.current = null;
        // Idle Stabilization Hysteresis
        // Only update if moved significantly (> 0.005)
        const dx = rawCentroid.x - stableCentroidRef.current.x;
        const dy = rawCentroid.y - stableCentroidRef.current.y;
        const distSq = dx * dx + dy * dy;
        // 0.005^2 = 0.000025
        if (distSq > 0.000025) {
            stableCentroidRef.current = rawCentroid;
        }
        centroid = stableCentroidRef.current;
    }

    return centroid;
};

const enforceCameraSafety = (cameraRef: Ref<CameraState>, lastSafeCameraRef: Ref<CameraState>) => {
    const camera = cameraRef.current;
    if (isNaN(camera.zoom) || isNaN(camera.panX) || isNaN(camera.panY) || !isFinite(camera.zoom)) {
        const safe = lastSafeCameraRef.current;
        camera.zoom = safe.zoom;
        camera.panX = safe.panX;
        camera.panY = safe.panY;
        camera.targetZoom = safe.targetZoom;
        camera.targetPanX = safe.targetPanX;
        camera.targetPanY = safe.targetPanY;
    } else {
        lastSafeCameraRef.current.zoom = camera.zoom;
        lastSafeCameraRef.current.panX = camera.panX;
        lastSafeCameraRef.current.panY = camera.panY;
        lastSafeCameraRef.current.targetZoom = camera.targetZoom;
        lastSafeCameraRef.current.targetPanX = camera.targetPanX;
        lastSafeCameraRef.current.targetPanY = camera.targetPanY;
    }
};

// Hardening Phase 5: Hit Map Cache Invalidation
// We track "generations" of state to invalidate stale hit results.
let globalSurfaceGeneration = 0;

export const updateHoverSelectionIfNeeded = (
    pendingPointer: boolean,
    hoverStateRef: MutableRefObject<HoverState>,
    cameraRef: MutableRefObject<CameraState>,
    engine: PhysicsEngine,
    rect: DOMRect,
    theme: ThemeConfig,
    surfaceChanged: boolean,
    updateHoverSelection: (
        x: number,
        y: number,
        rect: DOMRect,
        theme: ThemeConfig,
        trigger: 'pointer' | 'camera',
        draggedNodeId: string | null
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
    // String key was too coarse (toFixed(2)). Use strict epsilon check.
    // Check against cached exact values in HoverState.
    const EPSILON = 0.0001;
    const sameCam =
        Math.abs(camera.panX - hoverStateRef.current.lastSelectionPanX) < EPSILON &&
        Math.abs(camera.panY - hoverStateRef.current.lastSelectionPanY) < EPSILON &&
        Math.abs(camera.zoom - hoverStateRef.current.lastSelectionZoom) < EPSILON &&
        Math.abs(engine.getGlobalAngle() - hoverStateRef.current.lastSelectionAngle) < EPSILON;

    if (!sameCam) {
        envChanged = true;
        // Update the "Last Selection" values immediately so next check works
        // (Actually updateHoverSelection will update them, but we need to trigger the run)
    }

    if (globalSurfaceGeneration !== hoverStateRef.current.surfaceGeneration) {
        envChanged = true;
        hoverStateRef.current.surfaceGeneration = globalSurfaceGeneration;
    }

    // 2. Decide if we need to run hit test
    // Run if:
    // - Mouse moved (pendingPointer)
    // - Environment changed (Camera/Surface) AND we have a valid pointer cached
    // - Periodic scan is due (existing logic below)
    const shouldRun = pendingPointer || (envChanged && hoverStateRef.current.hasPointer);

    // Existing throttling logic...
    const now = performance.now();
    const timeSinceLast = now - hoverStateRef.current.lastSelectionTime;

    // We bypass throttling if Env Changed (Must be correct instantly)
    if (shouldRun || (timeSinceLast > 100)) { // 10hz fallback
        // ... (Hit test execution)
        if (hoverStateRef.current.hasPointer) {
            // Use the CACHED cursor world coordinates? 
            // NO. If camera moved, cursorWorldX is STALE. We must re-project from ClientX/Y.
            // But we don't have ClientX/Y passed here easily unless we store it in HoverState?
            // Assumption: HoverState has lastClientX/Y.
            // If not, we rely on 'pendingPointer' having updated it?
            // If camera moves but mouse doesn't, we don't get a mousemove event.
            // We need to re-project `lastClientX` with NEW camera.

            // For now, we assume updateHoverSelection handles the projection using the passed `camera`.
            // We just ensure it RUNS.

            updateHoverSelection(
                hoverStateRef.current.lastClientX || 0,
                hoverStateRef.current.lastClientY || 0,
                rect,
                theme,
                'camera',
                engine.draggedNodeId
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

const recordPerfSample = (
    perfSample: PerfSample,
    overloadState: OverloadState,
    stepsThisFrame: number,
    tickMsTotal: number,
    droppedMs: number,
    dtMs: number,
    accumulatorMs: number,
    physicsMs: number,
    baseBudget: number,
    now: number
) => {
    perfSample.frameCount += 1;
    perfSample.tickCount += stepsThisFrame;
    perfSample.tickMsTotal += tickMsTotal;
    perfSample.maxTicksPerFrame = Math.max(perfSample.maxTicksPerFrame, stepsThisFrame);
    perfSample.droppedMsTotal += droppedMs;
    perfSample.lastDtMs = dtMs;
    perfSample.lastAccumulatorMs = accumulatorMs;
    perfSample.lastSteps = stepsThisFrame;
    perfSample.lastDroppedMs = droppedMs;
    perfSample.lastPhysicsMs = physicsMs;

    if (droppedMs > 0 && overloadState.reason !== 'NONE') {
        const nowLog = performance.now();
        if (nowLog - (overloadState.lastLogAt || 0) > 1000) {
            console.log(
                `[RenderPerf] droppedMs=${droppedMs.toFixed(1)} ` +
                `reason=${overloadState.reason} ` +
                `budgetMs=${baseBudget.toFixed(1)} ` +
                `ticksThisFrame=${stepsThisFrame} ` +
                `avgTickMs=${perfSample.tickMsTotal / (perfSample.tickCount || 1)}`
            );
            overloadState.lastLogAt = nowLog;
        }
    }

    if (perfSample.lastReportAt === 0) {
        perfSample.lastReportAt = now;
    }
    const elapsed = now - perfSample.lastReportAt;
    if (elapsed >= 1000) {
        // GATE: Production Safety
        if (!isDebugEnabled(true)) {
            // Reset samples silently in prod to avoid memory leak
            perfSample.tickMsSamples = [];
            perfSample.lastReportAt = now;
            perfSample.frameCount = 0;
            perfSample.tickCount = 0;
            perfSample.maxTicksPerFrame = 0;
            return;
        }

        const frames = perfSample.frameCount || 1;
        const ticks = perfSample.tickCount || 1;
        const fps = frames / (elapsed / 1000);
        const rafHz = fps;
        const avgTickMs = perfSample.tickMsSamples.length
            ? perfSample.tickMsSamples.reduce((sum, v) => sum + v, 0) / perfSample.tickMsSamples.length
            : (perfSample.lastSteps > 0 ? perfSample.lastPhysicsMs / perfSample.lastSteps : 0);
        const sorted = perfSample.tickMsSamples.slice().sort((a, b) => a - b);
        const p95Index = sorted.length ? Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95)) : 0;
        const p95TickMs = sorted.length ? sorted[p95Index] : 0;
        const ticksPerSecond = ticks / (elapsed / 1000);
        const freezeRecently = now - overloadState.lastFreezeAt < 1000;
        console.log(
            `[RenderPerf] fps=${fps.toFixed(1)} ` +
            `rafHz=${rafHz.toFixed(1)} ` +
            `dt=${perfSample.lastDtMs.toFixed(1)} ` +
            `accumulatorMs=${perfSample.lastAccumulatorMs.toFixed(1)} ` +
            `steps=${perfSample.lastSteps} ` +
            `ticksPerSecond=${ticksPerSecond.toFixed(1)} ` +
            `droppedMs=${perfSample.lastDroppedMs.toFixed(1)}`
        );
        console.log(
            `[Overload] active=${overloadState.active} ` +
            `severity=${overloadState.severity} ` +
            `reason=${overloadState.reason} ` +
            `freezeTriggered=${freezeRecently} ` +
            `freezeCount=${overloadState.freezeCount} ` +
            `overloadCount=${overloadState.overloadCount}`
        );
        console.log(
            `[SlushWatch] debtFrames=${overloadState.debtFrames} ` +
            `accumulatorMs=${perfSample.lastAccumulatorMs.toFixed(1)} ` +
            `avgTickMs=${avgTickMs.toFixed(3)}`
        );
        console.log(
            `[RenderPerf] avgTickMs=${avgTickMs.toFixed(3)} ` +
            `p95TickMs=${p95TickMs.toFixed(3)} ` +
            `maxTickMs=${perfSample.tickMsMax.toFixed(3)} ` +
            `ticksPerSecond=${ticksPerSecond.toFixed(1)} ` +
            `ticksPerFrame=${(ticks / frames).toFixed(2)} ` +
            `maxTicksPerFrame=${perfSample.maxTicksPerFrame} ` +
            `droppedMs=${perfSample.droppedMsTotal.toFixed(1)} ` +
            `frames=${frames}`
        );
        perfSample.lastReportAt = now;
        perfSample.frameCount = 0;
        perfSample.tickCount = 0;
        perfSample.tickMsTotal = 0;
        perfSample.tickMsMax = 0;
        perfSample.tickMsSamples = [];
        perfSample.droppedMsTotal = 0;
        perfSample.maxTicksPerFrame = 0;

        // Gradient Cache Stats
        if (gradientCache.misses > 0 || gradientCache.hits > 0) {
            console.log(
                `[GradientCache] hits=${gradientCache.hits} ` +
                `misses/created=${gradientCache.misses} ` +
                `(HitRat=${(gradientCache.hits / (gradientCache.hits + gradientCache.misses) * 100).toFixed(1)}%)`
            );
            gradientCache.resetStats();
        }
    }
};

type SchedulerState = {
    lastTime: number;
    accumulatorMs: number;
};

type SchedulerResult = {
    dtMs: number;
    accumulatorMs: number;
    droppedMs: number;
    stepsThisFrame: number;
    tickMsTotal: number;
    physicsMs: number;
    baseBudget: number;
    fixedStepMs: number;
    overloadReason: string;
    overloadSeverity: 'NONE' | 'SOFT' | 'HARD';
};

const runPhysicsScheduler = (
    engine: PhysicsEngine,
    schedulerState: SchedulerState,
    overloadState: OverloadState,
    perfSample: PerfSample
): SchedulerResult => {
    const now = performance.now();
    const targetTickHz = engine.config.targetTickHz || 60;
    const fixedStepMs = 1000 / targetTickHz;
    const isDragging = !!engine.draggedNodeId;
    const maxSteps = isDragging ? 10 : (engine.config.maxStepsPerFrame || 2);
    const baseBudget = engine.config.maxPhysicsBudgetMs ?? (fixedStepMs * maxSteps);
    const effectiveBudget = isDragging ? Infinity : baseBudget;

    if (!isDragging) {
        // FIX: Interaction Lock check is unnecessary here because setDegradeState
        // now checks engine.interactionLock internally!
        engine.setDegradeState(
            overloadState.degradeLevel,
            overloadState.degradeReason,
            overloadState.severity,
            baseBudget
        );
    } else {
        // Dragging forces safe mode (level 0)
        // But if we are LOCKED, this call will be ignored by engine.
        // That's exactly what we want: if locked, we stay in locked mode.
        // If not locked, we go to 0.
        engine.setDegradeState(0, 'INTERACTION', 'NONE', Infinity);
    }

    const rawDeltaMs = now - schedulerState.lastTime;

    // FIX: DT Clamping (Safety Cap)
    // Limit delta time to ~35ms (approx 28fps minimum). 
    // If the frame takes longer (e.g. 100ms), we only simulate 35ms of physics.
    // This slows down the simulation "clock" relative to real time ("Visual Dignity"),
    // but prevents the solver from exploding or needing 100 sub-steps.
    const dtCap = 35;
    const frameDeltaMs = Math.min(rawDeltaMs, dtCap);

    const dtMs = frameDeltaMs;
    schedulerState.lastTime = now;

    schedulerState.accumulatorMs += frameDeltaMs;
    const dtHugeMs = engine.config.dtHugeMs ?? 250;

    let freezeThisFrame = false;
    let overloadReason = 'NONE';
    let overloadSeverity: 'NONE' | 'SOFT' | 'HARD' = 'NONE';

    if (schedulerState.accumulatorMs > dtHugeMs * 3) {
        schedulerState.accumulatorMs = 0;
        overloadReason = 'DT_HUGE_RESET';
        overloadSeverity = 'HARD';
        freezeThisFrame = true;
    } else if (isDragging && schedulerState.accumulatorMs > dtHugeMs) {
        schedulerState.accumulatorMs = dtHugeMs;
    }

    const clampedMs = 0;
    let stepsThisFrame = 0;
    let tickMsTotal = 0;
    let physicsMs = 0;

    const recordTick = (durationMs: number) => {
        tickMsTotal += durationMs;
        if (engine.config.debugPerf) {
            perfSample.tickMsSamples.push(durationMs);
            perfSample.tickMsMax = Math.max(perfSample.tickMsMax, durationMs);
        }
    };

    const dtHuge = rawDeltaMs > dtHugeMs;
    const debtWatchdogPrev = overloadState.debtFrames > 2;

    if (dtHuge) {
        freezeThisFrame = true;
        overloadReason = 'DT_HUGE';
        overloadSeverity = 'HARD';
    } else if (debtWatchdogPrev && !isDragging) {
        freezeThisFrame = true;
        overloadReason = 'DEBT_WATCHDOG';
        overloadSeverity = 'HARD';
    } else if (overloadState.pendingHardFreeze) {
        freezeThisFrame = true;
        overloadReason = overloadState.pendingReason;
        overloadSeverity = 'HARD';
    }

    if (freezeThisFrame) {
        overloadState.pendingHardFreeze = false;
        overloadState.pendingReason = 'NONE';
    }

    if (!freezeThisFrame) {
        const physicsStart = performance.now();
        while (schedulerState.accumulatorMs >= fixedStepMs && stepsThisFrame < maxSteps) {
            if (performance.now() - physicsStart >= effectiveBudget) {
                break;
            }
            if (engine.config.debugPerf) {
                const tickStart = performance.now();
                engine.tick(fixedStepMs / 1000);
                recordTick(performance.now() - tickStart);
                if (stepsThisFrame === 0 && Math.random() < 0.05) {
                    verifyMappingIntegrity();
                }
            } else {
                engine.tick(fixedStepMs / 1000);
            }
            schedulerState.accumulatorMs -= fixedStepMs;
            stepsThisFrame += 1;
        }
        physicsMs = performance.now() - physicsStart;
    }

    const capHit = !freezeThisFrame && (stepsThisFrame >= maxSteps);
    const budgetExceeded = !freezeThisFrame && (physicsMs >= effectiveBudget);

    let droppedMs = clampedMs;
    let dropReason = 'NONE';

    const slushThreshold = fixedStepMs * 2;
    if (schedulerState.accumulatorMs > slushThreshold) {
        overloadState.debtFrames += 1;
    } else {
        overloadState.debtFrames = 0;
    }

    if (freezeThisFrame) {
        droppedMs += schedulerState.accumulatorMs;
        dropReason = 'FREEZE';
        schedulerState.accumulatorMs = 0;
    } else if (capHit || budgetExceeded) {
        if (schedulerState.accumulatorMs > 0) {
            droppedMs += schedulerState.accumulatorMs;
            dropReason = budgetExceeded ? 'BUDGET_DROP' : 'CAP_DROP';
            schedulerState.accumulatorMs = 0;
        }
    } else if (overloadState.debtFrames > 2) {
        droppedMs += schedulerState.accumulatorMs;
        dropReason = 'WATCHDOG_DROP';
        schedulerState.accumulatorMs = 0;
    }

    if (overloadSeverity === 'NONE') {
        if (droppedMs > fixedStepMs && dropReason !== 'NONE') {
            overloadReason = dropReason;
            overloadSeverity = 'HARD';
        } else if (budgetExceeded) {
            overloadReason = 'BUDGET_HIT';
            overloadSeverity = 'SOFT';
        }
    }

    const overloadActive = overloadReason !== 'NONE';
    if (overloadActive) {
        if (!overloadState.active || overloadReason !== overloadState.reason || overloadSeverity !== overloadState.severity) {
            overloadState.overloadCount += 1;
        }
        overloadState.lastOverloadAt = now;
    }
    overloadState.active = overloadActive;
    overloadState.reason = overloadReason;
    overloadState.severity = overloadSeverity;
    if (freezeThisFrame) {
        overloadState.freezeCount += 1;
        overloadState.debtFrames = 0;
        overloadState.lastFreezeAt = now;
    }

    const nextDegradeLevel = overloadSeverity === 'HARD' ? 2 : overloadSeverity === 'SOFT' ? 1 : 0;
    if (nextDegradeLevel > 0) {
        overloadState.degradeLevel = nextDegradeLevel;
        overloadState.degradeReason = overloadReason;
        overloadState.degradeHoldFrames = nextDegradeLevel === 2 ? 12 : 6;
    } else if (overloadState.degradeHoldFrames > 0) {
        overloadState.degradeHoldFrames -= 1;
    } else {
        overloadState.degradeLevel = 0;
        overloadState.degradeReason = 'NONE';
    }

    return {
        dtMs,
        accumulatorMs: schedulerState.accumulatorMs,
        droppedMs,
        stepsThisFrame,
        tickMsTotal,
        physicsMs,
        baseBudget,
        fixedStepMs,
        overloadReason,
        overloadSeverity,
    };
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
            const { nodeId, clientX, clientY } = pendingPointerRef.current.pendingDragStart;
            const rect = canvas.getBoundingClientRect(); // Live rect for instant sync
            const { x, y } = clientToWorld(clientX, clientY, rect);
            engine.grabNode(nodeId, { x, y });
            pendingPointerRef.current.pendingDragStart = null;
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

        updateHoverSelectionIfNeeded(
            pendingPointerRef.current.hasPending,
            hoverStateRef,
            cameraRef,
            engine,
            rect,
            theme,
            surfaceChanged,
            updateHoverSelection
        );

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

        if (settingsRef.current.showDebugGrid) {
            ctx.save();
            transform.applyToContext(ctx);
            const scale = 1 / camera.zoom;
            ctx.lineWidth = scale;
            // Draw Grid... (omitted in this view, assuming it's here or called)
            ctx.restore();
        }

        // --- RENDER PASS 2: EDGES (BATCHED) ---
        drawLinks(ctx, engine, theme, worldToScreen);

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
            worldToScreen
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
            worldToScreen
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
        canvas.removeEventListener('wheel', handleWheel);
        window.removeEventListener('blur', handleBlur);
        if (document.fonts) {
            document.fonts.removeEventListener('loadingdone', handleFontLoad);
        }
        cancelAnimationFrame(frameId);
    };
};
