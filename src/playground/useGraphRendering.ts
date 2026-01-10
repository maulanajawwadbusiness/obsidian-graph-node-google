import { useEffect } from 'react';
import type { Dispatch, MutableRefObject, RefObject, SetStateAction } from 'react';
import { PhysicsEngine } from '../physics/engine';
import { ForceConfig } from '../physics/types';
import {
    drawBackground,
    getOcclusionRadius,
    getRenderNodeRadius,
    getRingThickness,
    GraphTheme
} from './graphThemes';
import { generateRandomGraph } from './randomGraph';

const FRAME_TIME_MS = 100;
const MAX_FRAME_DT = 0.1;
const CAMERA_DAMPING_FACTOR = 0.15;

type SettingsRef = {
    useVariedSize: boolean;
};

type CameraState = {
    panX: number;
    panY: number;
    zoom: number;
    targetPanX: number;
    targetPanY: number;
    targetZoom: number;
};

type MetricsState = {
    nodes: number;
    links: number;
    fps: number;
    avgVel: number;
    activeNodes: number;
    avgDist: number;
    stdDist: number;
    aspectRatio: number;
    lifecycleMs: number;
};

type GraphRenderingParams = {
    canvasRef: RefObject<HTMLCanvasElement>;
    engineRef: MutableRefObject<PhysicsEngine>;
    config: ForceConfig;
    spawnCount: number;
    seed: number;
    settingsRef: MutableRefObject<SettingsRef>;
    themeRef: MutableRefObject<GraphTheme>;
    cameraRef: MutableRefObject<CameraState>;
    setMetrics: Dispatch<SetStateAction<MetricsState>>;
};

export const useGraphRendering = ({
    canvasRef,
    engineRef,
    config,
    spawnCount,
    seed,
    settingsRef,
    themeRef,
    cameraRef,
    setMetrics
}: GraphRenderingParams) => {
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
            const dt = Math.min(dtMs / 1000, MAX_FRAME_DT); // Cap at 100ms
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

            ctx.clearRect(0, 0, width, height);
            drawBackground(ctx, width, height, themeRef.current);

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
                camera.panX += (camera.targetPanX - camera.panX) * CAMERA_DAMPING_FACTOR;
                camera.panY += (camera.targetPanY - camera.panY) * CAMERA_DAMPING_FACTOR;
                camera.zoom += (camera.targetZoom - camera.zoom) * CAMERA_DAMPING_FACTOR;
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

            const theme = themeRef.current;

            // Draw Links
            ctx.strokeStyle = theme.link.color;
            ctx.lineWidth = theme.link.thickness;
            ctx.lineCap = 'round';
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

            // Draw Occlusion Disks (to hide links under nodes)
            engine.nodes.forEach((node) => {
                const radius = getRenderNodeRadius(node, theme, settingsRef.current.useVariedSize);
                const ringThickness = getRingThickness(radius, theme);
                const occlusionRadius = getOcclusionRadius(radius, ringThickness, theme);
                ctx.beginPath();
                ctx.arc(node.x, node.y, occlusionRadius, 0, Math.PI * 2);
                ctx.fillStyle = theme.node.occlusionColor;
                ctx.fill();
            });

            // Draw Nodes
            engine.nodes.forEach((node) => {
                const radius = getRenderNodeRadius(node, theme, settingsRef.current.useVariedSize);

                if (theme.node.style === 'ring') {
                    const ringThickness = getRingThickness(radius, theme);

                    ctx.beginPath();
                    ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
                    ctx.strokeStyle = theme.node.ringColor;
                    ctx.lineWidth = ringThickness;
                    ctx.stroke();

                    if (theme.node.innerRimColor) {
                        ctx.beginPath();
                        ctx.arc(node.x, node.y, radius - ringThickness * 0.25, 0, Math.PI * 2);
                        ctx.strokeStyle = theme.node.innerRimColor;
                        ctx.lineWidth = Math.max(0.6, ringThickness * 0.35);
                        ctx.stroke();
                    }

                    if (theme.node.glowBlur > 0) {
                        ctx.save();
                        ctx.shadowBlur = theme.node.glowBlur;
                        ctx.shadowColor = theme.node.glowColor;
                        ctx.strokeStyle = theme.node.glowColor;
                        ctx.lineWidth = ringThickness * 1.1;
                        ctx.beginPath();
                        ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
                        ctx.stroke();
                        ctx.restore();
                    }
                } else {
                    ctx.beginPath();
                    ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
                    ctx.fillStyle = node.isFixed ? '#ff4444' : theme.node.fillColor;
                    ctx.fill();
                    ctx.strokeStyle = theme.node.strokeColor;
                    ctx.lineWidth = theme.node.strokeWidth;
                    ctx.stroke();
                }
            });

            ctx.restore();

            // FPS & Stats Calc
            frameCount++;
            const fpsDelta = now - lastFpsTime;

            if (fpsDelta >= FRAME_TIME_MS) {
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
    }, []); // Run once on mount
};
