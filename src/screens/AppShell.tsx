import React, { Suspense } from 'react';
import { ONBOARDING_ENABLED } from '../config/env';
import { Welcome1 } from './Welcome1';
import { Welcome2 } from './Welcome2';
import { EnterPrompt } from './EnterPrompt';
import { BalanceBadge } from '../components/BalanceBadge';
import { ShortageWarning } from '../components/ShortageWarning';
import { MoneyNoticeStack } from '../components/MoneyNoticeStack';
import { FullscreenButton } from '../components/FullscreenButton';

const Graph = React.lazy(() =>
    import('../playground/GraphPhysicsPlayground').then((mod) => ({
        default: mod.GraphPhysicsPlayground,
    }))
);

type Screen = 'welcome1' | 'welcome2' | 'prompt' | 'graph';
const STORAGE_KEY = 'arnvoid_screen';
const PERSIST_SCREEN = false;
const DEBUG_ONBOARDING_SCROLL_GUARD = false;
const WELCOME1_FONT_TIMEOUT_MS = 1500;

function getInitialScreen(): Screen {
    if (!ONBOARDING_ENABLED) return 'graph';
    if (PERSIST_SCREEN && typeof window !== 'undefined') {
        const stored = sessionStorage.getItem(STORAGE_KEY) as Screen | null;
        if (stored === 'welcome1' || stored === 'welcome2' || stored === 'prompt' || stored === 'graph') {
            return stored;
        }
    }
    return 'welcome1';
}

export const AppShell: React.FC = () => {
    const [screen, setScreen] = React.useState<Screen>(() => getInitialScreen());
    const [welcome1OverlayOpen, setWelcome1OverlayOpen] = React.useState(false);
    const [enterPromptOverlayOpen, setEnterPromptOverlayOpen] = React.useState(false);
    const [welcome1FontGateDone, setWelcome1FontGateDone] = React.useState(false);
    const showMoneyUi = screen === 'prompt' || screen === 'graph';
    const showOnboardingFullscreenButton = screen === 'welcome1' || screen === 'welcome2' || screen === 'prompt';
    const onboardingActive = screen === 'welcome1' || screen === 'welcome2' || screen === 'prompt';
    const isOnboardingOverlayOpen = welcome1OverlayOpen || enterPromptOverlayOpen;

    const moneyUi = showMoneyUi ? (
        <>
            <BalanceBadge />
            <ShortageWarning />
            <MoneyNoticeStack />
        </>
    ) : null;

    const onboardingFullscreenButton = showOnboardingFullscreenButton ? (
        <FullscreenButton
            style={ONBOARDING_FULLSCREEN_BUTTON_STYLE}
            blocked={isOnboardingOverlayOpen}
        />
    ) : null;

    React.useEffect(() => {
        if (!ONBOARDING_ENABLED || !PERSIST_SCREEN) return;
        if (typeof window === 'undefined') return;
        sessionStorage.setItem(STORAGE_KEY, screen);
    }, [screen]);

    React.useEffect(() => {
        if (!ONBOARDING_ENABLED || !onboardingActive) return;
        if (typeof window === 'undefined') return;

        const onWheel = (event: WheelEvent) => {
            event.preventDefault();
            if (DEBUG_ONBOARDING_SCROLL_GUARD) {
                console.log('[OnboardingGesture] wheel prevented');
            }
        };

        window.addEventListener('wheel', onWheel, { passive: false, capture: true });
        return () => {
            window.removeEventListener('wheel', onWheel, true);
        };
    }, [onboardingActive]);

    React.useEffect(() => {
        if (screen !== 'welcome1') return;
        if (welcome1FontGateDone) return;
        const startMs = performance.now();
        const shouldLog = import.meta.env.DEV;
        if (shouldLog) {
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

            if (shouldLog) {
                const elapsedMs = Math.round(performance.now() - startMs);
                if (timedOut) {
                    console.log('[OnboardingFont] font_timeout_ms=1500 proceed');
                } else {
                    console.log('[OnboardingFont] font_ready_ms=%d', elapsedMs);
                }
            }
            setWelcome1FontGateDone(true);
        };

        if (typeof document === 'undefined' || !document.fonts || typeof document.fonts.load !== 'function') {
            settle(false);
            return () => {
                disposed = true;
            };
        }

        timeoutId = window.setTimeout(() => {
            settle(true);
        }, WELCOME1_FONT_TIMEOUT_MS);

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
    }, [screen, welcome1FontGateDone]);

    if (screen === 'graph') {
        return (
            <div style={SHELL_STYLE}>
                <Suspense fallback={<div style={FALLBACK_STYLE}>Loading graph...</div>}>
                    <Graph />
                </Suspense>
                {moneyUi}
            </div>
        );
    }

    if (screen === 'welcome1') {
        if (!welcome1FontGateDone) {
            return <div style={WELCOME1_FONT_GATE_BLANK_STYLE} />;
        }
        return (
            <div style={SHELL_STYLE}>
                <Welcome1
                    onNext={() => setScreen('welcome2')}
                    onSkip={() => setScreen('graph')}
                    onOverlayOpenChange={setWelcome1OverlayOpen}
                />
                {onboardingFullscreenButton}
                {moneyUi}
            </div>
        );
    }

    if (screen === 'welcome2') {
        return (
            <div style={SHELL_STYLE}>
                <Welcome2
                    onBack={() => setScreen('welcome1')}
                    onNext={() => setScreen('prompt')}
                    onSkip={() => setScreen('graph')}
                />
                {onboardingFullscreenButton}
                {moneyUi}
            </div>
        );
    }

    return (
        <div style={SHELL_STYLE}>
            <EnterPrompt
                onBack={() => setScreen('welcome2')}
                onEnter={() => setScreen('graph')}
                onSkip={() => setScreen('graph')}
                onOverlayOpenChange={setEnterPromptOverlayOpen}
            />
            {onboardingFullscreenButton}
            {moneyUi}
        </div>
    );
};

const FALLBACK_STYLE: React.CSSProperties = {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#0f1115',
    color: '#e7e7e7',
    fontSize: '14px',
};

const SHELL_STYLE: React.CSSProperties = {
    position: 'relative',
    width: '100%',
    minHeight: '100vh',
};

const ONBOARDING_FULLSCREEN_BUTTON_STYLE: React.CSSProperties = {
    position: 'fixed',
    top: '24px',
    right: '24px',
    zIndex: 1200
};

const WELCOME1_FONT_GATE_BLANK_STYLE: React.CSSProperties = {
    minHeight: '100vh',
    width: '100%',
    background: '#06060A',
};
