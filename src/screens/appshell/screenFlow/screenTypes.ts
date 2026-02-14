export const APP_SCREENS = ['welcome1', 'welcome2', 'prompt', 'graph'] as const;

export type AppScreen = (typeof APP_SCREENS)[number];

export function isOnboardingScreen(screen: AppScreen): boolean {
    return screen === 'welcome1' || screen === 'welcome2' || screen === 'prompt';
}

export function isAppScreen(value: unknown): value is AppScreen {
    if (typeof value !== 'string') return false;
    return APP_SCREENS.includes(value as AppScreen);
}
