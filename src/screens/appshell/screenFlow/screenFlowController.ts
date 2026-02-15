import { AppScreen } from './screenTypes';

export function getNextScreen(current: AppScreen): AppScreen | null {
    if (current === 'welcome1') return 'welcome2';
    if (current === 'welcome2') return 'prompt';
    if (current === 'prompt') return 'graph_loading';
    if (current === 'graph_loading') return 'graph';
    if (current === 'graph') return null;
    return null;
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
