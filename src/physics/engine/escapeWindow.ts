import type { PhysicsEngine } from '../engine';

export const advanceEscapeWindow = (engine: PhysicsEngine) => {
    // ESCAPE WINDOW MANAGEMENT: decrement counters for trapped nodes
    // These nodes skip topology constraints to allow sliding out
    for (const [nodeId, frames] of engine.escapeWindow.entries()) {
        if (frames > 0) {
            engine.escapeWindow.set(nodeId, frames - 1);
        } else {
            engine.escapeWindow.delete(nodeId);
        }
    }
};
