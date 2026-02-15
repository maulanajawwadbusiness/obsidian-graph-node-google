import { AppScreen } from './screenTypes';

const NEXT_SCREEN_BY_ID: Record<AppScreen, AppScreen | null> = {
    welcome1: 'welcome2',
    welcome2: 'prompt',
    prompt: 'graph_loading',
    graph_loading: 'graph',
    graph: null,
};

export function getNextScreen(current: AppScreen): AppScreen | null {
    return NEXT_SCREEN_BY_ID[current];
}

export function getBackScreen(current: AppScreen): AppScreen | null {
    if (current === 'welcome2') return 'welcome1';
    if (current === 'prompt') return 'welcome2';
    if (current === 'graph_loading') return 'prompt';
    if (current === 'graph') return null;
    return null;
}

export function getSkipTarget(): AppScreen {
    return 'graph';
}

export function getCreateNewTarget(): AppScreen {
    return 'prompt';
}
