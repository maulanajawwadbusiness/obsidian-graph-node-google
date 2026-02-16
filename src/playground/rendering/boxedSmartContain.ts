export type WorldBounds = {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
};

export type ViewportPx = {
    width: number;
    height: number;
};

export type CameraSnapshot = {
    panX: number;
    panY: number;
    zoom: number;
};

export type RotationSnapshot = {
    angleRad: number;
    pivotX: number;
    pivotY: number;
};

export type BoxedSmartContainPaddingPx = {
    top: number;
    right: number;
    bottom: number;
    left: number;
};

export type BoxedSmartContainInput = {
    boundsWorld: WorldBounds;
    viewportPx: ViewportPx;
    zoomMin: number;
    zoomMax: number;
    rotation?: RotationSnapshot;
    paddingPx?: BoxedSmartContainPaddingPx;
};

export type BoxedSmartContainCounters = {
    boxedSmartContainAppliedCount: number;
    boxedSmartContainSkippedUserInteractedCount: number;
    boxedSmartContainSkippedNoBoundsCount: number;
};

const IS_DEV = typeof import.meta !== 'undefined' && import.meta.env.DEV;
const MIN_ZOOM_EPS = 0.0001;
const DEFAULT_PADDING: BoxedSmartContainPaddingPx = {
    top: 64,
    right: 64,
    bottom: 96,
    left: 64,
};
const counters: BoxedSmartContainCounters = {
    boxedSmartContainAppliedCount: 0,
    boxedSmartContainSkippedUserInteractedCount: 0,
    boxedSmartContainSkippedNoBoundsCount: 0,
};

function isFiniteNumber(value: number): boolean {
    return Number.isFinite(value);
}

function rotateAroundPivot(
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

export function getWorldBoundsFromNodes(
    nodes: Array<{ x: number; y: number; radius: number }>
): WorldBounds | null {
    if (nodes.length === 0) return null;
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (let idx = 0; idx < nodes.length; idx += 1) {
        const n = nodes[idx];
        if (!isFiniteNumber(n.x) || !isFiniteNumber(n.y) || !isFiniteNumber(n.radius)) {
            continue;
        }
        minX = Math.min(minX, n.x - n.radius);
        maxX = Math.max(maxX, n.x + n.radius);
        minY = Math.min(minY, n.y - n.radius);
        maxY = Math.max(maxY, n.y + n.radius);
    }
    if (!isFiniteNumber(minX) || !isFiniteNumber(maxX) || !isFiniteNumber(minY) || !isFiniteNumber(maxY)) {
        return null;
    }
    return { minX, maxX, minY, maxY };
}

export function computeBoxedSmartContainCamera(input: BoxedSmartContainInput): CameraSnapshot | null {
    const { boundsWorld, viewportPx } = input;
    const padding = input.paddingPx ?? DEFAULT_PADDING;
    const rotation = input.rotation ?? { angleRad: 0, pivotX: 0, pivotY: 0 };
    if (
        !isFiniteNumber(viewportPx.width) ||
        !isFiniteNumber(viewportPx.height) ||
        viewportPx.width <= 1 ||
        viewportPx.height <= 1
    ) {
        return null;
    }

    const corners = [
        rotateAroundPivot(boundsWorld.minX, boundsWorld.minY, rotation.angleRad, rotation.pivotX, rotation.pivotY),
        rotateAroundPivot(boundsWorld.maxX, boundsWorld.minY, rotation.angleRad, rotation.pivotX, rotation.pivotY),
        rotateAroundPivot(boundsWorld.minX, boundsWorld.maxY, rotation.angleRad, rotation.pivotX, rotation.pivotY),
        rotateAroundPivot(boundsWorld.maxX, boundsWorld.maxY, rotation.angleRad, rotation.pivotX, rotation.pivotY),
    ];
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (let idx = 0; idx < corners.length; idx += 1) {
        const c = corners[idx];
        minX = Math.min(minX, c.x);
        maxX = Math.max(maxX, c.x);
        minY = Math.min(minY, c.y);
        maxY = Math.max(maxY, c.y);
    }
    const boundsW = Math.max(1, maxX - minX);
    const boundsH = Math.max(1, maxY - minY);
    const availableW = Math.max(1, viewportPx.width - Math.max(0, padding.left) - Math.max(0, padding.right));
    const availableH = Math.max(1, viewportPx.height - Math.max(0, padding.top) - Math.max(0, padding.bottom));
    const zoomX = availableW / boundsW;
    const zoomY = availableH / boundsH;
    const unclampedZoom = Math.min(zoomX, zoomY);
    const zoomMin = Math.max(MIN_ZOOM_EPS, input.zoomMin);
    const zoomMax = Math.max(zoomMin, input.zoomMax);
    const zoom = Math.min(zoomMax, Math.max(zoomMin, unclampedZoom));

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const viewportCenterX = 0;
    const viewportCenterY = 0;
    const panX = viewportCenterX / zoom - centerX;
    const panY = viewportCenterY / zoom - centerY;
    if (!isFiniteNumber(panX) || !isFiniteNumber(panY) || !isFiniteNumber(zoom)) {
        return null;
    }
    return { panX, panY, zoom };
}

export function getDefaultBoxedSmartContainPadding(): BoxedSmartContainPaddingPx {
    return { ...DEFAULT_PADDING };
}

export function recordBoxedSmartContainApplied(): void {
    if (!IS_DEV) return;
    counters.boxedSmartContainAppliedCount += 1;
}

export function recordBoxedSmartContainSkippedUserInteracted(): void {
    if (!IS_DEV) return;
    counters.boxedSmartContainSkippedUserInteractedCount += 1;
}

export function recordBoxedSmartContainSkippedNoBounds(): void {
    if (!IS_DEV) return;
    counters.boxedSmartContainSkippedNoBoundsCount += 1;
}

export function getBoxedSmartContainDebugSnapshot(): BoxedSmartContainCounters {
    return {
        boxedSmartContainAppliedCount: counters.boxedSmartContainAppliedCount,
        boxedSmartContainSkippedUserInteractedCount: counters.boxedSmartContainSkippedUserInteractedCount,
        boxedSmartContainSkippedNoBoundsCount: counters.boxedSmartContainSkippedNoBoundsCount,
    };
}
