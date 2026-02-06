import React, { Suspense } from 'react';
import { ONBOARDING_ENABLED } from '../config/env';
import { Welcome1 } from './Welcome1';
import { Welcome2 } from './Welcome2';
import { EnterPrompt } from './EnterPrompt';

const Graph = React.lazy(() => import('../playground/GraphPhysicsPlayground'));

type Screen = 'welcome1' | 'welcome2' | 'prompt' | 'graph';

const STORAGE_KEY = 'arnvoid_screen';

function getInitialScreen(): Screen {
    if (!ONBOARDING_ENABLED) return 'graph';
    if (typeof window === 'undefined') return 'welcome1';
    const stored = sessionStorage.getItem(STORAGE_KEY) as Screen | null;
    if (stored === 'welcome1' || stored === 'welcome2' || stored === 'prompt' || stored === 'graph') {
        return stored;
    }
    return 'welcome1';
}

export const AppShell: React.FC = () => {
    const [screen, setScreen] = React.useState<Screen>(() => getInitialScreen());

    React.useEffect(() => {
        if (!ONBOARDING_ENABLED) return;
        if (typeof window === 'undefined') return;
        sessionStorage.setItem(STORAGE_KEY, screen);
    }, [screen]);

    if (screen === 'graph') {
        return (
            <Suspense fallback={<div style={FALLBACK_STYLE}>Loading graph...</div>}>
                <Graph />
            </Suspense>
        );
    }

    if (screen === 'welcome1') {
        return (
            <Welcome1
                onNext={() => setScreen('welcome2')}
                onSkip={() => setScreen('graph')}
            />
        );
    }

    if (screen === 'welcome2') {
        return (
            <Welcome2
                onBack={() => setScreen('welcome1')}
                onNext={() => setScreen('prompt')}
                onSkip={() => setScreen('graph')}
            />
        );
    }

    return (
        <EnterPrompt
            onBack={() => setScreen('welcome2')}
            onEnter={() => setScreen('graph')}
            onSkip={() => setScreen('graph')}
        />
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
