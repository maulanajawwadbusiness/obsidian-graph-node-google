import React from 'react';
import { AppScreen } from './screenTypes';

type UseWelcome1FontGateArgs = {
    screen: AppScreen;
    timeoutMs: number;
    isDev: boolean;
};

export function useWelcome1FontGate(args: UseWelcome1FontGateArgs): boolean {
    const { screen, timeoutMs, isDev } = args;
    const [gateDone, setGateDone] = React.useState(false);

    React.useEffect(() => {
        if (screen !== 'welcome1') return;
        if (gateDone) return;
        const startMs = performance.now();
        if (isDev) {
            console.log('[OnboardingFont] font_check_start');
        }

        let settled = false;
        let disposed = false;
        let timeoutId: number | null = null;

        const settle = (timedOut: boolean) => {
            if (settled || disposed) return;
            settled = true;
            if (timeoutId !== null) {
                window.clearTimeout(timeoutId);
            }

            if (isDev) {
                const elapsedMs = Math.round(performance.now() - startMs);
                if (timedOut) {
                    console.log('[OnboardingFont] font_timeout_ms=%d proceed', timeoutMs);
                } else {
                    console.log('[OnboardingFont] font_ready_ms=%d', elapsedMs);
                }
            }
            setGateDone(true);
        };

        if (typeof document === 'undefined' || !document.fonts || typeof document.fonts.load !== 'function') {
            settle(false);
            return () => {
                disposed = true;
            };
        }

        timeoutId = window.setTimeout(() => {
            settle(true);
        }, timeoutMs);

        void document.fonts
            .load('16px "Quicksand"')
            .then(() => {
                settle(false);
            })
            .catch(() => {
                settle(true);
            });

        return () => {
            disposed = true;
            if (timeoutId !== null) {
                window.clearTimeout(timeoutId);
            }
        };
    }, [gateDone, isDev, screen, timeoutMs]);

    return gateDone;
}
