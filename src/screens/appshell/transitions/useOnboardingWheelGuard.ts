import React from 'react';

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

        const onWheel = (event: WheelEvent) => {
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
