import type { AppScreen } from '../screenFlow/screenTypes';

export const ONBOARDING_FADE_MS = 200;
export const ONBOARDING_FADE_EASING = 'cubic-bezier(0.22, 1, 0.36, 1)';

export type TransitionPhase = 'idle' | 'arming' | 'fading';

export type TransitionPolicy = {
    animate: boolean;
    blockInput: boolean;
    reason: string;
};

function isAnimatedOnboardingPair(from: AppScreen, to: AppScreen): boolean {
    if (from === 'welcome1' && to === 'welcome2') return true;
    if (from === 'welcome2' && to === 'welcome1') return true;
    if (from === 'welcome2' && to === 'prompt') return true;
    if (from === 'prompt' && to === 'welcome2') return true;
    return false;
}

function isGraphClassScreen(screen: AppScreen): boolean {
    return screen === 'graph_loading' || screen === 'graph';
}

export function getTransitionPolicy(from: AppScreen, to: AppScreen): TransitionPolicy {
    if (from === to) {
        return { animate: false, blockInput: false, reason: 'same_screen' };
    }
    if (isAnimatedOnboardingPair(from, to)) {
        return { animate: true, blockInput: true, reason: 'onboarding_pair' };
    }
    if (isGraphClassScreen(from) || isGraphClassScreen(to)) {
        return { animate: false, blockInput: false, reason: 'graph_boundary' };
    }
    return { animate: false, blockInput: false, reason: 'non_animated_pair' };
}

export function isOverlayFadeEnabledForScreen(screen: AppScreen): boolean {
    return screen === 'prompt';
}
