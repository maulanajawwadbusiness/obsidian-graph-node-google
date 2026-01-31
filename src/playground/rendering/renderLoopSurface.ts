import type { PhysicsEngine } from '../../physics/engine';
import type { SurfaceSnapshot } from './renderingTypes';
import { gradientCache } from './gradientCache';
import { textMetricsCache } from './textCache';

type Ref<T> = { current: T };

export const updateCanvasSurface = (
    canvas: HTMLCanvasElement,
    rect: DOMRect,
    engine: PhysicsEngine,
    activeDprRef: Ref<number>,
    dprStableFramesRef: Ref<number>,
    surfaceSnapshotRef: Ref<SurfaceSnapshot>
) => {
    let rawDpr = window.devicePixelRatio || 1;
    if (!Number.isFinite(rawDpr) || rawDpr <= 0) {
        rawDpr = surfaceSnapshotRef.current.dpr || 1;
    } else {
        rawDpr = Math.max(0.1, Math.min(8.0, rawDpr));
    }

    let dpr = activeDprRef.current;

    if (Math.abs(rawDpr - dpr) > 0.001) {
        dprStableFramesRef.current++;
        if (dprStableFramesRef.current > 4) {
            dpr = rawDpr;
            activeDprRef.current = dpr;
            dprStableFramesRef.current = 0;
        }
    } else {
        dprStableFramesRef.current = 0;
    }

    if (rect.width <= 0 || rect.height <= 0) {
        return {
            dpr: surfaceSnapshotRef.current.dpr,
            surfaceChanged: false
        };
    }

    const displayWidth = Math.max(1, Math.round(rect.width * dpr));
    const displayHeight = Math.max(1, Math.round(rect.height * dpr));

    let surfaceChanged = false;

    if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
        canvas.width = displayWidth;
        canvas.height = displayHeight;
        engine.updateBounds(rect.width, rect.height);

        surfaceChanged = true;

        surfaceSnapshotRef.current = {
            displayWidth,
            displayHeight,
            rectWidth: rect.width,
            rectHeight: rect.height,
            dpr
        };

        gradientCache.clear();
        textMetricsCache.clear();
    }

    return { dpr, surfaceChanged };
};
