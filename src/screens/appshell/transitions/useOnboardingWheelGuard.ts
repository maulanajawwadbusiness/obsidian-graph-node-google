import React from 'react';
import {
    isInsideSampleGraphPreviewPortalRoot,
    isInsideSampleGraphPreviewRoot,
    SAMPLE_GRAPH_PREVIEW_PORTAL_ROOT_SELECTOR,
    SAMPLE_GRAPH_PREVIEW_ROOT_SELECTOR,
} from '../../../components/sampleGraphPreviewSeams';

type UseOnboardingWheelGuardArgs = {
    enabled: boolean;
    active: boolean;
    debug: boolean;
};

export function useOnboardingWheelGuard(args: UseOnboardingWheelGuardArgs): void {
    const { enabled, active, debug } = args;
    const debugCountersRef = React.useRef({ allowedPreviewWheelCount: 0, blockedWheelCount: 0 });
    const warnedPreviewBlockedRef = React.useRef(false);

    React.useEffect(() => {
        if (!enabled || !active) return;
        if (typeof window === 'undefined') return;

        const onWheel = (event: WheelEvent) => {
            if (
                isInsideSampleGraphPreviewRoot(event.target) ||
                isInsideSampleGraphPreviewPortalRoot(event.target)
            ) {
                if (import.meta.env.DEV) {
                    debugCountersRef.current.allowedPreviewWheelCount += 1;
                    const total =
                        debugCountersRef.current.allowedPreviewWheelCount + debugCountersRef.current.blockedWheelCount;
                    if (debug && total % 50 === 0) {
                        console.log(
                            '[OnboardingGesture] wheel counters allowed=%d blocked=%d',
                            debugCountersRef.current.allowedPreviewWheelCount,
                            debugCountersRef.current.blockedWheelCount
                        );
                    }
                }
                if (debug) {
                    console.log('[OnboardingGesture] wheel allowed for preview');
                }
                return;
            }
            if (import.meta.env.DEV) {
                if (!warnedPreviewBlockedRef.current) {
                    const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
                    const insidePreviewByPath = path.some((item) => {
                        if (!(item instanceof Element)) return false;
                        return (
                            item.matches?.(SAMPLE_GRAPH_PREVIEW_ROOT_SELECTOR) ||
                            item.matches?.(SAMPLE_GRAPH_PREVIEW_PORTAL_ROOT_SELECTOR)
                        );
                    });
                    if (insidePreviewByPath) {
                        warnedPreviewBlockedRef.current = true;
                        console.warn('[OnboardingGesture] preview wheel reached blocked guard path');
                    }
                }
                debugCountersRef.current.blockedWheelCount += 1;
                const total =
                    debugCountersRef.current.allowedPreviewWheelCount + debugCountersRef.current.blockedWheelCount;
                if (debug && total % 50 === 0) {
                    console.log(
                        '[OnboardingGesture] wheel counters allowed=%d blocked=%d',
                        debugCountersRef.current.allowedPreviewWheelCount,
                        debugCountersRef.current.blockedWheelCount
                    );
                }
            }
            event.preventDefault();
            if (debug) {
                console.log('[OnboardingGesture] wheel prevented');
            }
        };

        window.addEventListener('wheel', onWheel, { passive: false, capture: true });
        return () => {
            window.removeEventListener('wheel', onWheel, true);
        };
    }, [active, debug, enabled]);
}
