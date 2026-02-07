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
    const showMoneyUi = screen === 'prompt' || screen === 'graph';
    const showOnboardingFullscreenButton = screen === 'welcome1' || screen === 'welcome2' || screen === 'prompt';

    const moneyUi = showMoneyUi ? (
        <>
            <BalanceBadge />
            <ShortageWarning />
            <MoneyNoticeStack />
        </>
    ) : null;

    const onboardingFullscreenButton = showOnboardingFullscreenButton ? (
        <FullscreenButton style={ONBOARDING_FULLSCREEN_BUTTON_STYLE} />
    ) : null;

    React.useEffect(() => {
        if (!ONBOARDING_ENABLED || !PERSIST_SCREEN) return;
        if (typeof window === 'undefined') return;
        sessionStorage.setItem(STORAGE_KEY, screen);
    }, [screen]);

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
        return (
            <div style={SHELL_STYLE}>
                <Welcome1
                    onNext={() => setScreen('welcome2')}
                    onSkip={() => setScreen('graph')}
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
    zIndex: 2100
};
