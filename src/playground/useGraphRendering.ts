import { useEffect, useRef } from 'react';
import type { Dispatch, RefObject, SetStateAction } from 'react';
import { PhysicsEngine } from '../physics/engine';
import { ForceConfig } from '../physics/types';
import { SkinMode } from '../visual/theme';
import { PlaygroundMetrics } from './playgroundTypes';
import { createHoverController } from './rendering/hoverController';
import { startGraphRenderLoop } from './rendering/graphRenderingLoop';
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
    RenderSettings,
    SurfaceSnapshot
} from './rendering/renderingTypes';
import { RenderScratch } from './rendering/renderScratch';

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
    showRestMarkers: boolean;
    showConflictMarkers: boolean;
    markerIntensity: number;
    forceShowRestMarkers: boolean;
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
    debugNoRenderMotion,
    showRestMarkers,
    showConflictMarkers,
    markerIntensity,
    forceShowRestMarkers
}: UseGraphRenderingProps) => {
    const cameraRef = useRef<CameraState>({
        panX: 0,
        panY: 0,
        zoom: 1.0,
        targetPanX: 0,
        targetPanY: 0,
        targetZoom: 1.0,
        lastRecenterCentroidX: 0,
        lastRecenterCentroidY: 0,
        lastInteractionTime: 0
    });

    const settingsRef = useRef<RenderSettings>(createInitialRenderSettings());
    const pendingPointerRef = useRef<PendingPointerState>(createInitialPendingPointer());
    const hoverStateRef = useRef<HoverState>(createInitialHoverState());

    const renderDebugRef = useRef<RenderDebugInfo>(createInitialRenderDebug());
    const renderScratchRef = useRef<RenderScratch>(new RenderScratch());

    // FIX 18: Rotation Anchor Freeze (Stop World Swap)
    const dragAnchorRef = useRef<{ x: number, y: number } | null>(null);
    // FIX 33: Stable Centroid (Stop Idle Wobble)
    const stableCentroidRef = useRef<{ x: number, y: number }>({ x: 0, y: 0 });
    // FIX 39: Camera NaN Safety Backup
    const lastSafeCameraRef = useRef<CameraState>({ ...cameraRef.current });
    // FIX 40 & 41: DPR Stability (Safe & Debounced)
    const initialDpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    const activeDprRef = useRef<number>(initialDpr);
    const surfaceSnapshotRef = useRef<SurfaceSnapshot>({
        displayWidth: 0,
        displayHeight: 0,
        rectWidth: 0,
        rectHeight: 0,
        dpr: initialDpr
    });
    const dprStableFramesRef = useRef<number>(0);

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
        settingsRef.current.showRestMarkers = showRestMarkers;
        settingsRef.current.showConflictMarkers = showConflictMarkers;
        settingsRef.current.markerIntensity = markerIntensity;
        settingsRef.current.forceShowRestMarkers = forceShowRestMarkers;
    }, [
        useVariedSize,
        skinMode,
        cameraLocked,
        showDebugGrid,
        pixelSnapping,
        debugNoRenderMotion,
        showRestMarkers,
        showConflictMarkers,
        markerIntensity,
        forceShowRestMarkers
    ]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const engine = engineRef.current;
        if (!engine) return;

        const stopLoop = startGraphRenderLoop({
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
            renderScratch: renderScratchRef.current,
        });

        return stopLoop;
    }, [startGraphRenderLoop]);

    const handleDragStart = (nodeId: string, clientX: number, clientY: number) => {
        const engine = engineRef.current;
        if (!engine) return;

        // FIX: Lock Laws during interaction
        engine.lockInteraction('drag');

        pendingPointerRef.current.pendingDragStart = { nodeId, clientX, clientY };
    };

    const handleDragEnd = () => {
        const engine = engineRef.current;
        if (engine) {
            engine.releaseNode();
            // FIX: Unlock Laws
            engine.unlockInteraction();
        }
    };

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
        updateHoverSelection,
        handleDragStart,
        handleDragEnd
    };
};
