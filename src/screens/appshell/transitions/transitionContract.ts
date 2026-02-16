import { AppScreen } from '../screenFlow/screenTypes';

export const ONBOARDING_FADE_MS = 200;
export const ONBOARDING_FADE_EASING = 'cubic-bezier(0.22, 1, 0.36, 1)';

export type TransitionPhase = 'idle' | 'arming' | 'fading';

export type TransitionPolicy = {
    animate: boolean;
    blockInput: boolean;
    reason: string;
};

export type TransitionClass = 'onboarding' | 'graph';

const TRANSITION_CLASS_BY_SCREEN: Record<AppScreen, TransitionClass> = {
    welcome1: 'onboarding',
    welcome2: 'onboarding',
    prompt: 'onboarding',
    graph_loading: 'graph',
    graph: 'graph',
};

const TRANSITION_POLICY_BY_CLASS: Record<TransitionClass, Record<TransitionClass, TransitionPolicy>> = {
    onboarding: {
        onboarding: { animate: false, blockInput: false, reason: 'non_animated_pair' },
        graph: { animate: false, blockInput: false, reason: 'graph_boundary' },
    },
    graph: {
        onboarding: { animate: false, blockInput: false, reason: 'graph_boundary' },
        graph: { animate: false, blockInput: false, reason: 'graph_boundary' },
    },
};

function isAnimatedOnboardingPair(from: AppScreen, to: AppScreen): boolean {
    if (from === 'welcome1' && to === 'welcome2') return true;
    if (from === 'welcome2' && to === 'welcome1') return true;
    if (from === 'welcome2' && to === 'prompt') return true;
    if (from === 'prompt' && to === 'welcome2') return true;
    return false;
}

function isGraphBoundary(from: AppScreen, to: AppScreen): boolean {
    return TRANSITION_CLASS_BY_SCREEN[from] === 'graph' || TRANSITION_CLASS_BY_SCREEN[to] === 'graph';
}

export function getTransitionPolicy(from: AppScreen, to: AppScreen): TransitionPolicy {
    if (from === to) {
        return { animate: false, blockInput: false, reason: 'same_screen' };
    }
    if (isAnimatedOnboardingPair(from, to)) {
        return { animate: true, blockInput: true, reason: 'onboarding_pair' };
    }
    if (isGraphBoundary(from, to)) {
        return TRANSITION_POLICY_BY_CLASS.graph[TRANSITION_CLASS_BY_SCREEN[to]];
    }
    return TRANSITION_POLICY_BY_CLASS[TRANSITION_CLASS_BY_SCREEN[from]][TRANSITION_CLASS_BY_SCREEN[to]];
}

export function isOverlayFadeEnabledForScreen(screen: AppScreen): boolean {
    return screen === 'prompt';
}
