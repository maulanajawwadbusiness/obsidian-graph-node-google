import type { Dispatch, SetStateAction } from 'react';
import type { PhysicsEngine } from '../../physics/engine';
import type { PlaygroundMetrics } from '../playgroundTypes';
import type { RenderDebugInfo } from './renderingTypes';

type MetricsUpdater = (now: number, engine: PhysicsEngine) => void;

export const createMetricsTracker = (
    setMetrics: Dispatch<SetStateAction<PlaygroundMetrics>>,
    getRenderDebug?: () => RenderDebugInfo
): MetricsUpdater => {
    let frameCount = 0;
    let lastFpsTime = performance.now();
    let smoothedFps = 0;

    return (now, engine) => {
        frameCount++;
        const fpsDelta = now - lastFpsTime;

        if (fpsDelta < 100) {
            return;
        }

        const fpsRaw = (frameCount * 1000) / fpsDelta;
        smoothedFps = smoothedFps === 0 ? fpsRaw : (smoothedFps * 0.8 + fpsRaw * 0.2);
        const fps = Number(smoothedFps.toFixed(1));

        let totalVel = 0;
        let activeNodes = 0;
        engine.nodes.forEach(n => {
            const v = Math.sqrt(n.vx * n.vx + n.vy * n.vy);
            totalVel += v;
            if (v > 0) activeNodes++;
        });
        const avgVel = engine.nodes.size > 0 ? totalVel / engine.nodes.size : 0;

        let distSum = 0;
        let distSqSum = 0;
        let minX = Infinity;
        let maxX = -Infinity;
        let minY = Infinity;
        let maxY = -Infinity;

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

        const debugStats = engine.getDebugStats();
        const renderDebugBase = getRenderDebug ? getRenderDebug() : undefined;
        let renderDebug = renderDebugBase;

        if (renderDebugBase && debugStats) {
            renderDebug = {
                ...renderDebugBase,
                energyLedger: debugStats.energyLedger,
                fightLedger: debugStats.fightLedger
            };
        }

        setMetrics({
            nodes: engine.nodes.size,
            links: engine.links.length,
            fps: isNaN(fps) ? 0 : fps,
            avgVel: avgVel,
            activeNodes: activeNodes,
            avgDist,
            stdDist,
            aspectRatio: aspect,
            lifecycleMs: Math.round(engine.lifecycle * 1000),
            renderDebug,
            physicsHud: engine.getHudSnapshot()
        });

        frameCount = 0;
        lastFpsTime = now;
    };
};
