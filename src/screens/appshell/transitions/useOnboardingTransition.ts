import React from 'react';
import {
    ONBOARDING_SCREEN_FADE_MS,
    TransitionScreen,
    isOnboardingScreen,
} from './transitionTokens';

type UseOnboardingTransitionArgs<Screen extends TransitionScreen> = {
    screen: Screen;
    setScreen: (next: Screen) => void;
};

type UseOnboardingTransitionResult<Screen extends TransitionScreen> = {
    transitionToScreen: (next: Screen) => void;
    screenTransitionFrom: Screen | null;
    screenTransitionReady: boolean;
    effectiveScreenFadeMs: number;
    isScreenTransitioning: boolean;
    shouldBlockOnboardingInput: boolean;
};

export function useOnboardingTransition<Screen extends TransitionScreen>(
    args: UseOnboardingTransitionArgs<Screen>
): UseOnboardingTransitionResult<Screen> {
    const { screen, setScreen } = args;
    const [screenTransitionFrom, setScreenTransitionFrom] = React.useState<Screen | null>(null);
    const [screenTransitionReady, setScreenTransitionReady] = React.useState(false);
    const [prefersReducedMotion, setPrefersReducedMotion] = React.useState(false);
    const screenTransitionTimerRef = React.useRef<number | null>(null);
    const screenTransitionRafRef = React.useRef<number | null>(null);
    const screenTransitionEpochRef = React.useRef(0);

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

    const effectiveScreenFadeMs = prefersReducedMotion ? 0 : ONBOARDING_SCREEN_FADE_MS;

    const clearScreenTransition = React.useCallback(() => {
        if (screenTransitionTimerRef.current !== null) {
            window.clearTimeout(screenTransitionTimerRef.current);
            screenTransitionTimerRef.current = null;
        }
        if (screenTransitionRafRef.current !== null) {
            window.cancelAnimationFrame(screenTransitionRafRef.current);
            screenTransitionRafRef.current = null;
        }
        setScreenTransitionReady(false);
        setScreenTransitionFrom(null);
    }, []);

    const transitionToScreen = React.useCallback((next: Screen) => {
        if (next === screen) return;
        const current = screen;
        const shouldAnimate = isOnboardingScreen(current) && isOnboardingScreen(next);
        if (!shouldAnimate) {
            clearScreenTransition();
            setScreen(next);
            return;
        }

        screenTransitionEpochRef.current += 1;
        const epoch = screenTransitionEpochRef.current;
        setScreenTransitionFrom(current);
        setScreenTransitionReady(false);
        setScreen(next);

        if (effectiveScreenFadeMs <= 0) {
            clearScreenTransition();
            return;
        }

        if (screenTransitionRafRef.current !== null) {
            window.cancelAnimationFrame(screenTransitionRafRef.current);
            screenTransitionRafRef.current = null;
        }
        if (screenTransitionTimerRef.current !== null) {
            window.clearTimeout(screenTransitionTimerRef.current);
            screenTransitionTimerRef.current = null;
        }

        screenTransitionRafRef.current = window.requestAnimationFrame(() => {
            if (screenTransitionEpochRef.current !== epoch) return;
            screenTransitionRafRef.current = null;
            setScreenTransitionReady(true);
            screenTransitionTimerRef.current = window.setTimeout(() => {
                if (screenTransitionEpochRef.current !== epoch) return;
                screenTransitionTimerRef.current = null;
                setScreenTransitionReady(false);
                setScreenTransitionFrom(null);
            }, effectiveScreenFadeMs);
        });
    }, [clearScreenTransition, effectiveScreenFadeMs, screen, setScreen]);

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

    const isScreenTransitioning = screenTransitionFrom !== null;
    const shouldBlockOnboardingInput = isScreenTransitioning && isOnboardingScreen(screen);

    return {
        transitionToScreen,
        screenTransitionFrom,
        screenTransitionReady,
        effectiveScreenFadeMs,
        isScreenTransitioning,
        shouldBlockOnboardingInput,
    };
}
