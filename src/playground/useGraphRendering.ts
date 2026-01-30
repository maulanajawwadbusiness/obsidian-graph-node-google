import { useEffect, useRef } from 'react';
import type { Dispatch, RefObject, SetStateAction } from 'react';
import { PhysicsEngine } from '../physics/engine';
import { ForceConfig } from '../physics/types';
import { getTheme, SkinMode } from '../visual/theme';
import { generateRandomGraph } from './graphRandom';
import { PlaygroundMetrics } from './playgroundTypes';
import { applyCameraTransform, updateCameraContainment } from './rendering/camera';
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
};

export const useGraphRendering = ({
    canvasRef,
    config,
    engineRef,
    seed,
    setMetrics,
    spawnCount,
    useVariedSize,
    skinMode
}: UseGraphRenderingProps) => {
    const cameraRef = useRef<CameraState>({
        panX: 0,
        panY: 0,
        zoom: 1.0,
        targetPanX: 0,
        targetPanY: 0,
        targetZoom: 1.0
    });

    const settingsRef = useRef<RenderSettingsRef>(createInitialRenderSettings());
    const pendingPointerRef = useRef<PendingPointerState>(createInitialPendingPointer());
    const hoverStateRef = useRef<HoverState>(createInitialHoverState());
    const renderDebugRef = useRef<RenderDebugInfo>(createInitialRenderDebug());

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
    }, [useVariedSize, skinMode]);

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
            const maxFrameDeltaMs = engine.config.maxFrameDeltaMs || 120;
            const maxStepsPerFrame = engine.config.maxStepsPerFrame || 2;
            const maxPhysicsBudgetMs = engine.config.maxPhysicsBudgetMs ?? fixedStepMs * maxStepsPerFrame;
            const dtHugeMs = engine.config.dtHugeMs ?? 250;
            engine.setDegradeState(
                overloadState.degradeLevel,
                overloadState.degradeReason,
                overloadState.severity,
                maxPhysicsBudgetMs
            );
            const rawDeltaMs = now - lastTime;
            const frameDeltaMs = Math.min(rawDeltaMs, maxFrameDeltaMs);
            const dtMs = frameDeltaMs;
            lastTime = now;

            accumulatorMs += frameDeltaMs;
            const clampedMs = Math.max(0, rawDeltaMs - frameDeltaMs);

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

            // DEBUG STALL: Validate overload behavior
            if (engine.config.debugStall) {
                const stallStart = performance.now();
                while (performance.now() - stallStart < 60) {
                    // Busy wait 60ms
                }
            }

            const dtHuge = rawDeltaMs > dtHugeMs;
            const debtWatchdogPrev = overloadState.debtFrames > 2;

            let freezeThisFrame = false;
            let overloadReason = 'NONE';
            let overloadSeverity: 'NONE' | 'SOFT' | 'HARD' = 'NONE';

            if (dtHuge) {
                freezeThisFrame = true;
                overloadReason = 'DT_HUGE';
                overloadSeverity = 'HARD';
            } else if (debtWatchdogPrev) {
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

            if (engine.config.debugPerf && debtWatchdogPrev) {
                const nowLog = performance.now();
                if (nowLog - overloadState.lastLogAt > 1000) {
                    console.error(
                        `[SlushAssert] debtFrames=${overloadState.debtFrames} ` +
                        `accumulatorMs=${accumulatorMs.toFixed(1)} ` +
                        `threshold=${(fixedStepMs * 2).toFixed(1)}`
                    );
                    overloadState.lastLogAt = nowLog;
                }
            }

            if (!freezeThisFrame) {
                const physicsStart = performance.now();
                while (accumulatorMs >= fixedStepMs && stepsThisFrame < maxStepsPerFrame) {
                    if (performance.now() - physicsStart >= maxPhysicsBudgetMs) {
                        break;
                    }
                    if (engine.config.debugPerf) {
                        const tickStart = performance.now();
                        engine.tick(fixedStepMs / 1000);
                        recordTick(performance.now() - tickStart);
                    } else {
                        engine.tick(fixedStepMs / 1000);
                    }
                    accumulatorMs -= fixedStepMs;
                    stepsThisFrame += 1;
                }
                physicsMs = performance.now() - physicsStart;
            } else if (engine.draggedNodeId && engine.dragTarget) {
                const dragged = engine.nodes.get(engine.draggedNodeId);
                if (dragged) {
                    dragged.x = engine.dragTarget.x;
                    dragged.y = engine.dragTarget.y;
                }
            }

            // ⚠️ DEBUG STALL: Simulate heavy load if 'F9' is pressed (implied state)
            // For now, we'll just check a global or config, but let's stick to the requested structure.
            // If user asked to "add a temporary 30–80ms stall in render-only path behind a debug flag"
            // We'll read engine.config.debugStall (we need to add this property or just hijack debugPerf for now with a key check)
            // Let's assume we hardcode the stall mechanism behind a variable we can toggle for validation later, 
            // or just rely on the existing loop.

            // =================================================================
            // INVARIANT A & B: Drop Debt & Detect Overload
            // =================================================================

            const slushThreshold = fixedStepMs * 2;
            if (accumulatorMs > slushThreshold) {
                overloadState.debtFrames += 1;
            } else {
                overloadState.debtFrames = 0;
            }
            const debtPersistent = overloadState.debtFrames >= 2;
            const debtWatchdog = overloadState.debtFrames > 2;

            let forceDropDebt = false;
            let forceDropReason = 'NONE';

            if (!freezeThisFrame && debtWatchdog) {
                forceDropDebt = true;
                forceDropReason = 'WATCHDOG';
                if (overloadSeverity !== 'HARD') {
                    overloadReason = 'DEBT_WATCHDOG';
                    overloadSeverity = 'HARD';
                }
                if (engine.config.debugPerf) {
                    const nowLog = performance.now();
                    if (nowLog - overloadState.lastLogAt > 1000) {
                        console.error(
                            `[SlushAssert] debtFrames=${overloadState.debtFrames} ` +
                            `accumulatorMs=${accumulatorMs.toFixed(1)} ` +
                            `threshold=${slushThreshold.toFixed(1)}`
                        );
                        overloadState.lastLogAt = nowLog;
                    }
                }
            }

            const capHit = !freezeThisFrame && stepsThisFrame >= maxStepsPerFrame && accumulatorMs >= fixedStepMs;
            const budgetExceeded = !freezeThisFrame && physicsMs > maxPhysicsBudgetMs;

            // 1. Drop Excess Debt
            let droppedMs = clampedMs;
            let dropReason = clampedMs > 0 ? "CLAMP" : "NONE";

            // If we have leftovers >= fixedStepMs, we MUST drop them to prevent syrup.
            // "skip time, don't stretch time"
            // We keep the phase (remainder < fixedStepMs) for smoothness, 
            // UNLESS we are in a massive overload (slush detected), then we might clear all.
            // For now, adhering to Invariant B: "drop the remaining debt"
            // The user said: "it's ok to drop remainder too" in overload.

            const debtLimit = fixedStepMs;
            if (freezeThisFrame) {
                droppedMs += accumulatorMs;
                dropReason = "FREEZE";
                accumulatorMs = 0;
            } else if (forceDropDebt) {
                droppedMs += accumulatorMs;
                dropReason = forceDropReason;
                accumulatorMs = 0;
            } else if ((capHit || budgetExceeded) && accumulatorMs >= debtLimit) {
                droppedMs += accumulatorMs;
                dropReason = budgetExceeded ? "BUDGET" : "CAP";
                accumulatorMs = 0; // HARD RESET to guarantee catch-up
            }
            if (!freezeThisFrame && (forceDropDebt || capHit || budgetExceeded)) {
                overloadState.debtFrames = 0;
            }
            if (overloadSeverity === 'NONE') {
                if (debtPersistent && (capHit || budgetExceeded)) {
                    overloadReason = budgetExceeded ? 'DEBT_PERSIST_BUDGET' : 'DEBT_PERSIST_CAP';
                    overloadSeverity = 'HARD';
                    overloadState.pendingHardFreeze = true;
                    overloadState.pendingReason = overloadReason;
                } else if (budgetExceeded) {
                    overloadReason = 'BUDGET_EXCEEDED';
                    overloadSeverity = 'SOFT';
                } else if (capHit) {
                    overloadReason = 'CAP_HIT';
                    overloadSeverity = 'SOFT';
                } else if (debtPersistent) {
                    overloadReason = 'DEBT_PERSIST';
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
            updateCameraContainment(cameraRef, nodes, width, height);

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
                updateHoverSelection(pendingPointer.clientX, pendingPointer.clientY, rect, theme, 'pointer');
            } else if (hoverStateRef.current.hasPointer && cameraChanged) {
                updateHoverSelection(
                    hoverStateRef.current.cursorClientX,
                    hoverStateRef.current.cursorClientY,
                    rect,
                    theme,
                    'camera'
                );
            }

            ctx.save();
            const camera = cameraRef.current;
            const centroid = engine.getCentroid();
            const globalAngle = engine.getGlobalAngle();
            applyCameraTransform(ctx, camera, width, height, centroid, globalAngle);

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

            drawLinks(ctx, engine, theme);
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

        frameId = requestAnimationFrame(render);
        return () => {
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
        hoverStateRef
    };
};
