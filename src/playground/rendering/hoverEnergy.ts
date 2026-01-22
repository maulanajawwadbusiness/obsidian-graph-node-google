import type { MutableRefObject } from 'react';
import type { ThemeConfig } from '../../visual/theme';
import { clamp } from './renderingMath';
import type { HoverState } from './renderingTypes';

const MAX_HOVER_DT_MS = 40;
const HOVER_DECAY_EPSILON = 0.01;

export const updateHoverEnergy = (
    hoverStateRef: MutableRefObject<HoverState>,
    theme: ThemeConfig,
    dtMs: number
) => {
    const rawDtMs = Math.max(0, dtMs);
    const clampedDtMs = Math.min(rawDtMs, MAX_HOVER_DT_MS);
    const tauMs = Math.max(theme.hoverEnergyTauMs, 1);
    const alpha = 1 - Math.exp(-clampedDtMs / tauMs);

    hoverStateRef.current.lastDtMs = rawDtMs;
    hoverStateRef.current.lastDtClampedMs = clampedDtMs;
    hoverStateRef.current.lastAlpha = alpha;

    if (theme.hoverDebugEnabled) {
        const isClamped = rawDtMs > MAX_HOVER_DT_MS;
        if (isClamped && !hoverStateRef.current.wasDtClamped) {
            console.log(`hover dt clamped: raw=${rawDtMs.toFixed(1)}ms -> used=${clampedDtMs.toFixed(1)}ms`);
        }
        hoverStateRef.current.wasDtClamped = isClamped;
    } else {
        hoverStateRef.current.wasDtClamped = false;
    }

    hoverStateRef.current.energy = hoverStateRef.current.energy +
        (hoverStateRef.current.targetEnergy - hoverStateRef.current.energy) * alpha;

    if (!Number.isFinite(hoverStateRef.current.energy)) {
        hoverStateRef.current.energy = hoverStateRef.current.targetEnergy;
    }
    hoverStateRef.current.energy = clamp(hoverStateRef.current.energy, 0, 1);
    if (
        hoverStateRef.current.hoveredNodeId === null &&
        hoverStateRef.current.targetEnergy === 0 &&
        hoverStateRef.current.energy <= HOVER_DECAY_EPSILON
    ) {
        hoverStateRef.current.hoverDisplayNodeId = null;
    }
    hoverStateRef.current.energyUpdateCount += 1;
};
