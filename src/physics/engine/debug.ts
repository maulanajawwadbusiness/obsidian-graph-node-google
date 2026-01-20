const LOG_INTERVAL_MS = 4000;
let lastLogTime = 0;

export const logEnergyDebug = (_lifecycle: number, energy: number, effectiveDamping: number, maxVelocityEffective: number) => {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (now - lastLogTime < LOG_INTERVAL_MS) {
        return;
    }
    lastLogTime = now;
    console.log(`[Physics] Energy: ${(energy * 100).toFixed(1)}% | Damping: ${effectiveDamping.toFixed(2)} | MaxV: ${maxVelocityEffective.toFixed(0)}`);
};
