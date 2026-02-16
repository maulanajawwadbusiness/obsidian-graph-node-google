import { useCallback, useEffect, useRef } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
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
    canvasRef: MutableRefObject<HTMLCanvasElement | null>;
    canvasReady: boolean;
    config: ForceConfig;
    engineRef: MutableRefObject<PhysicsEngine>;
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
    onUserCameraInteraction?: (reason: 'wheel') => void;
};

export const useGraphRendering = ({
    canvasRef,
    canvasReady,
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
    forceShowRestMarkers,
    onUserCameraInteraction
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
        const engine = engineRef.current;

        if (!canvasReady || !canvas || !engine) {
            console.log(`[RenderLoop] skipped missing ${!canvas ? 'canvas' : 'engine'}`);
            return;
        }

        const ctx = canvas.getContext('2d');
        if (!ctx) {
            console.log('[RenderLoop] skipped missing 2d context');
            return;
        }

        console.log(`[RenderLoop] start canvas=${canvas.clientWidth}x${canvas.clientHeight}`);
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
            onUserCameraInteraction,
        });

        return () => {
            console.log('[RenderLoop] stop');
            stopLoop();
        };
    }, [canvasReady, config, onUserCameraInteraction, seed, setMetrics, spawnCount]);

    const handleDragStart = (nodeId: string, clientX: number, clientY: number) => {
        const engine = engineRef.current;
        if (!engine) return;

        // FIX: Lock Laws during interaction
        const wasLocked = engine.interactionLock;
        engine.lockInteraction('drag');
        console.log(`[PointerTrace] handleDragStart: locked interaction (prev=${wasLocked}) for nodeId=${nodeId}`);

        pendingPointerRef.current.pendingDragStart = { nodeId, clientX, clientY };
    };

    const handleDragEnd = () => {
        const engine = engineRef.current;
        if (engine) {
            // FIX: Phantom Grab Race Condition
            // Ensure no pending drag start is consumed next frame if we are ending now.
            if (pendingPointerRef.current.pendingDragStart) {
                console.warn(`[StuckLockTrace] handleDragEnd: Aborting pending drag start for ${pendingPointerRef.current.pendingDragStart.nodeId}`);
                pendingPointerRef.current.pendingDragStart = null;
            }

            console.log(`[PointerTrace] handleDragEnd: releasing node (dragged=${engine.draggedNodeId})`);
            engine.releaseNode();
            // FIX: Unlock Laws
            engine.unlockInteraction();
            console.log(`[PointerTrace] handleDragEnd: unlocked interaction`);
        }
    };

    const applyCameraSnapshot = useCallback((snapshot: { panX: number; panY: number; zoom: number }) => {
        if (!Number.isFinite(snapshot.panX) || !Number.isFinite(snapshot.panY) || !Number.isFinite(snapshot.zoom)) {
            return;
        }

        const camera = cameraRef.current;
        camera.panX = snapshot.panX;
        camera.panY = snapshot.panY;
        camera.zoom = snapshot.zoom;
        camera.targetPanX = snapshot.panX;
        camera.targetPanY = snapshot.panY;
        camera.targetZoom = snapshot.zoom;

        lastSafeCameraRef.current.panX = snapshot.panX;
        lastSafeCameraRef.current.panY = snapshot.panY;
        lastSafeCameraRef.current.zoom = snapshot.zoom;
        lastSafeCameraRef.current.targetPanX = snapshot.panX;
        lastSafeCameraRef.current.targetPanY = snapshot.panY;
        lastSafeCameraRef.current.targetZoom = snapshot.zoom;

        hoverStateRef.current.lastSelectionPanX = snapshot.panX;
        hoverStateRef.current.lastSelectionPanY = snapshot.panY;
        hoverStateRef.current.lastSelectionZoom = snapshot.zoom;
    }, []);

    const getCameraSnapshot = useCallback(() => {
        const camera = cameraRef.current;
        return {
            panX: camera.panX,
            panY: camera.panY,
            zoom: camera.zoom,
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
        updateHoverSelection,
        handleDragStart,
        handleDragEnd,
        applyCameraSnapshot,
        getCameraSnapshot
    };
};
