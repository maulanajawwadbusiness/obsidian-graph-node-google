export const logVelocityDeLocking = (affectedCount: number) => {
    if (affectedCount > 0) {
        console.log(`[VelocityDeLocking] affected: ${affectedCount} nodes`);
    }
};

export const logStaticFrictionBypass = (affectedCount: number) => {
    if (affectedCount > 0) {
        console.log(`[StaticFrictionBypass] unlocked: ${affectedCount} nodes`);
    }
};
