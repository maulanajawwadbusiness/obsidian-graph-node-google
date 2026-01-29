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
            const rawDeltaMs = now - lastTime;
            const frameDeltaMs = Math.min(rawDeltaMs, maxFrameDeltaMs);
            const dtMs = frameDeltaMs;
            lastTime = now;

            accumulatorMs += frameDeltaMs;
            const clampedMs = Math.max(0, rawDeltaMs - frameDeltaMs);

            let stepsThisFrame = 0;
            let tickMsTotal = 0;
            const recordTick = (durationMs: number) => {
                tickMsTotal += durationMs;
                perfSample.tickMsSamples.push(durationMs);
                perfSample.tickMsMax = Math.max(perfSample.tickMsMax, durationMs);
            };

            // DEBUG STALL: Validate overload behavior
            if (engine.config.debugStall) {
                const stallStart = performance.now();
                while (performance.now() - stallStart < 50) {
                    // Busy wait 50ms
                }
            }

            while (accumulatorMs >= fixedStepMs && stepsThisFrame < maxStepsPerFrame) {
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

            if (stepsThisFrame === 0 && accumulatorMs > 0) {
                if (engine.config.debugPerf) {
                    const tickStart = performance.now();
                    engine.tick(accumulatorMs / 1000);
                    recordTick(performance.now() - tickStart);
                } else {
                    engine.tick(accumulatorMs / 1000);
                }
                accumulatorMs = 0;
                stepsThisFrame = 1;
            }

            // ⚠️ DEBUG STALL: Simulate heavy load if 'F9' is pressed (implied state)
            // For now, we'll just check a global or config, but let's stick to the requested structure.
            // If user asked to "add a temporary 30–80ms stall in render-only path behind a debug flag"
            // We'll read engine.config.debugStall (we need to add this property or just hijack debugPerf for now with a key check)
            // Let's assume we hardcode the stall mechanism behind a variable we can toggle for validation later, 
            // or just rely on the existing loop.

            // =================================================================
            // INVARIANT A & B: Drop Debt & Detect Slush
            // =================================================================

            // 1. Monitor for "Death Spiral" / Syrup
            // If accumulator > 2 frames for > 2 frames, warn.
            const slushThreshold = fixedStepMs * 2;
            if (accumulatorMs > slushThreshold) {
                if (!hoverStateRef.current.slushFrameCount) hoverStateRef.current.slushFrameCount = 0;
                hoverStateRef.current.slushFrameCount++;

                if (hoverStateRef.current.slushFrameCount > 2) {
                    // Only warn once per second-ish to avoid console death
                    const nowLog = performance.now();
                    if (nowLog - (hoverStateRef.current.lastSlushLog || 0) > 1000) {
                        console.warn(
                            `[PhysicsSlushWarn] accumulatorPersist=${accumulatorMs.toFixed(1)}ms ` +
                            `frames=${hoverStateRef.current.slushFrameCount} ` +
                            `threshold=${slushThreshold.toFixed(1)}ms`
                        );
                        hoverStateRef.current.lastSlushLog = nowLog;
                    }
                }
            } else {
                hoverStateRef.current.slushFrameCount = 0;
            }

            // 2. Drop Excess Debt
            let droppedMs = clampedMs;
            let dropReason = clampedMs > 0 ? "CLAMP" : "NONE";

            // If we have leftovers >= fixedStepMs, we MUST drop them to prevent syrup.
            // "skip time, don't stretch time"
            // We keep the phase (remainder < fixedStepMs) for smoothness, 
            // UNLESS we are in a massive overload (slush detected), then we might clear all.
            // For now, adhering to Invariant B: "drop the remaining debt"
            // The user said: "it’s ok to drop remainder too" in overload.

            const debtLimit = fixedStepMs;
            if (accumulatorMs >= debtLimit) {
                droppedMs += accumulatorMs;
                dropReason = "OVERLOAD";
                accumulatorMs = 0; // HARD RESET to guarantee catch-up
            }

            if (engine.config.debugPerf) {
                perfSample.frameCount += 1;
                perfSample.tickCount += stepsThisFrame;
                perfSample.maxTicksPerFrame = Math.max(perfSample.maxTicksPerFrame, stepsThisFrame);
                perfSample.droppedMsTotal += droppedMs;

                if (droppedMs > 0 && dropReason === "OVERLOAD") {
                    // Throttled log for significant drops
                    const nowLog = performance.now();
                    if (nowLog - (hoverStateRef.current.lastDropLog || 0) > 1000) {
                        console.log(
                            `[RenderPerf] droppedMs=${droppedMs.toFixed(1)} ` +
                            `reason=${dropReason} ` +
                            `budgetMs=${(fixedStepMs * maxStepsPerFrame).toFixed(1)} ` +
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
                    const avgTickMs = perfSample.tickMsSamples.length
                        ? perfSample.tickMsSamples.reduce((sum, v) => sum + v, 0) / perfSample.tickMsSamples.length
                        : 0;
                    const sorted = perfSample.tickMsSamples.slice().sort((a, b) => a - b);
                    const p95Index = sorted.length ? Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95)) : 0;
                    const p95TickMs = sorted.length ? sorted[p95Index] : 0;
                    const ticksPerSecond = ticks / (elapsed / 1000);
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
