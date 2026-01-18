import { useEffect, useRef } from 'react';
import type { Dispatch, RefObject, SetStateAction } from 'react';
import { PhysicsEngine } from '../physics/engine';
import { ForceConfig } from '../physics/types';
import { getNodeRadius, getOcclusionRadius, getTheme, SkinMode, lerpColor, ThemeConfig } from '../visual/theme';
import { generateRandomGraph } from './graphRandom';
import { PlaygroundMetrics } from './playgroundTypes';

type RenderSettingsRef = {
    useVariedSize: boolean;
    skinMode: SkinMode;
};

// Hover detection state
type HoverState = {
    hoveredNodeId: string | null;
    hoveredDistPx: number;
    cursorWorldX: number;
    cursorWorldY: number;
    lastLoggedId: string | null;  // For change detection (avoid log spam)
};

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

// -----------------------------------------------------------------------------
// Gradient Ring Drawing (Segmented Arcs)
// Rotation controlled by theme.gradientRotationDegrees
// -----------------------------------------------------------------------------
function drawGradientRing(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    radius: number,
    lineWidth: number,
    startColor: string,
    endColor: string,
    segments: number,
    rotationDegrees: number
) {
    ctx.save();  // Save canvas state to prevent leakage

    const segmentAngle = (Math.PI * 2) / segments;
    // Convert degrees to radians
    const rotationOffset = (rotationDegrees * Math.PI) / 180;

    for (let i = 0; i < segments; i++) {
        const t = i / segments;
        const color = lerpColor(startColor, endColor, t);

        ctx.beginPath();
        // Apply rotation offset to both start and end angles
        const startAngle = i * segmentAngle + rotationOffset - 0.02;
        const endAngle = (i + 1) * segmentAngle + rotationOffset + 0.02;
        ctx.arc(x, y, radius, startAngle, endAngle);
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.lineCap = 'butt';  // Changed from 'round' to prevent white edge artifacts
        ctx.stroke();
    }

    ctx.restore();  // Restore canvas state
}

// -----------------------------------------------------------------------------
// Vignette Background Drawing
// -----------------------------------------------------------------------------
function drawVignetteBackground(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    theme: ThemeConfig
) {
    if (!theme.useVignette) return;

    const centerX = width / 2;
    const centerY = height / 2;
    const maxRadius = Math.max(width, height) * 0.75;

    const gradient = ctx.createRadialGradient(
        centerX, centerY, 0,
        centerX, centerY, maxRadius
    );
    gradient.addColorStop(0, theme.vignetteCenterColor);
    gradient.addColorStop(theme.vignetteStrength, theme.vignetteEdgeColor);
    gradient.addColorStop(1, theme.vignetteEdgeColor);

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
}

// -----------------------------------------------------------------------------
// Two-Layer Glow Drawing
// -----------------------------------------------------------------------------
function drawTwoLayerGlow(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    radius: number,
    theme: ThemeConfig
) {
    // Outer glow first (purple, wider, fainter)
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, radius + theme.glowOuterRadius, 0, Math.PI * 2);
    ctx.fillStyle = theme.glowOuterColor;
    ctx.filter = `blur(${theme.glowOuterRadius}px)`;
    ctx.fill();
    ctx.restore();

    // Inner glow second (blue, tighter, brighter)
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, radius + theme.glowInnerRadius, 0, Math.PI * 2);
    ctx.fillStyle = theme.glowInnerColor;
    ctx.filter = `blur(${theme.glowInnerRadius}px)`;
    ctx.fill();
    ctx.restore();
}

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
    // Camera State (for automatic framing)
    const cameraRef = useRef({
        panX: 0,
        panY: 0,
        zoom: 1.0,
        targetPanX: 0,
        targetPanY: 0,
        targetZoom: 1.0
    });

    // Ref for Loop Access (allows render loop to access React state)
    const settingsRef = useRef<RenderSettingsRef>({ useVariedSize: true, skinMode: 'normal' });

    // Hover state (for pointer detection)
    const hoverStateRef = useRef<HoverState>({
        hoveredNodeId: null,
        hoveredDistPx: 0,
        cursorWorldX: 0,
        cursorWorldY: 0,
        lastLoggedId: null
    });

    useEffect(() => {
        settingsRef.current.useVariedSize = useVariedSize;
        settingsRef.current.skinMode = skinMode;
    }, [useVariedSize, skinMode]);

    // -------------------------------------------------------------------------
    // Pointer Event Handlers (returned for component to wire up)
    // -------------------------------------------------------------------------

    /**
     * Transform CSS pixel coordinates to world coordinates
     * Uses getBoundingClientRect for CSS space (avoids DPR issues)
     */
    const cssToWorld = (clientX: number, clientY: number, rect: DOMRect) => {
        const camera = cameraRef.current;

        // CSS pixel position relative to canvas center
        const cssX = clientX - rect.left - rect.width / 2;
        const cssY = clientY - rect.top - rect.height / 2;

        // Invert camera transform: screen → world
        const worldX = cssX / camera.zoom - camera.panX;
        const worldY = cssY / camera.zoom - camera.panY;

        return { x: worldX, y: worldY };
    };

    /**
     * Find nearest node within hit radius (whole disc, not just ring)
     * Uses the same scaled radius as rendering for accurate hit detection.
     */
    const findNearestNode = (worldX: number, worldY: number, theme: ThemeConfig) => {
        const engine = engineRef.current;
        if (!engine) return { nodeId: null, dist: Infinity, hitRadius: 0 };

        let nearestId: string | null = null;
        let nearestDist = Infinity;
        let nearestHitRadius = 0;

        engine.nodes.forEach((node) => {
            const dx = node.x - worldX;
            const dy = node.y - worldY;
            const dist = Math.sqrt(dx * dx + dy * dy);

            // Calculate the actual rendered radius (same as in draw loop)
            const baseRadius = settingsRef.current.useVariedSize ? node.radius : 5.0;
            const renderedRadius = getNodeRadius(baseRadius, theme);

            // Hit radius = rendered radius + small padding for forgiving feel
            const hitRadius = renderedRadius + 2;

            if (dist <= hitRadius && dist < nearestDist) {
                nearestId = node.id;
                nearestDist = dist;
                nearestHitRadius = hitRadius;
            }
        });

        return { nodeId: nearestId, dist: nearestDist, hitRadius: nearestHitRadius };
    };

    /**
     * Handle pointer move - update hover state
     */
    const handlePointerMove = (clientX: number, clientY: number, rect: DOMRect) => {
        const theme = getTheme(settingsRef.current.skinMode);
        const { x: worldX, y: worldY } = cssToWorld(clientX, clientY, rect);

        hoverStateRef.current.cursorWorldX = worldX;
        hoverStateRef.current.cursorWorldY = worldY;

        const { nodeId, dist, hitRadius } = findNearestNode(worldX, worldY, theme);

        hoverStateRef.current.hoveredNodeId = nodeId;
        hoverStateRef.current.hoveredDistPx = dist;

        // Debug logging (only on change)
        if (theme.hoverDebugEnabled && nodeId !== hoverStateRef.current.lastLoggedId) {
            console.log(`hover: ${hoverStateRef.current.lastLoggedId} -> ${nodeId} (dist=${dist.toFixed(1)}, hitR=${hitRadius.toFixed(1)})`);
            hoverStateRef.current.lastLoggedId = nodeId;
        }
    };

    /**
     * Handle pointer leave - clear hover state
     */
    const handlePointerLeave = () => {
        const theme = getTheme(settingsRef.current.skinMode);

        if (theme.hoverDebugEnabled && hoverStateRef.current.hoveredNodeId !== null) {
            console.log(`hover: ${hoverStateRef.current.hoveredNodeId} -> null (pointer left canvas)`);
        }

        hoverStateRef.current.hoveredNodeId = null;
        hoverStateRef.current.hoveredDistPx = 0;
        hoverStateRef.current.lastLoggedId = null;
    };

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let frameId = 0;
        let lastTime = performance.now();
        let frameCount = 0;
        let lastFpsTime = lastTime;

        const engine = engineRef.current;
        if (!engine) return;

        // Initial Spawn if empty
        if (engine.nodes.size === 0) {
            const { nodes, links } = generateRandomGraph(spawnCount, config.targetSpacing, config.initScale, seed);
            nodes.forEach(n => engine.addNode(n));
            links.forEach(l => engine.addLink(l));
        }

        // Init bounds
        if (canvas) {
            engine.updateBounds(canvas.width, canvas.height);
        }

        const render = () => {
            const now = performance.now();

            // 1. Calc Delta Time
            const dtMs = now - lastTime;
            const dt = Math.min(dtMs / 1000, 0.1); // Cap at 100ms
            lastTime = now;

            // 2. Physics Tick
            engine.tick(dt);

            // 3. Draw
            // Resize canvas to window (simple approach)
            if (canvas.width !== canvas.offsetWidth || canvas.height !== canvas.offsetHeight) {
                canvas.width = canvas.offsetWidth;
                canvas.height = canvas.offsetHeight;
                engine.updateBounds(canvas.width, canvas.height); // Sync bounds
            }

            const width = canvas.width;
            const height = canvas.height;

            // Get current theme based on skin mode
            const theme = getTheme(settingsRef.current.skinMode);

            // Clear and draw background
            ctx.clearRect(0, 0, width, height);

            // Draw vignette background (before camera transform)
            drawVignetteBackground(ctx, width, height, theme);

            // CAMERA LEASH CONTAINMENT
            // Calculate node AABB in world space
            const nodes = Array.from(engine.nodes.values());
            if (nodes.length > 0) {
                let minX = Infinity, maxX = -Infinity;
                let minY = Infinity, maxY = -Infinity;

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

                // Define safe rect (viewport inset by margin)
                const marginPx = Math.min(width, height) * 0.15;
                const safeWidth = width - 2 * marginPx;
                const safeHeight = height - 2 * marginPx;

                // Calculate required zoom to fit AABB in safe rect
                const zoomX = safeWidth / aabbWidth;
                const zoomY = safeHeight / aabbHeight;
                const requiredZoom = Math.min(zoomX, zoomY, 1.0); // Don't zoom in past 1.0

                // Calculate required pan to center AABB
                const requiredPanX = -aabbCenterX;
                const requiredPanY = -aabbCenterY;

                // Update camera targets
                const camera = cameraRef.current;
                camera.targetPanX = requiredPanX;
                camera.targetPanY = requiredPanY;
                camera.targetZoom = requiredZoom;

                // Smooth damping (fast settle ~200-300ms)
                const dampingFactor = 0.15; // Higher = faster
                camera.panX += (camera.targetPanX - camera.panX) * dampingFactor;
                camera.panY += (camera.targetPanY - camera.panY) * dampingFactor;
                camera.zoom += (camera.targetZoom - camera.zoom) * dampingFactor;
            }

            // Apply camera transform
            ctx.save();
            const camera = cameraRef.current;
            ctx.translate(width / 2, height / 2);
            ctx.scale(camera.zoom, camera.zoom);
            ctx.translate(camera.panX, camera.panY);

            // Apply global rotation (rotating reference frame)
            // Rotate entire graph around centroid
            const centroid = engine.getCentroid();
            const globalAngle = engine.getGlobalAngle();
            ctx.translate(centroid.x, centroid.y);
            ctx.rotate(globalAngle);
            ctx.translate(-centroid.x, -centroid.y);

            // Draw Links (before nodes so occlusion works)
            ctx.strokeStyle = theme.linkColor;
            ctx.lineWidth = theme.linkWidth;
            engine.links.forEach((link) => {
                const source = engine.nodes.get(link.source);
                const target = engine.nodes.get(link.target);
                if (source && target) {
                    ctx.beginPath();
                    ctx.moveTo(source.x, source.y);
                    ctx.lineTo(target.x, target.y);
                    ctx.stroke();
                }
            });

            // Draw Nodes
            engine.nodes.forEach((node) => {
                // SIZE TOGGLE LOGIC - apply theme multiplier
                const baseRadius = settingsRef.current.useVariedSize ? node.radius : 5.0;
                const radius = getNodeRadius(baseRadius, theme);

                if (theme.nodeStyle === 'ring') {
                    // ELEGANT MODE: Occlusion disk + glow + gradient ring

                    // 1. Draw occlusion disk (hides links under node)
                    const occlusionRadius = getOcclusionRadius(radius, theme);
                    ctx.beginPath();
                    ctx.arc(node.x, node.y, occlusionRadius, 0, Math.PI * 2);
                    ctx.fillStyle = theme.occlusionColor;
                    ctx.fill();

                    // 2. Draw glow
                    if (theme.useTwoLayerGlow) {
                        // V2: Two-layer glow (purple outer + blue inner)
                        drawTwoLayerGlow(ctx, node.x, node.y, radius, theme);
                    } else if (theme.glowEnabled) {
                        // V1: Single layer glow (fallback)
                        ctx.save();
                        ctx.beginPath();
                        ctx.arc(node.x, node.y, radius + theme.glowRadius, 0, Math.PI * 2);
                        ctx.fillStyle = theme.glowColor;
                        ctx.filter = `blur(${theme.glowRadius}px)`;
                        ctx.fill();
                        ctx.restore();
                    }

                    // 3. Draw ring stroke
                    if (theme.useGradientRing) {
                        // V2: Gradient ring (blue → purple)
                        // Determine primary blue based on hover state
                        const isHovered = node.id === hoverStateRef.current.hoveredNodeId;
                        const primaryBlue = isHovered ? theme.primaryBlueHover : theme.primaryBlueDefault;

                        drawGradientRing(
                            ctx,
                            node.x,
                            node.y,
                            radius,
                            theme.ringWidth,
                            node.isFixed ? theme.nodeFixedColor : primaryBlue,
                            theme.deepPurple,
                            theme.ringGradientSegments,
                            theme.gradientRotationDegrees
                        );
                    } else {
                        // V1: Flat ring stroke (fallback)
                        ctx.beginPath();
                        ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
                        ctx.strokeStyle = node.isFixed ? theme.nodeFixedColor : theme.ringColor;
                        ctx.lineWidth = theme.ringWidth;
                        ctx.stroke();
                    }

                } else {
                    // NORMAL MODE: Filled circle (original behavior)
                    ctx.beginPath();
                    ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);

                    // Style dependent on state
                    if (node.isFixed) {
                        ctx.fillStyle = theme.nodeFixedColor;
                    } else {
                        ctx.fillStyle = theme.nodeFillColor;
                    }

                    ctx.fill();
                    ctx.strokeStyle = theme.nodeStrokeColor;
                    ctx.lineWidth = theme.nodeStrokeWidth;
                    ctx.stroke();
                }
            });

            // Debug overlay: draw hit circle around hovered node
            if (theme.hoverDebugEnabled && hoverStateRef.current.hoveredNodeId) {
                const hoveredNode = engine.nodes.get(hoverStateRef.current.hoveredNodeId);
                if (hoveredNode) {
                    const baseRadius = settingsRef.current.useVariedSize ? hoveredNode.radius : 5.0;
                    const renderedRadius = getNodeRadius(baseRadius, theme);
                    const hitRadius = renderedRadius + 2;

                    // Draw faint hit circle
                    ctx.beginPath();
                    ctx.arc(hoveredNode.x, hoveredNode.y, hitRadius, 0, Math.PI * 2);
                    ctx.strokeStyle = 'rgba(255, 255, 0, 0.5)';
                    ctx.lineWidth = 1;
                    ctx.setLineDash([4, 4]);
                    ctx.stroke();
                    ctx.setLineDash([]);
                }
            }

            ctx.restore();

            // FPS & Stats Calc
            frameCount++;
            const fpsDelta = now - lastFpsTime;

            if (fpsDelta >= 100) { // Update every 100ms
                const fps = Math.round((frameCount * 1000) / fpsDelta);

                // Calc Average Kinetic Energy / Velocity
                let totalVel = 0;
                let activeNodes = 0;
                engine.nodes.forEach(n => {
                    const v = Math.sqrt(n.vx * n.vx + n.vy * n.vy);
                    totalVel += v;
                    if (v > 0) activeNodes++;
                });
                const avgVel = engine.nodes.size > 0 ? totalVel / engine.nodes.size : 0;

                // Shape Analysis
                let distSum = 0;
                let distSqSum = 0;
                let minX = Infinity, maxX = -Infinity;
                let minY = Infinity, maxY = -Infinity;

                engine.nodes.forEach(n => {
                    const d = Math.sqrt(n.x * n.x + n.y * n.y);
                    distSum += d;
                    distSqSum += d * d;
                    minX = Math.min(minX, n.x);
                    maxX = Math.max(maxX, n.x);
                    minY = Math.min(minY, n.y);
                    maxY = Math.max(maxY, n.y);
                });

                const count = engine.nodes.size;
                const avgDist = count > 0 ? distSum / count : 0;
                const variance = count > 0 ? (distSqSum / count) - (avgDist * avgDist) : 0;
                const stdDist = Math.sqrt(Math.max(0, variance));

                const shapeW = maxX - minX;
                const shapeH = maxY - minY;
                const aspect = (shapeH > 0.1) ? shapeW / shapeH : 1.0;

                setMetrics({
                    nodes: engine.nodes.size,
                    links: engine.links.length,
                    fps: isNaN(fps) ? 0 : fps,
                    avgVel: avgVel,
                    activeNodes: activeNodes,
                    avgDist,
                    stdDist,
                    aspectRatio: aspect,
                    lifecycleMs: Math.round(engine.lifecycle * 1000)
                });

                frameCount = 0;
                lastFpsTime = now;
            }

            frameId = requestAnimationFrame(render);
        };

        frameId = requestAnimationFrame(render);
        return () => cancelAnimationFrame(frameId);
    }, []);

    // Return pointer handlers for component to wire up
    return {
        handlePointerMove,
        handlePointerLeave
    };
};
