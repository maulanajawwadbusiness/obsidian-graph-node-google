import type { PhysicsEngine } from '../engine';
import type { PhysicsNode } from '../types';
import { getPassStats, type DebugStats } from './stats';

const ENABLE_PHYSICS_DEBUG_LOGS = false;

export const runPreRollPhase = (
    engine: PhysicsEngine,
    nodeList: PhysicsNode[],
    stats: DebugStats
) => {
    engine.preRollFrames--;

    if (engine.preRollFrames === 0 && ENABLE_PHYSICS_DEBUG_LOGS) {
        console.log('[PreRoll] Soft separation complete, velocities preserved');
    }

    const passStats = getPassStats(stats, 'PreRollPhase');
    passStats.nodes += nodeList.length;
};
