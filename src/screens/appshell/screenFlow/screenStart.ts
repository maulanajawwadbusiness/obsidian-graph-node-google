import { AppScreen, isAppScreen } from './screenTypes';

type GetInitialScreenArgs = {
    onboardingEnabled: boolean;
    onboardingStartScreen: AppScreen | null;
    onboardingStartScreenRaw: string;
    isDev: boolean;
    persistScreen: boolean;
    storageKey: string;
};

let hasWarnedInvalidStartScreen = false;

function warnInvalidOnboardingStartScreenOnce(args: GetInitialScreenArgs): void {
    if (!args.isDev) return;
    if (hasWarnedInvalidStartScreen) return;
    if (args.onboardingStartScreenRaw.trim() === '') return;
    if (args.onboardingStartScreen !== null) return;
    hasWarnedInvalidStartScreen = true;
    console.warn(
        '[OnboardingStart] invalid VITE_ONBOARDING_START_SCREEN="%s". Allowed: screen1|screen2|screen3|screen4|welcome1|welcome2|prompt|graph',
        args.onboardingStartScreenRaw
    );
}

export function getInitialScreen(args: GetInitialScreenArgs): AppScreen {
    if (!args.onboardingEnabled) return 'graph';
    if (args.isDev && args.onboardingStartScreen !== null) return args.onboardingStartScreen;
    warnInvalidOnboardingStartScreenOnce(args);
    if (args.persistScreen && typeof window !== 'undefined') {
        const stored = sessionStorage.getItem(args.storageKey);
        if (isAppScreen(stored)) return stored;
    }
    return 'welcome1';
}
