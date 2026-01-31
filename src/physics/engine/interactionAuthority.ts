import type { MotionPolicy } from './motionPolicy';

export type InteractionAuthorityPolicy = {
    localBoostFrames: number;
    localBoostStrength: number;
    localBoostRadius: number;
    releaseVelocity: { vx: number; vy: number } | null;
    releaseReason: string | null;
};

export const computeInteractionAuthorityPolicy = (
    motionPolicy: MotionPolicy,
    dragVelocity: { vx: number; vy: number } | null
): InteractionAuthorityPolicy => {
    const { localBoostFrames, localBoostStrength, localBoostRadius, releaseDamping, maxReleaseSpeed } =
        motionPolicy.interaction;

    if (!dragVelocity) {
        return {
            localBoostFrames,
            localBoostStrength,
            localBoostRadius,
            releaseVelocity: null,
            releaseReason: null,
        };
    }

    const rawVx = dragVelocity.vx * releaseDamping;
    const rawVy = dragVelocity.vy * releaseDamping;
    const speed = Math.hypot(rawVx, rawVy);
    const scale = speed > maxReleaseSpeed ? maxReleaseSpeed / speed : 1;

    return {
        localBoostFrames,
        localBoostStrength,
        localBoostRadius,
        releaseVelocity: {
            vx: rawVx * scale,
            vy: rawVy * scale,
        },
        releaseReason: speed > 0.001 ? 'drag-release-handoff' : 'release-rest',
    };
};
