import type { CameraState } from './renderingTypes';

export const updateCameraContainment = (
    cameraRef: { current: CameraState },
    nodes: Array<{ x: number; y: number; radius: number }>,
    width: number,
    height: number
) => {
    if (nodes.length === 0) return;

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    nodes.forEach(node => {
        minX = Math.min(minX, node.x - node.radius);
        maxX = Math.max(maxX, node.x + node.radius);
        minY = Math.min(minY, node.y - node.radius);
        maxY = Math.max(maxY, node.y + node.radius);
    });

    const aabbWidth = maxX - minX;
    const aabbHeight = maxY - minY;
    const aabbCenterX = (minX + maxX) / 2;
    const aabbCenterY = (minY + maxY) / 2;

    const marginPx = Math.min(width, height) * 0.15;
    const safeWidth = width - 2 * marginPx;
    const safeHeight = height - 2 * marginPx;

    const zoomX = safeWidth / aabbWidth;
    const zoomY = safeHeight / aabbHeight;
    const requiredZoom = Math.min(zoomX, zoomY, 1.0);

    const requiredPanX = -aabbCenterX;
    const requiredPanY = -aabbCenterY;

    const camera = cameraRef.current;
    camera.targetPanX = requiredPanX;
    camera.targetPanY = requiredPanY;
    camera.targetZoom = requiredZoom;

    const dampingFactor = 0.15;
    camera.panX += (camera.targetPanX - camera.panX) * dampingFactor;
    camera.panY += (camera.targetPanY - camera.panY) * dampingFactor;
    camera.zoom += (camera.targetZoom - camera.zoom) * dampingFactor;
};

export const applyCameraTransform = (
    ctx: CanvasRenderingContext2D,
    camera: CameraState,
    width: number,
    height: number,
    centroid: { x: number; y: number },
    angle: number
) => {
    ctx.translate(width / 2, height / 2);
    ctx.scale(camera.zoom, camera.zoom);
    ctx.translate(camera.panX, camera.panY);

    ctx.translate(centroid.x, centroid.y);
    ctx.rotate(angle);
    ctx.translate(-centroid.x, -centroid.y);
};
