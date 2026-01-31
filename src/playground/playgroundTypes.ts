import type { RenderDebugInfo } from './rendering/renderingTypes';
import type { PhysicsHudSnapshot } from '../physics/engine/physicsHud';

export type PlaygroundMetrics = {
    nodes: number;
    links: number;
    fps: number;
    avgVel: number;
    activeNodes: number;
    avgDist: number;
    stdDist: number;
    aspectRatio: number;
    lifecycleMs: number;
    renderDebug?: RenderDebugInfo;
    physicsHud?: PhysicsHudSnapshot;
};
