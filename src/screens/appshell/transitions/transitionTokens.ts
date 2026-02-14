export const ONBOARDING_SCREEN_FADE_MS = 200;
export const ONBOARDING_SCREEN_FADE_EASING = 'cubic-bezier(0.22, 1, 0.36, 1)';

export type TransitionScreen = 'welcome1' | 'welcome2' | 'prompt' | 'graph';

export function isOnboardingScreen(screen: TransitionScreen): boolean {
    return screen === 'welcome1' || screen === 'welcome2' || screen === 'prompt';
}
