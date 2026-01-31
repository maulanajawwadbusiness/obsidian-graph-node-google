import type { PhysicsEngine } from '../../physics/engine';
import type { CameraState } from './renderingTypes';

type Ref<T> = { current: T };

export const stabilizeCentroid = (
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
        stableCentroidRef.current = centroid;
    } else {
        dragAnchorRef.current = null;
        const dx = rawCentroid.x - stableCentroidRef.current.x;
        const dy = rawCentroid.y - stableCentroidRef.current.y;
        const distSq = dx * dx + dy * dy;
        if (distSq > 0.000025) {
            stableCentroidRef.current = rawCentroid;
        }
        centroid = stableCentroidRef.current;
    }

    return centroid;
};

export const enforceCameraSafety = (
    cameraRef: Ref<CameraState>,
    lastSafeCameraRef: Ref<CameraState>
) => {
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
