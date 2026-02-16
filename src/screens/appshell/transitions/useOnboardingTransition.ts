import React from 'react';
import {
    getTransitionPolicy,
    ONBOARDING_FADE_MS,
    type TransitionPhase,
} from './transitionContract';
import { AppScreen, isOnboardingScreen } from '../screenFlow/screenTypes';

type UseOnboardingTransitionArgs<Screen extends AppScreen> = {
    screen: Screen;
    setScreen: (next: Screen) => void;
};

type UseOnboardingTransitionResult<Screen extends AppScreen> = {
    transitionToScreen: (next: Screen) => void;
    phase: TransitionPhase;
    fromScreen: Screen | null;
    toScreen: Screen;
    isFadeArmed: boolean;
    isCrossfading: boolean;
    effectiveFadeMs: number;
    isBlockingInput: boolean;
};

export function useOnboardingTransition<Screen extends AppScreen>(
    args: UseOnboardingTransitionArgs<Screen>
): UseOnboardingTransitionResult<Screen> {
    const debug = import.meta.env.DEV;
    const { screen, setScreen } = args;
    const [phase, setPhase] = React.useState<TransitionPhase>('idle');
    const [fromScreen, setFromScreen] = React.useState<Screen | null>(null);
    const [toScreen, setToScreen] = React.useState<Screen>(screen);
    const [prefersReducedMotion, setPrefersReducedMotion] = React.useState(false);
    const screenTransitionTimerRef = React.useRef<number | null>(null);
    const screenTransitionRafRef = React.useRef<number | null>(null);
    const screenTransitionEpochRef = React.useRef(0);
    const policyBlockInputRef = React.useRef(false);
    const lastLoggedPhaseRef = React.useRef<TransitionPhase>('idle');

    React.useEffect(() => {
        if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
        const media = window.matchMedia('(prefers-reduced-motion: reduce)');
        const applyMatch = () => setPrefersReducedMotion(media.matches);
        applyMatch();
        const listener = () => applyMatch();
        if (typeof media.addEventListener === 'function') {
            media.addEventListener('change', listener);
            return () => media.removeEventListener('change', listener);
        }
        media.addListener(listener);
        return () => media.removeListener(listener);
    }, []);

    const effectiveFadeMs = prefersReducedMotion ? 0 : ONBOARDING_FADE_MS;

    const clearScreenTransition = React.useCallback(() => {
        if (screenTransitionTimerRef.current !== null) {
            window.clearTimeout(screenTransitionTimerRef.current);
            screenTransitionTimerRef.current = null;
        }
        if (screenTransitionRafRef.current !== null) {
            window.cancelAnimationFrame(screenTransitionRafRef.current);
            screenTransitionRafRef.current = null;
        }
        setPhase('idle');
        setFromScreen(null);
        policyBlockInputRef.current = false;
    }, []);

    const transitionToScreen = React.useCallback((next: Screen) => {
        if (next === screen) return;
        const current = screen;
        const policy = getTransitionPolicy(current, next);
        policyBlockInputRef.current = policy.blockInput;
        if (debug) {
            console.log(
                '[OnboardingTransition] from=%s to=%s animate=%s blockInput=%s reason=%s',
                current,
                next,
                policy.animate ? '1' : '0',
                policy.blockInput ? '1' : '0',
                policy.reason
            );
        }
        if (!policy.animate) {
            clearScreenTransition();
            setScreen(next);
            setToScreen(next);
            return;
        }

        screenTransitionEpochRef.current += 1;
        const epoch = screenTransitionEpochRef.current;

        if (screenTransitionRafRef.current !== null) {
            window.cancelAnimationFrame(screenTransitionRafRef.current);
            screenTransitionRafRef.current = null;
        }
        if (screenTransitionTimerRef.current !== null) {
            window.clearTimeout(screenTransitionTimerRef.current);
            screenTransitionTimerRef.current = null;
        }

        setFromScreen(current);
        setToScreen(next);
        setPhase('arming');
        setScreen(next);

        if (effectiveFadeMs <= 0) {
            clearScreenTransition();
            return;
        }

        screenTransitionRafRef.current = window.requestAnimationFrame(() => {
            if (screenTransitionEpochRef.current !== epoch) return;
            screenTransitionRafRef.current = null;
            setPhase('fading');
            screenTransitionTimerRef.current = window.setTimeout(() => {
                if (screenTransitionEpochRef.current !== epoch) return;
                screenTransitionTimerRef.current = null;
                clearScreenTransition();
            }, effectiveFadeMs);
        });
    }, [clearScreenTransition, debug, effectiveFadeMs, screen, setScreen]);

    React.useEffect(() => {
        return () => {
            if (screenTransitionTimerRef.current !== null) {
                window.clearTimeout(screenTransitionTimerRef.current);
            }
            if (screenTransitionRafRef.current !== null) {
                window.cancelAnimationFrame(screenTransitionRafRef.current);
            }
        };
    }, []);

    React.useEffect(() => {
        if (!debug) return;
        if (lastLoggedPhaseRef.current === phase) return;
        lastLoggedPhaseRef.current = phase;
        console.log(
            '[OnboardingTransition] phase=%s from=%s to=%s fadeMs=%d reduced=%s',
            phase,
            fromScreen ?? 'none',
            toScreen,
            effectiveFadeMs,
            prefersReducedMotion ? '1' : '0'
        );
    }, [debug, effectiveFadeMs, fromScreen, phase, prefersReducedMotion, toScreen]);

    const isCrossfading = phase !== 'idle';
    const isFadeArmed = phase === 'fading';
    const isBlockingInput = isCrossfading && policyBlockInputRef.current && isOnboardingScreen(screen);

    return {
        transitionToScreen,
        phase,
        fromScreen,
        toScreen,
        isFadeArmed,
        isCrossfading,
        effectiveFadeMs,
        isBlockingInput,
    };
}
