import React from 'react';
import {
    isInsideSampleGraphPreviewPortalRoot,
    isInsideSampleGraphPreviewRoot,
} from '../../../components/sampleGraphPreviewSeams';

type UseOnboardingWheelGuardArgs = {
    enabled: boolean;
    active: boolean;
    debug: boolean;
};

export function useOnboardingWheelGuard(args: UseOnboardingWheelGuardArgs): void {
    const { enabled, active, debug } = args;
    const debugCountersRef = React.useRef({ allowedPreviewWheelCount: 0, blockedWheelCount: 0 });

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
