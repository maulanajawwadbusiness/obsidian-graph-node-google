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
import { drawHoverDebugOverlay, drawLinks, drawNodes, drawPointerCrosshair } from './rendering/graphDraw';
import { createMetricsTracker } from './rendering/metrics';
import {
    createInitialHoverState,
    createInitialPendingPointer,
    createInitialRenderSettings
} from './rendering/renderingTypes';
import type {
    CameraState,
    HoverState,
    PendingPointerState,
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

        const engine = engineRef.current;
        if (!engine) return;

        const trackMetrics = createMetricsTracker(setMetrics);

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

            const dtMs = now - lastTime;
            const dt = Math.min(dtMs / 1000, 0.1);
            lastTime = now;

            engine.tick(dt);

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

            const nodes = Array.from(engine.nodes.values());
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

            drawLinks(ctx, engine, theme);
            drawNodes(ctx, engine, theme, settingsRef, hoverStateRef);

            if (theme.hoverDebugEnabled && hoverStateRef.current.hoveredNodeId) {
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
        clientToWorld
    };
};
