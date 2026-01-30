import { useEffect, useRef } from 'react';
import type { Dispatch, RefObject, SetStateAction } from 'react';
import { PhysicsEngine } from '../physics/engine';
import { ForceConfig } from '../physics/types';
import { getTheme, SkinMode } from '../visual/theme';
import { generateRandomGraph } from './graphRandom';
import { PlaygroundMetrics } from './playgroundTypes';
import { CameraTransform, updateCameraContainment, verifyMappingIntegrity } from './rendering/camera';
import { drawVignetteBackground, withCtx } from './rendering/canvasUtils';
import { createHoverController } from './rendering/hoverController';
import { updateHoverEnergy } from './rendering/hoverEnergy';
import { drawHoverDebugOverlay, drawLabels, drawLinks, drawNodes, drawPointerCrosshair } from './rendering/graphDraw';
import { createMetricsTracker } from './rendering/metrics';
import {
    createInitialHoverState,
    createInitialPendingPointer,
    createInitialRenderDebug,
    createInitialRenderSettings
} from './rendering/renderingTypes';
import type {
    CameraState,
    HoverState,
    PendingPointerState,
    RenderDebugInfo,
    RenderSettingsRef
} from './rendering/renderingTypes';

type UseGraphRenderingProps = {
    canvasRef: RefObject<HTMLCanvasElement>;
    config: ForceConfig;
    engineRef: RefObject<PhysicsEngine>;
    seed: number;
    setMetrics: Dispatch<SetStateAction<PlaygroundMetrics>>;
    spawnCount: number;
    useVariedSize: boolean;
    skinMode: SkinMode;
    cameraLocked: boolean;
    showDebugGrid: boolean;
    pixelSnapping: boolean;
    debugNoRenderMotion: boolean;
};

export const useGraphRendering = ({
    canvasRef,
    config,
    engineRef,
    seed,
    setMetrics,
    spawnCount,
    useVariedSize,
    skinMode,
    cameraLocked,
    showDebugGrid,
    pixelSnapping,
    debugNoRenderMotion
}: UseGraphRenderingProps) => {
    const cameraRef = useRef<CameraState>({
        panX: 0,
        panY: 0,
        zoom: 1.0,
        targetPanX: 0,
        targetPanY: 0,
        targetZoom: 1.0,
        lastRecenterCentroidX: 0,
        lastRecenterCentroidY: 0
    });

    const settingsRef = useRef<RenderSettingsRef>(createInitialRenderSettings());
    const pendingPointerRef = useRef<PendingPointerState>(createInitialPendingPointer());
    const hoverStateRef = useRef<HoverState>(createInitialHoverState());
    const renderDebugRef = useRef<RenderDebugInfo>(createInitialRenderDebug());

    // FIX 18: Rotation Anchor Freeze (Stop World Swap)
    const dragAnchorRef = useRef<{ x: number, y: number } | null>(null);
    // FIX 33: Stable Centroid (Stop Idle Wobble)
    const stableCentroidRef = useRef<{ x: number, y: number }>({ x: 0, y: 0 });

    const {
        clientToWorld,
        worldToScreen,
        updateHoverSelection,
        handlePointerMove,
        handlePointerEnter,
        handlePointerLeave,
        handlePointerCancel,
        handlePointerUp,
        clearHover
    } = createHoverController({
        engineRef,
        settingsRef,
        hoverStateRef,
        pendingPointerRef,
        cameraRef
    });

    useEffect(() => {
        settingsRef.current.useVariedSize = useVariedSize;
        settingsRef.current.skinMode = skinMode;
        settingsRef.current.cameraLocked = cameraLocked;
        settingsRef.current.showDebugGrid = showDebugGrid;
        settingsRef.current.pixelSnapping = pixelSnapping;
        settingsRef.current.debugNoRenderMotion = debugNoRenderMotion;
    }, [useVariedSize, skinMode, cameraLocked, showDebugGrid, pixelSnapping, debugNoRenderMotion]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let frameId = 0;
        let lastTime = performance.now();
        let accumulatorMs = 0;
        const perfSample = {
            lastReportAt: 0,
            frameCount: 0,
            tickCount: 0,
            tickMsTotal: 0,
            tickMsMax: 0,
            tickMsSamples: [] as number[],
            droppedMsTotal: 0,
            maxTicksPerFrame: 0,
            lastDtMs: 0,
            lastAccumulatorMs: 0,
            lastSteps: 0,
            lastDroppedMs: 0,
            lastPhysicsMs: 0,
        };
        const overloadState = {
            active: false,
            reason: 'NONE',
            severity: 'NONE' as 'NONE' | 'SOFT' | 'HARD',
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
        };

        const engine = engineRef.current;
        if (!engine) return;

        const trackMetrics = createMetricsTracker(setMetrics, () => renderDebugRef.current);

        if (engine.nodes.size === 0) {
            const { nodes, links } = generateRandomGraph(spawnCount, config.targetSpacing, config.initScale, seed);
            nodes.forEach(n => engine.addNode(n));
            links.forEach(l => engine.addLink(l));
        }

        if (canvas) {
            engine.updateBounds(canvas.width, canvas.height);
        }

        const render = () => {
            const now = performance.now();
            const targetTickHz = engine.config.targetTickHz || 60;
            const fixedStepMs = 1000 / targetTickHz;

            const maxStepsPerFrame = engine.config.maxStepsPerFrame || 2;
            const maxPhysicsBudgetMs = engine.config.maxPhysicsBudgetMs ?? fixedStepMs * maxStepsPerFrame;
            const dtHugeMs = engine.config.dtHugeMs ?? 250;

            // FIX 16: Mode Lock during Drag (Stable Laws)
            // Do NOT change physics laws (degrade level) while user is handling a node.
            // This ensures consistent friction/responsiveness under the hand.
            const isInteracting = !!engine.draggedNodeId; // Fix 43/44 Trigger

            if (!isInteracting) {
                engine.setDegradeState(
                    overloadState.degradeLevel,
                    overloadState.degradeReason,
                    overloadState.severity,
                    maxPhysicsBudgetMs
                );
            }

            // FIX 43: Determinism & Law Lock
            // When interacting, we prioritize SIMULATION CORRECTNESS over Frame Rate.
            // We disable the "Debt Drop" safeguards so the physics doesn't "skip" or "loosen" under the hand.
            const effectiveMaxBudget = isInteracting ? Infinity : maxPhysicsBudgetMs;
            const effectiveMaxSteps = isInteracting ? 10 : maxStepsPerFrame;

            const rawDeltaMs = now - lastTime;
            // FIX #4: No dt clamp. Allow full time to flow (prevent syrup).
            // We handle huge spikes via overload/debt-drop instead of dilating time.
            const frameDeltaMs = rawDeltaMs;
            const dtMs = frameDeltaMs;
            lastTime = now;

            accumulatorMs += frameDeltaMs;

            let freezeThisFrame = false;
            let overloadReason = 'NONE';
            let overloadSeverity: 'NONE' | 'SOFT' | 'HARD' = 'NONE';

            // Detect massive spikes (e.g. tab switch) -> force freeze/reset
            if (accumulatorMs > dtHugeMs * 3) {
                // Hard reset if >750ms behind (safety hatch)
                accumulatorMs = 0;
                overloadReason = 'DT_HUGE_RESET';
                overloadSeverity = 'HARD';
                freezeThisFrame = true;
            } else if (isInteracting && accumulatorMs > dtHugeMs) {
                // Safety Hatch during Drag: If we fall WAY behind (>250ms),
                // we must clamp to avoid death spiral, even if we want determinism.
                // But we clamp, not freeze.
                accumulatorMs = dtHugeMs;
            }

            const clampedMs = 0; // No longer clamping upstream

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

            // ... (debug stall skipped) ...

            const dtHuge = rawDeltaMs > dtHugeMs;
            const debtWatchdogPrev = overloadState.debtFrames > 2;

            // Var definitions moved up

            if (dtHuge) {
                freezeThisFrame = true;
                overloadReason = 'DT_HUGE';
                overloadSeverity = 'HARD';
            } else if (debtWatchdogPrev && !isInteracting) {
                // Fix 44: Disable Watchdog Freeze during interaction
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

            // ... (perf log skipped) ...

            if (!freezeThisFrame) {
                const physicsStart = performance.now();
                // FIX 43: Use effective limits (Infinity during drag)
                while (accumulatorMs >= fixedStepMs && stepsThisFrame < effectiveMaxSteps) {
                    if (performance.now() - physicsStart >= effectiveMaxBudget) {
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
                    accumulatorMs -= fixedStepMs;
                    stepsThisFrame += 1;
                }
                physicsMs = performance.now() - physicsStart;
            } else if (engine.draggedNodeId && engine.dragTarget) {
                // Keep dragging even if frozen
                const dragged = engine.nodes.get(engine.draggedNodeId);
                if (dragged) {
                    dragged.x = engine.dragTarget.x;
                    dragged.y = engine.dragTarget.y;
                }
            }

            // ... (debug stall check removed/implied) ...

            // =================================================================
            // INVARIANT A & B: Drop Debt & Detect Overload
            // =================================================================

            const capHit = !freezeThisFrame && (stepsThisFrame >= effectiveMaxSteps);
            const budgetExceeded = !freezeThisFrame && (physicsMs >= effectiveMaxBudget);

            // FIX #5: Burst Control & Anti-Syrup
            // If we hit a limit (Budget or StepCap) and still have debt, DROP IT.
            // Never carry debt that we proved we can't handle this frame.
            let droppedMs = clampedMs;
            let dropReason = "NONE";

            // Check for persistent debt (Syrup Detector)
            const slushThreshold = fixedStepMs * 2;
            if (accumulatorMs > slushThreshold) {
                overloadState.debtFrames += 1;
            } else {
                overloadState.debtFrames = 0;
            }

            if (freezeThisFrame) {
                droppedMs += accumulatorMs;
                dropReason = "FREEZE";
                accumulatorMs = 0;
            } else if (capHit || budgetExceeded) {
                // If we stopped early, we MUST drop the rest to stay real-time.
                if (accumulatorMs > 0) {
                    droppedMs += accumulatorMs;
                    dropReason = budgetExceeded ? "BUDGET_DROP" : "CAP_DROP";
                    accumulatorMs = 0; // HARD RESET
                }
            } else if (overloadState.debtFrames > 2) {
                // Watchdog: If we have >2 frames of slush, force reset
                droppedMs += accumulatorMs;
                dropReason = "WATCHDOG_DROP";
                accumulatorMs = 0;
            }

            // Determine Overload State for Degrade System
            if (overloadSeverity === 'NONE') {
                if (droppedMs > fixedStepMs && dropReason !== "NONE") {
                    overloadReason = dropReason;
                    overloadSeverity = 'HARD'; // Drops are treated as hard overload
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

            if (engine.config.debugPerf) {
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

                if (droppedMs > 0 && dropReason !== "NONE") {
                    // Throttled log for significant drops
                    const nowLog = performance.now();
                    if (nowLog - (hoverStateRef.current.lastDropLog || 0) > 1000) {
                        console.log(
                            `[RenderPerf] droppedMs=${droppedMs.toFixed(1)} ` +
                            `reason=${dropReason} ` +
                            `budgetMs=${maxPhysicsBudgetMs.toFixed(1)} ` +
                            `ticksThisFrame=${stepsThisFrame} ` +
                            `avgTickMs=${perfSample.tickMsTotal / (perfSample.tickCount || 1)}`
                        );
                        hoverStateRef.current.lastDropLog = nowLog;
                    }
                }

                if (perfSample.lastReportAt === 0) {
                    perfSample.lastReportAt = now;
                }
                const elapsed = now - perfSample.lastReportAt;
                if (elapsed >= 1000) {
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
                }
            }

            const rect = canvas.getBoundingClientRect();
            const dpr = window.devicePixelRatio || 1;
            const displayWidth = Math.max(1, Math.round(rect.width * dpr));
            const displayHeight = Math.max(1, Math.round(rect.height * dpr));

            if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
                canvas.width = displayWidth;
                canvas.height = displayHeight;
                engine.updateBounds(rect.width, rect.height);
            }

            const width = rect.width;
            const height = rect.height;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

            const theme = getTheme(settingsRef.current.skinMode);

            if (theme.hoverDebugEnabled && dtMs > 200 && !hoverStateRef.current.spikeLogged) {
                console.log(`render spike detected: dt=${dtMs.toFixed(1)}ms`);
                hoverStateRef.current.spikeLogged = true;
            }

            updateHoverEnergy(hoverStateRef, theme, dtMs);

            // Fix 6: Kill Render Motion
            if (settingsRef.current.debugNoRenderMotion) {
                hoverStateRef.current.energy = 0;
                hoverStateRef.current.targetEnergy = 0;
            }

            ctx.clearRect(0, 0, width, height);

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

            // FIX 15: Camera Lock during Drag
            // Do NOT recenter or smooth camera while user is holding a node.
            // This prevents "shifting earth" feel.
            if (!engine.draggedNodeId) {
                // FIX 19: Pass active values for correct panning under rotation
                // FIX 45: Pass isInteraction for instant camera snap
                updateCameraContainment(
                    cameraRef,
                    nodes,
                    width,
                    height,
                    dtMs / 1000,
                    settingsRef.current.cameraLocked,
                    engine.getGlobalAngle(),
                    engine.getCentroid(),
                    !!engine.draggedNodeId // isInteraction
                );
            }

            const pendingPointer = pendingPointerRef.current;
            const selectionCamera = cameraRef.current;
            const selectionCentroid = engine.getCentroid();
            const selectionAngle = engine.getGlobalAngle();
            const epsilon = 0.0005;
            const cameraChanged =
                Math.abs(selectionCamera.panX - hoverStateRef.current.lastSelectionPanX) > epsilon ||
                Math.abs(selectionCamera.panY - hoverStateRef.current.lastSelectionPanY) > epsilon ||
                Math.abs(selectionCamera.zoom - hoverStateRef.current.lastSelectionZoom) > epsilon ||
                Math.abs(selectionAngle - hoverStateRef.current.lastSelectionAngle) > epsilon ||
                Math.abs(selectionCentroid.x - hoverStateRef.current.lastSelectionCentroidX) > epsilon ||
                Math.abs(selectionCentroid.y - hoverStateRef.current.lastSelectionCentroidY) > epsilon;

            if (pendingPointer.hasPending) {
                pendingPointer.hasPending = false;
                updateHoverSelection(
                    pendingPointer.clientX,
                    pendingPointer.clientY,
                    rect,
                    theme,
                    'pointer',
                    engine.draggedNodeId // Fix 46: Lock cue to dragged node
                );
            } else if (hoverStateRef.current.hasPointer && cameraChanged) {
                updateHoverSelection(
                    hoverStateRef.current.cursorClientX,
                    hoverStateRef.current.cursorClientY,
                    rect,
                    theme,
                    'camera',
                    engine.draggedNodeId // Fix 46: Lock cue to dragged node
                );
            }

            ctx.save();
            const camera = cameraRef.current;

            // FIX 18: Rotation Anchor Freeze & FIX 33: Stable Centroid
            // Capture centroid at start of drag and HOLD it.
            // Also stabilize it during idle to prevent "breathing" due to float noise.
            let rawCentroid = engine.getCentroid();
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

            const globalAngle = engine.getGlobalAngle();

            const transform = new CameraTransform(
                width,
                height,
                camera.zoom,
                camera.panX,
                camera.panY,
                globalAngle,
                centroid,
                settingsRef.current.pixelSnapping
            );
            transform.applyToContext(ctx);

            if (settingsRef.current.showDebugGrid) {
                ctx.save();
                const scale = 1 / camera.zoom;
                ctx.lineWidth = scale;

                // Cyan Grid at World 0,0
                ctx.strokeStyle = 'rgba(0, 255, 255, 0.2)';
                ctx.beginPath();
                for (let i = -1000; i <= 1000; i += 100) {
                    ctx.moveTo(i, -1000); ctx.lineTo(i, 1000);
                    ctx.moveTo(-1000, i); ctx.lineTo(1000, i);
                }
                ctx.stroke();

                // World Origin
                ctx.strokeStyle = 'rgba(0, 255, 255, 0.8)';
                ctx.lineWidth = scale * 2;
                ctx.beginPath();
                ctx.moveTo(-50, 0); ctx.lineTo(50, 0);
                ctx.moveTo(0, -50); ctx.lineTo(0, 50);
                ctx.stroke();

                // Magenta Centroid
                ctx.strokeStyle = 'rgba(255, 0, 255, 0.8)';
                ctx.beginPath();
                ctx.moveTo(centroid.x - 30, centroid.y); ctx.lineTo(centroid.x + 30, centroid.y);
                ctx.moveTo(centroid.x, centroid.y - 30); ctx.lineTo(centroid.x, centroid.y + 30);
                ctx.stroke();

                ctx.restore();
            }

            const renderDebug = renderDebugRef.current;
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

            // FIX 28: Render-Rate Drag Coupling (Visual Dignity)
            // Force update the dragged node to the cursor position EVERY VSRE frame.
            // This ensures smooth movement even if physics ticks are dropped or quantized (e.g. 60hz physics on 144hz screen).
            if (engine.draggedNodeId && engine.dragTarget) {
                const dragged = engine.nodes.get(engine.draggedNodeId);
                if (dragged) {
                    dragged.x = engine.dragTarget.x;
                    dragged.y = engine.dragTarget.y;
                }
            }

            drawLinks(ctx, engine, theme, project);
            drawNodes(ctx, engine, theme, settingsRef, hoverStateRef, renderDebugRef);
            drawLabels(ctx, engine, theme, settingsRef, hoverStateRef, globalAngle);

            if (
                theme.hoverDebugEnabled &&
                (hoverStateRef.current.hoveredNodeId || hoverStateRef.current.hoverDisplayNodeId)
            ) {
                drawHoverDebugOverlay(ctx, engine, hoverStateRef);
            }

            ctx.restore();

            if (theme.hoverDebugEnabled && hoverStateRef.current.hasPointer) {
                drawPointerCrosshair(ctx, rect, hoverStateRef, worldToScreen);
            }

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
                        `hover ctx state: stroke=${String(ctx.strokeStyle)} dash=[${ctx.getLineDash().join(',')}] ` +
                        `alpha=${ctx.globalAlpha} shadowBlur=${ctx.shadowBlur}`
                    );
                    hoverStateRef.current.debugStateLogged = true;
                }
            } else {
                hoverStateRef.current.debugStateLogged = false;
            }

            trackMetrics(now, engine);

            frameId = requestAnimationFrame(render);
        };

        const handleBlur = () => {
            clearHover('window blur', -1, 'unknown');
        };
        window.addEventListener('blur', handleBlur);

        // FIX 23: Unambiguous Wheel Handling (Native Listener for preventDefault)
        // Explicitly own the wheel on canvas to prevent page scroll.
        // Also implements Zoom behavior.
        const handleWheel = (e: WheelEvent) => {
            e.preventDefault();
            e.stopPropagation();

            const rect = canvas.getBoundingClientRect();
            // Point of interest (cursor)
            const cx = e.clientX - rect.left;
            const cy = e.clientY - rect.top;

            // FIX 27: Tunable Sensitivity Knobs
            const ZOOM_SENSITIVITY = 0.002;
            const PAN_SENSITIVITY = 1.0;

            // FIX 25: Normalize Delta (Trackpad vs Mouse)
            // deltaMode: 0=Pixels, 1=Lines, 2=Pages
            let delta = e.deltaY;
            if (e.deltaMode === 1) {
                delta *= 33; // ~Line height
            } else if (e.deltaMode === 2) {
                delta *= 800; // ~Page height
            }

            // Zoom Factor
            // Use normalized delta
            const scale = Math.exp(-delta * ZOOM_SENSITIVITY);

            // Apply Zoom centered on cursor
            // NewZoom = OldZoom * scale
            // P_world = P_screen / OldZoom + Pan
            // We want P_world to stay at P_screen.
            // Pan_new = P_world - P_screen / NewZoom
            // Pan_new = (P_screen / OldZoom + Pan_old) - P_screen / NewZoom

            const camera = cameraRef.current;
            const oldZoom = camera.targetZoom; // Use target for smoothness
            const newZoom = Math.max(0.1, Math.min(10.0, oldZoom * scale));

            // Viewport-relative cursor (centered 0,0)
            const vx = cx - rect.width / 2;
            const vy = cy - rect.height / 2;

            // Shift Pan to maintain world position under cursor
            // FIX 27: Apply Sensitivity
            const rx = (vx / oldZoom) * PAN_SENSITIVITY;
            const ry = (vy / oldZoom) * PAN_SENSITIVITY;
            const rxx = (vx / newZoom) * PAN_SENSITIVITY;
            const ryy = (vy / newZoom) * PAN_SENSITIVITY;

            // Pan Correction
            camera.targetPanX += (rx - rxx);
            camera.targetPanY += (ry - ryy);
            camera.targetZoom = newZoom;

            // Wake up loop if needed (though it runs always)
        };
        canvas.addEventListener('wheel', handleWheel, { passive: false });

        frameId = requestAnimationFrame(render);
        return () => {
            canvas.removeEventListener('wheel', handleWheel);
            window.removeEventListener('blur', handleBlur);
            cancelAnimationFrame(frameId);
        };
    }, []);

    return {
        handlePointerMove,
        handlePointerEnter,
        handlePointerLeave,
        handlePointerCancel,
        handlePointerUp,
        clearHover,
        clientToWorld,
        worldToScreen,
        hoverStateRef,
        updateHoverSelection // Expose for drag initiation
    };
};
