import React from 'react';
import { isInsideSampleGraphPreviewRoot } from '../../../components/sampleGraphPreviewSeams';

type UseOnboardingWheelGuardArgs = {
    enabled: boolean;
    active: boolean;
    debug: boolean;
};

export function useOnboardingWheelGuard(args: UseOnboardingWheelGuardArgs): void {
    const { enabled, active, debug } = args;

    React.useEffect(() => {
        if (!enabled || !active) return;
        if (typeof window === 'undefined') return;

        const isInsidePreviewPortalRoot = (target: EventTarget | null): boolean => {
            if (!target || !(target instanceof Element)) return false;
            return target.closest('[data-arnvoid-preview-portal-root="1"]') !== null;
        };

        const onWheel = (event: WheelEvent) => {
            if (
                isInsideSampleGraphPreviewRoot(event.target) ||
                isInsidePreviewPortalRoot(event.target)
            ) {
                if (debug) {
                    console.log('[OnboardingGesture] wheel allowed for preview');
                }
                return;
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
