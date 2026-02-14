import React from 'react';

type UseAppShellModalsArgs = {
    sidebarDisabled: boolean;
    isLoggedIn: boolean;
    hasUser: boolean;
    profileSaving: boolean;
    logoutConfirmBusy: boolean;
};

type UseAppShellModalsResult = {
    isSearchInterfacesOpen: boolean;
    searchInterfacesQuery: string;
    searchHighlightedIndex: number;
    searchInputFocused: boolean;
    pendingDeleteId: string | null;
    pendingDeleteTitle: string | null;
    isProfileOpen: boolean;
    isLogoutConfirmOpen: boolean;
    searchInputRef: React.MutableRefObject<HTMLInputElement | null>;
    setSearchInterfacesQuery: (next: string) => void;
    setSearchHighlightedIndex: React.Dispatch<React.SetStateAction<number>>;
    setSearchInputFocused: React.Dispatch<React.SetStateAction<boolean>>;
    openSearchInterfaces: () => void;
    closeSearchInterfaces: () => void;
    resetSearchUi: () => void;
    openDeleteConfirm: (id: string, title: string) => void;
    closeDeleteConfirm: () => void;
    openProfileOverlay: () => boolean;
    closeProfileOverlay: () => boolean;
    forceCloseProfileOverlay: () => void;
    openLogoutConfirm: () => boolean;
    closeLogoutConfirm: () => boolean;
    forceCloseLogoutConfirm: () => void;
    selectSearchResultById: (id: string, onSelect: (id: string) => void) => void;
};

export function useAppShellModals(args: UseAppShellModalsArgs): UseAppShellModalsResult {
    const { sidebarDisabled, isLoggedIn, hasUser, profileSaving, logoutConfirmBusy } = args;
    const [isSearchInterfacesOpen, setIsSearchInterfacesOpen] = React.useState(false);
    const [searchInterfacesQuery, setSearchInterfacesQueryState] = React.useState('');
    const [searchHighlightedIndex, setSearchHighlightedIndex] = React.useState(0);
    const [searchInputFocused, setSearchInputFocused] = React.useState(false);
    const [pendingDeleteId, setPendingDeleteId] = React.useState<string | null>(null);
    const [pendingDeleteTitle, setPendingDeleteTitle] = React.useState<string | null>(null);
    const [isProfileOpen, setIsProfileOpen] = React.useState(false);
    const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = React.useState(false);
    const searchInputRef = React.useRef<HTMLInputElement | null>(null);
    const didSelectThisOpenRef = React.useRef(false);

    const setSearchInterfacesQuery = React.useCallback((next: string) => {
        setSearchInterfacesQueryState(next);
        setSearchHighlightedIndex(0);
    }, []);

    const resetSearchUi = React.useCallback(() => {
        didSelectThisOpenRef.current = false;
        setIsSearchInterfacesOpen(false);
        setSearchInterfacesQueryState('');
        setSearchHighlightedIndex(0);
        setSearchInputFocused(false);
    }, []);

    const closeDeleteConfirm = React.useCallback(() => {
        setPendingDeleteId(null);
        setPendingDeleteTitle(null);
    }, []);

    const closeSearchInterfaces = React.useCallback(() => {
        didSelectThisOpenRef.current = false;
        setIsSearchInterfacesOpen(false);
        setSearchInterfacesQueryState('');
        setSearchHighlightedIndex(0);
        console.log('[appshell] search_close');
    }, []);

    const openSearchInterfaces = React.useCallback(() => {
        if (pendingDeleteId) return;
        if (sidebarDisabled) return;
        didSelectThisOpenRef.current = false;
        setIsSearchInterfacesOpen(true);
        setSearchInterfacesQuery('');
        setSearchHighlightedIndex(0);
        console.log('[appshell] search_open');
    }, [pendingDeleteId, setSearchInterfacesQuery, sidebarDisabled]);

    const openDeleteConfirm = React.useCallback((id: string, title: string) => {
        setPendingDeleteId(id);
        setPendingDeleteTitle(title);
    }, []);

    const closeProfileOverlay = React.useCallback(() => {
        if (profileSaving) return false;
        setIsProfileOpen(false);
        return true;
    }, [profileSaving]);
    const forceCloseProfileOverlay = React.useCallback(() => {
        setIsProfileOpen(false);
    }, []);

    const openProfileOverlay = React.useCallback(() => {
        if (!isLoggedIn || !hasUser) return false;
        if (sidebarDisabled) return false;
        if (isSearchInterfacesOpen) {
            closeSearchInterfaces();
        }
        if (pendingDeleteId) {
            closeDeleteConfirm();
        }
        setIsProfileOpen(true);
        return true;
    }, [
        closeDeleteConfirm,
        closeSearchInterfaces,
        hasUser,
        isLoggedIn,
        isSearchInterfacesOpen,
        pendingDeleteId,
        sidebarDisabled,
    ]);

    const closeLogoutConfirm = React.useCallback(() => {
        if (logoutConfirmBusy) return false;
        setIsLogoutConfirmOpen(false);
        return true;
    }, [logoutConfirmBusy]);
    const forceCloseLogoutConfirm = React.useCallback(() => {
        setIsLogoutConfirmOpen(false);
    }, []);

    const openLogoutConfirm = React.useCallback(() => {
        if (!isLoggedIn) return false;
        if (sidebarDisabled) return false;
        if (isSearchInterfacesOpen) {
            closeSearchInterfaces();
        }
        if (pendingDeleteId) {
            closeDeleteConfirm();
        }
        if (isProfileOpen) {
            closeProfileOverlay();
        }
        setIsLogoutConfirmOpen(true);
        return true;
    }, [
        closeDeleteConfirm,
        closeProfileOverlay,
        closeSearchInterfaces,
        isLoggedIn,
        isProfileOpen,
        isSearchInterfacesOpen,
        pendingDeleteId,
        sidebarDisabled,
    ]);

    const selectSearchResultById = React.useCallback((id: string, onSelect: (pickedId: string) => void) => {
        if (didSelectThisOpenRef.current) return;
        didSelectThisOpenRef.current = true;
        closeSearchInterfaces();
        onSelect(id);
    }, [closeSearchInterfaces]);

    React.useEffect(() => {
        if (!isSearchInterfacesOpen) return;
        if (!pendingDeleteId) return;
        closeSearchInterfaces();
    }, [closeSearchInterfaces, isSearchInterfacesOpen, pendingDeleteId]);

    React.useEffect(() => {
        if (!isSearchInterfacesOpen) return;
        if (!sidebarDisabled) return;
        closeSearchInterfaces();
    }, [closeSearchInterfaces, isSearchInterfacesOpen, sidebarDisabled]);

    React.useEffect(() => {
        if (!isSearchInterfacesOpen) return;
        const id = window.requestAnimationFrame(() => {
            searchInputRef.current?.focus();
            searchInputRef.current?.select();
        });
        return () => window.cancelAnimationFrame(id);
    }, [isSearchInterfacesOpen]);

    React.useEffect(() => {
        if (!pendingDeleteId) return;
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return;
            event.stopPropagation();
            closeDeleteConfirm();
        };
        window.addEventListener('keydown', onKeyDown, true);
        return () => {
            window.removeEventListener('keydown', onKeyDown, true);
        };
    }, [closeDeleteConfirm, pendingDeleteId]);

    React.useEffect(() => {
        if (!isProfileOpen) return;
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return;
            event.stopPropagation();
            closeProfileOverlay();
        };
        window.addEventListener('keydown', onKeyDown, true);
        return () => {
            window.removeEventListener('keydown', onKeyDown, true);
        };
    }, [closeProfileOverlay, isProfileOpen]);

    React.useEffect(() => {
        if (!isLogoutConfirmOpen) return;
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return;
            event.stopPropagation();
            closeLogoutConfirm();
        };
        window.addEventListener('keydown', onKeyDown, true);
        return () => {
            window.removeEventListener('keydown', onKeyDown, true);
        };
    }, [closeLogoutConfirm, isLogoutConfirmOpen]);

    return {
        isSearchInterfacesOpen,
        searchInterfacesQuery,
        searchHighlightedIndex,
        searchInputFocused,
        pendingDeleteId,
        pendingDeleteTitle,
        isProfileOpen,
        isLogoutConfirmOpen,
        searchInputRef,
        setSearchInterfacesQuery,
        setSearchHighlightedIndex,
        setSearchInputFocused,
        openSearchInterfaces,
        closeSearchInterfaces,
        resetSearchUi,
        openDeleteConfirm,
        closeDeleteConfirm,
        openProfileOverlay,
        closeProfileOverlay,
        forceCloseProfileOverlay,
        openLogoutConfirm,
        closeLogoutConfirm,
        forceCloseLogoutConfirm,
        selectSearchResultById,
    };
}
