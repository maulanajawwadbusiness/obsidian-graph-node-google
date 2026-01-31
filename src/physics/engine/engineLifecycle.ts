import type { ForceConfig } from '../types';
import { createInitialPhysicsHudHistory, createInitialPhysicsHudSnapshot, type PhysicsHudHistory, type PhysicsHudSnapshot } from './physicsHud';
import { getNowMs } from './engineTime';

export type PhysicsEngineLifecycleContext = {
    config: ForceConfig;
    lifecycle: number;
    hasFiredImpulse: boolean;
    preRollFrames: number;
    spacingGate: number;
    spacingGateActive: boolean;
    hudSnapshot: PhysicsHudSnapshot;
    hudHistory: PhysicsHudHistory;
    hudSettleState: PhysicsHudSnapshot['settleState'];
    hudSettleStateAt: number;
    wakeAll: () => void;
    invalidateWarmStart: (reason: string) => void;
    resetStartupStats: () => void;
};

export const resetLifecycle = (engine: PhysicsEngineLifecycleContext) => {
    engine.lifecycle = 0;
    engine.hasFiredImpulse = false;
    engine.preRollFrames = engine.config.initStrategy === 'legacy' ? 5 : 0;
    engine.spacingGate = 0;
    engine.spacingGateActive = false;
    engine.wakeAll();
    engine.invalidateWarmStart('RESET_LIFECYCLE');
    engine.hudSnapshot = createInitialPhysicsHudSnapshot();
    engine.hudHistory = createInitialPhysicsHudHistory();
    engine.hudSettleState = 'moving';
    engine.hudSettleStateAt = getNowMs();
    engine.resetStartupStats();
};
