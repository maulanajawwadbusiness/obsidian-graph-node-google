import React from 'react';

type UseLogoutConfirmControllerArgs = {
    logout: () => Promise<void>;
    isDev: boolean;
};

type UseLogoutConfirmControllerResult = {
    logoutConfirmBusy: boolean;
    logoutConfirmError: string | null;
    openLogoutConfirm: (openOverlay: () => boolean) => void;
    closeLogoutConfirm: (closeOverlay: () => boolean) => void;
    confirmLogout: (forceCloseOverlay: () => void) => Promise<void>;
};

export function useLogoutConfirmController(
    args: UseLogoutConfirmControllerArgs
): UseLogoutConfirmControllerResult {
    const { logout, isDev } = args;
    const [logoutConfirmBusy, setLogoutConfirmBusy] = React.useState(false);
    const [logoutConfirmError, setLogoutConfirmError] = React.useState<string | null>(null);

    const openLogoutConfirm = React.useCallback((openOverlay: () => boolean) => {
        const opened = openOverlay();
        if (!opened) return;
        setLogoutConfirmError(null);
    }, []);

    const closeLogoutConfirm = React.useCallback((closeOverlay: () => boolean) => {
        const closed = closeOverlay();
        if (!closed) return;
        setLogoutConfirmError(null);
    }, []);

    const confirmLogout = React.useCallback(async (forceCloseOverlay: () => void) => {
        if (logoutConfirmBusy) return;
        setLogoutConfirmBusy(true);
        setLogoutConfirmError(null);
        try {
            await logout();
            forceCloseOverlay();
            setLogoutConfirmError(null);
        } catch (error) {
            setLogoutConfirmError('Failed to log out. Please try again.');
            if (isDev) {
                console.warn('[appshell] logout_confirm_failed error=%s', String(error));
            }
        } finally {
            setLogoutConfirmBusy(false);
        }
    }, [isDev, logout, logoutConfirmBusy]);

    return {
        logoutConfirmBusy,
        logoutConfirmError,
        openLogoutConfirm,
        closeLogoutConfirm,
        confirmLogout,
    };
}
