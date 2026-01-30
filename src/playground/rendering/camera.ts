import type { CameraState } from './renderingTypes';

export class CameraTransform {
    private width: number;
    private height: number;
    private zoom: number;
    private panX: number;
    private panY: number;
    private angle: number;
    private cx: number;
    private cy: number;
    private pixelSnapping: boolean;

    constructor(
        width: number,
        height: number,
        zoom: number,
        panX: number,
        panY: number,
        angle: number,
        centroid: { x: number, y: number },
        pixelSnapping: boolean = false
    ) {
        this.width = width;
        this.height = height;
        // Fix 6: Degenerate Zoom Guard (Prevent Divide-by-Zero)
        this.zoom = Math.max(zoom, 0.0001);
        this.panX = panX;
        this.panY = panY;
        this.angle = angle;
        this.cx = centroid.x;
        this.cy = centroid.y;
        this.pixelSnapping = pixelSnapping;
    }

    /**
     * Unified Transform Authority
     * Formula: Screen = Center + Zoom * (Pan + RotateAround(World - Centroid))
     * Actually: Screen = Center + Zoom * (Pan + Rotate(World - Centroid) + Centroid - Centroid?)
     * Let's stick to the verified stack:
     * T(Center) * S(Zoom) * T(Pan) * T(C) * R(Angle) * T(-C)
     */
    public applyToContext(ctx: CanvasRenderingContext2D) {
        let { width, height, zoom, panX, panY, angle, cx, cy } = this;

        // Fix 5: Pixel Snapping Policy
        // Snap the effective screen offset to nearest screen pixel
        if (this.pixelSnapping) {
            panX = Math.round(panX * zoom) / zoom;
            panY = Math.round(panY * zoom) / zoom;
        }

        ctx.translate(width / 2, height / 2);
        ctx.scale(zoom, zoom);
        ctx.translate(panX, panY);

        // Rotate around centroid
        ctx.translate(cx, cy);
        ctx.rotate(angle);
        ctx.translate(-cx, -cy);
    }

    public worldToScreen(worldX: number, worldY: number): { x: number, y: number } {
        let { width, height, zoom, panX, panY, angle, cx, cy } = this;

        // Fix 5: Pixel Snapping Policy (Symmetry)
        if (this.pixelSnapping) {
            panX = Math.round(panX * zoom) / zoom;
            panY = Math.round(panY * zoom) / zoom;
        }

        // 1. Rotate around centroid
        // x_rot = cos(a)(x-cx) - sin(a)(y-cy) + cx
        const dx = worldX - cx;
        const dy = worldY - cy;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const rx = cos * dx - sin * dy + cx;
        const ry = sin * dx + cos * dy + cy;

        // 2. Pan (in unzoomed pixels)
        const px = rx + panX;
        const py = ry + panY;

        // 3. Zoom
        const zx = px * zoom;
        const zy = py * zoom;

        // 4. Center
        const sx = zx + width / 2;
        const sy = zy + height / 2;

        return { x: sx, y: sy };
    }

    public clientToWorld(clientX: number, clientY: number, rect: DOMRect): { x: number, y: number } {
        // Fix 7: Degenerate Rect Guard (Prevent NaNs)
        if (rect.width === 0 || rect.height === 0) {
            return { x: this.cx, y: this.cy };
        }
        let { zoom, panX, panY, angle, cx, cy } = this;

        // Fix 5: Pixel Snapping Policy (Symmetry)
        if (this.pixelSnapping) {
            panX = Math.round(panX * zoom) / zoom;
            panY = Math.round(panY * zoom) / zoom;
        }

        // 0. CSS relative to center
        const sx = clientX - rect.left;
        const sy = clientY - rect.top;
        const cssX = sx - rect.width / 2;
        const cssY = sy - rect.height / 2;

        // 1. Unzoom
        const zx = cssX / zoom;
        const zy = cssY / zoom;

        // 2. Unpan
        const px = zx - panX;
        const py = zy - panY;

        // 3. Unrotate around centroid
        // p = R(w - c) + c  =>  w - c = R'(p - c)
        // w = R'(p - c) + c
        const dx = px - cx;
        const dy = py - cy;
        const cos = Math.cos(-angle);
        const sin = Math.sin(-angle);
        const wx = cos * dx - sin * dy + cx;
        const wy = sin * dx + cos * dy + cy;

        return { x: wx, y: wy };
    }
}

/**
 * Update camera target with Deadzone and Snap logic.
 * Call this every frame before rendering.
 */
/**
 * Update camera target with Deadzone and Snap logic.
 * Call this every frame before rendering.
 */
export const updateCameraContainment = (
    cameraRef: { current: CameraState },
    nodes: Array<{ x: number; y: number; radius: number }>,
    width: number,
    height: number,
    dt: number, // Time delta in seconds
    locked: boolean = false, // "Camera Lock" debug toggle
    angle: number = 0,       // Fix 19: Rotation Awareness
    pivot: { x: number, y: number } = { x: 0, y: 0 }, // Fix 19: Rotation Pivot
    isInteraction: boolean = false // Fix 45: Causality Snap (No Ghost Motion)
) => {
    if (locked) return;
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
    // Target Center (World Space)
    const tx = (minX + maxX) / 2;
    const ty = (minY + maxY) / 2;

    const marginPx = Math.min(width, height) * 0.15;
    const safeWidth = width - 2 * marginPx;
    const safeHeight = height - 2 * marginPx;

    const zoomX = safeWidth / Math.max(aabbWidth, 1);
    const zoomY = safeHeight / Math.max(aabbHeight, 1);
    const requiredZoom = Math.min(zoomX, zoomY, 1.0);

    // FIX 19: Rotation-Aware Pan Calculation
    // We want the Target Center (tx, ty) to map to Screen Center (0,0).
    // The transformation stack applies Pan *before* Rotation (relative to the context stack),
    // but the Rotation happens around a Pivot (cx, cy).
    // Formula: Pan = - [ R(angle) * (Target - Pivot) + Pivot ]
    // This ensures that after Rotation+Pivot, the Target lands at -Pan, which cancels out to 0.

    const dx = tx - pivot.x;
    const dy = ty - pivot.y;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    // Rotate delta around 0
    const rdx = cos * dx - sin * dy;
    const rdy = sin * dx + cos * dy;

    // Add Pivot back
    const rotatedTargetX = rdx + pivot.x;
    const rotatedTargetY = rdy + pivot.y;

    const requiredPanX = -rotatedTargetX;
    const requiredPanY = -rotatedTargetY;

    const camera = cameraRef.current;

    // FIX 29: Screen-Space Deadzone (Pixel Consistency)
    // Interpret thresholds as SCREEN PIXELS, not World Units.
    // Thresholds scale with 1/Zoom to remain visibly constant.
    const pixelScale = 1.0 / Math.max(0.0001, camera.zoom);

    // Deadzone: 0.1 screen pixels (Virtually invisible, stops micro-drift but allows intent)
    const deadzone = 0.1 * pixelScale;

    if (Math.abs(requiredPanX - camera.targetPanX) > deadzone) {
        camera.targetPanX = requiredPanX;
    }
    if (Math.abs(requiredPanY - camera.targetPanY) > deadzone) {
        camera.targetPanY = requiredPanY;
    }
    // For zoom, use smaller threshold
    if (Math.abs(requiredZoom - camera.targetZoom) > 0.001) {
        camera.targetZoom = requiredZoom;
    }

    // FIX 3: DT-Correct Smoothing (Decay)
    // Old: pan += diff * 0.15 (Frame dependent)
    // New: Lerp with time constant.
    // 0.15 at 60hz => ~90% correction in ~14 frames (~230ms)
    // Decay factor lambda: target = current + (target - current) * (1 - exp(-lambda * dt))
    // FIX 26: Human Snappiness (Remove Syrup)
    // Old: lambda=4.0 (Too slow, ~600ms settle)
    // New: lambda=15.0 (Snappy, ~150ms settle). Small moves are instant, big moves are smooth.
    // FIX 45: Causality Snap (Kill Ghost Motion)
    // If user is interacting, we want 1:1 response. No smoothing.
    const lambda = 15.0;
    const alpha = isInteraction ? 1.0 : (1.0 - Math.exp(-lambda * dt));

    camera.panX += (camera.targetPanX - camera.panX) * alpha;
    camera.panY += (camera.targetPanY - camera.panY) * alpha;
    camera.zoom += (camera.targetZoom - camera.zoom) * alpha;

    // FIX 30: Invisible Snap (No Jumps)
    // Snap only when error is visibly zero (0.01 screen pixels)
    const snapPixels = 0.01 * pixelScale;
    const snapZoom = 0.0005;

    if (Math.abs(camera.targetPanX - camera.panX) < snapPixels) {
        camera.panX = camera.targetPanX;
    }
    if (Math.abs(camera.targetPanY - camera.panY) < snapPixels) {
        camera.panY = camera.targetPanY;
    }
    if (Math.abs(camera.targetZoom - camera.zoom) < snapZoom) {
        camera.zoom = camera.targetZoom;
    }
};

/**
 * FORENSIC VERIFICATION TOOL ("Knife Test")
 * Brute-force checks that clientToWorld is the exact inverse of worldToScreen
 * logs max error. Should be < 1e-9 (floating point noise only).
 */
export const verifyMappingIntegrity = () => {
    const width = 1000;
    const height = 800;
    const rect = { left: 100, top: 100, width, height } as DOMRect;

    // Test Case: Complex Transform
    const t = new CameraTransform(
        width, height,
        1.234,      // Zoom
        50.5,       // PanX
        -20.123,    // PanY 
        0.5,        // Angle
        { x: 300, y: 300 }, // Centroid
        true        // Snapping ENABLED (Hardest Case)
    );

    let maxError = 0;
    for (let i = 0; i < 100; i++) {
        // Random World Point
        const wx = (Math.random() - 0.5) * 5000;
        const wy = (Math.random() - 0.5) * 5000;

        // Forward
        const screen = t.worldToScreen(wx, wy);

        // Inverse
        // Mock ClientX: ScreenX + Rect.left (since sx is relative to rect)
        // Wait, worldToScreen returns sx relative to rect top-left (0,0 is corner)
        // clientToWorld takes raw client coords (sx + rect.left)
        const clientX = screen.x + rect.left;
        const clientY = screen.y + rect.top;

        const result = t.clientToWorld(clientX, clientY, rect);

        const dx = Math.abs(result.x - wx);
        const dy = Math.abs(result.y - wy);
        maxError = Math.max(maxError, dx, dy);
    }

    if (maxError > 0.0001) {
        console.error(`[KnifeTest] FAILURE. Max drift: ${maxError.toFixed(6)}px`);
    } else if (Math.random() < 0.01) {
        // Log rarely to prove it runs
        console.log(`[KnifeTest] PASSED. Max drift: ${maxError.toExponential(2)}px`);
    }
    return maxError;
};
