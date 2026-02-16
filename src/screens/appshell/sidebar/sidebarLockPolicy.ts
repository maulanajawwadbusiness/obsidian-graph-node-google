import { AppScreen, isGraphClassScreen } from '../screenFlow/screenTypes';

export type SidebarLockReason =
    | 'none'
    | 'screen_frozen'
    | 'graph_loading_activity'
    | 'login_overlay_block';

export type SidebarLockState = {
    frozen: boolean;
    disabled: boolean;
    reason: SidebarLockReason;
};

type SidebarLockInput = {
    screen: AppScreen;
    graphIsLoading: boolean;
    loginBlockingActive: boolean;
    isFrozenByScreen: boolean;
};

/**
 * Sidebar lock policy contract.
 * Precedence order is intentional and must remain stable:
 * 1) screen-level frozen lock
 * 2) graph-class runtime loading activity lock
 * 3) prompt login overlay lock
 * 4) unlocked
 */
export function computeSidebarLockState(input: SidebarLockInput): SidebarLockState {
    const { screen, graphIsLoading, loginBlockingActive, isFrozenByScreen } = input;
    if (isFrozenByScreen) {
        return { frozen: true, disabled: true, reason: 'screen_frozen' };
    }
    if (isGraphClassScreen(screen) && graphIsLoading) {
        return { frozen: false, disabled: true, reason: 'graph_loading_activity' };
    }
    if (loginBlockingActive) {
        return { frozen: false, disabled: true, reason: 'login_overlay_block' };
    }
    return { frozen: false, disabled: false, reason: 'none' };
}
