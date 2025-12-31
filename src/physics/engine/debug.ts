export const logEnergyDebug = (lifecycle: number, energy: number, effectiveDamping: number, maxVelocityEffective: number) => {
    // DEBUG: Log energy info every 10 frames (~166ms at 60fps)
    if (Math.floor(lifecycle * 60) % 10 === 0) {
        console.log(`[Physics] Energy: ${(energy * 100).toFixed(1)}% | Damping: ${effectiveDamping.toFixed(2)} | MaxV: ${maxVelocityEffective.toFixed(0)}`);
    }
};
