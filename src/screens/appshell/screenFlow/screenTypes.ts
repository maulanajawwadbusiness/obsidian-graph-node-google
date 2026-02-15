export const APP_SCREENS = ['welcome1', 'welcome2', 'prompt', 'graph_loading', 'graph'] as const;

export type AppScreen = (typeof APP_SCREENS)[number];

export const SCREEN_CLASS_BY_ID: Record<AppScreen, 'onboarding' | 'graph'> = {
    welcome1: 'onboarding',
    welcome2: 'onboarding',
    prompt: 'onboarding',
    graph_loading: 'graph',
    graph: 'graph',
};

export function isOnboardingScreen(screen: AppScreen): boolean {
    return SCREEN_CLASS_BY_ID[screen] === 'onboarding';
}

export function isGraphClassScreen(screen: AppScreen): boolean {
    return SCREEN_CLASS_BY_ID[screen] === 'graph';
}

export function isAppScreen(value: unknown): value is AppScreen {
    if (typeof value !== 'string') return false;
    return APP_SCREENS.includes(value as AppScreen);
}
