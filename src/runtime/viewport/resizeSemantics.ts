export type ResizeSemanticMode = 'preserve-center-world' | 'preserve-top-left-world' | 'fit-world-bounds';

export type ResizeSemanticConfig = {
    mode: ResizeSemanticMode;
};

export type ResizeSemanticViewportSize = {
    width: number;
    height: number;
};

export type ResizeSemanticCamera = {
    panX: number;
    panY: number;
    zoom: number;
};

export type ResizeSemanticRotation = {
    angleRad: number;
    pivotX: number;
    pivotY: number;
};

export type ComputeCameraAfterResizeParams = {
    config?: ResizeSemanticConfig;
    prevViewport: ResizeSemanticViewportSize;
    nextViewport: ResizeSemanticViewportSize;
    camera: ResizeSemanticCamera;
    rotation?: ResizeSemanticRotation;
};

type ResizeSemanticsCounters = {
    boxedResizeEventCount: number;
    boxedResizeCameraAdjustCount: number;
};

const MIN_ZOOM = 0.0001;
const isDev = typeof import.meta !== 'undefined' && import.meta.env.DEV;
const counters: ResizeSemanticsCounters = {
    boxedResizeEventCount: 0,
    boxedResizeCameraAdjustCount: 0,
};

export const DEFAULT_BOXED_RESIZE_SEMANTIC_MODE: ResizeSemanticMode = 'preserve-center-world';

function isFiniteNumber(value: number): boolean {
    return Number.isFinite(value);
}

function isFiniteSize(size: ResizeSemanticViewportSize): boolean {
    return (
        isFiniteNumber(size.width) &&
        isFiniteNumber(size.height) &&
        size.width >= 1 &&
        size.height >= 1
    );
}

function isFiniteCamera(camera: ResizeSemanticCamera): boolean {
    return (
        isFiniteNumber(camera.panX) &&
        isFiniteNumber(camera.panY) &&
        isFiniteNumber(camera.zoom) &&
        camera.zoom > 0
    );
}

function normalizeRotation(input: ResizeSemanticRotation | undefined): ResizeSemanticRotation {
    if (!input) {
        return {
            angleRad: 0,
            pivotX: 0,
            pivotY: 0,
        };
    }
    if (
        !isFiniteNumber(input.angleRad) ||
        !isFiniteNumber(input.pivotX) ||
        !isFiniteNumber(input.pivotY)
    ) {
        return {
            angleRad: 0,
            pivotX: 0,
            pivotY: 0,
        };
    }
    return input;
}

function rotatePoint(
    x: number,
    y: number,
    angleRad: number,
    pivotX: number,
    pivotY: number
): { x: number; y: number } {
    const dx = x - pivotX;
    const dy = y - pivotY;
    const cos = Math.cos(angleRad);
    const sin = Math.sin(angleRad);
    return {
        x: cos * dx - sin * dy + pivotX,
        y: sin * dx + cos * dy + pivotY,
    };
}

function unrotatePoint(
    x: number,
    y: number,
    angleRad: number,
    pivotX: number,
    pivotY: number
): { x: number; y: number } {
    return rotatePoint(x, y, -angleRad, pivotX, pivotY);
}

function screenLocalToWorld(
    localX: number,
    localY: number,
    camera: ResizeSemanticCamera,
    rotation: ResizeSemanticRotation
): { x: number; y: number } {
    const zoom = Math.max(MIN_ZOOM, camera.zoom);
    const pX = localX / zoom - camera.panX;
    const pY = localY / zoom - camera.panY;
    return unrotatePoint(pX, pY, rotation.angleRad, rotation.pivotX, rotation.pivotY);
}

export function computeCameraAfterResize(params: ComputeCameraAfterResizeParams): ResizeSemanticCamera {
    const mode = params.config?.mode ?? DEFAULT_BOXED_RESIZE_SEMANTIC_MODE;
    const prevViewport = params.prevViewport;
    const nextViewport = params.nextViewport;
    const camera = params.camera;

    if (!isFiniteSize(prevViewport) || !isFiniteSize(nextViewport)) {
        return camera;
    }
    if (!isFiniteCamera(camera)) {
        return camera;
    }
    if (mode === 'fit-world-bounds') {
        // Future mode: owned by containment policy and world bounds input.
        return camera;
    }

    const rotation = normalizeRotation(params.rotation);
    const oldAnchorLocal =
        mode === 'preserve-top-left-world'
            ? { x: -prevViewport.width / 2, y: -prevViewport.height / 2 }
            : { x: 0, y: 0 };
    const newAnchorLocal =
        mode === 'preserve-top-left-world'
            ? { x: -nextViewport.width / 2, y: -nextViewport.height / 2 }
            : { x: 0, y: 0 };
    const worldAnchor = screenLocalToWorld(oldAnchorLocal.x, oldAnchorLocal.y, camera, rotation);
    const rotatedAnchor = rotatePoint(
        worldAnchor.x,
        worldAnchor.y,
        rotation.angleRad,
        rotation.pivotX,
        rotation.pivotY
    );
    const zoom = Math.max(MIN_ZOOM, camera.zoom);
    const nextPanX = newAnchorLocal.x / zoom - rotatedAnchor.x;
    const nextPanY = newAnchorLocal.y / zoom - rotatedAnchor.y;

    if (!isFiniteNumber(nextPanX) || !isFiniteNumber(nextPanY)) {
        return camera;
    }

    return {
        panX: nextPanX,
        panY: nextPanY,
        zoom: camera.zoom,
    };
}

export function recordBoxedResizeEvent(): void {
    if (!isDev) return;
    counters.boxedResizeEventCount += 1;
}

export function recordBoxedResizeCameraAdjust(): void {
    if (!isDev) return;
    counters.boxedResizeCameraAdjustCount += 1;
}

export function getResizeSemanticsDebugSnapshot(): ResizeSemanticsCounters {
    return {
        boxedResizeEventCount: counters.boxedResizeEventCount,
        boxedResizeCameraAdjustCount: counters.boxedResizeCameraAdjustCount,
    };
}
