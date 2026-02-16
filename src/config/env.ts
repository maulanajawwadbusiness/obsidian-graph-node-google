const rawOnboarding = import.meta.env.VITE_ONBOARDING_ENABLED;
const rawOnboardingStartScreen = import.meta.env.VITE_ONBOARDING_START_SCREEN;

export const ONBOARDING_ENABLED = rawOnboarding === 'true' || rawOnboarding === '1';
export type OnboardingScreen = 'welcome1' | 'welcome2' | 'prompt' | 'graph_loading' | 'graph';

export const ONBOARDING_START_SCREEN_RAW = typeof rawOnboardingStartScreen === 'string'
    ? rawOnboardingStartScreen
    : '';

function parseOnboardingStartScreen(rawValue: string): OnboardingScreen | null {
    const normalized = rawValue.trim().toLowerCase();
    if (normalized === '') return null;
    if (normalized === 'screen1' || normalized === 'welcome1') return 'welcome1';
    if (normalized === 'screen2' || normalized === 'welcome2') return 'welcome2';
    if (normalized === 'screen3' || normalized === 'prompt') return 'prompt';
    if (normalized === 'graph_loading') return 'graph_loading';
    if (normalized === 'screen4' || normalized === 'graph') return 'graph';
    return null;
}

export const ONBOARDING_START_SCREEN = parseOnboardingStartScreen(ONBOARDING_START_SCREEN_RAW);

const rawSplashMs = import.meta.env.VITE_ONBOARDING_SPLASH_MS;
const rawManifestoMs = import.meta.env.VITE_ONBOARDING_MANIFESTO_MS;

export const ONBOARDING_SPLASH_MS = Math.max(500, Number(rawSplashMs || 4500));
export const ONBOARDING_MANIFESTO_MS = Math.max(500, Number(rawManifestoMs || 6000));
