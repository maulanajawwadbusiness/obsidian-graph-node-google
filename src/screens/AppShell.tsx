import React from 'react';
import { ONBOARDING_ENABLED, ONBOARDING_START_SCREEN, ONBOARDING_START_SCREEN_RAW } from '../config/env';
import { ShortageWarning } from '../components/ShortageWarning';
import { MoneyNoticeStack } from '../components/MoneyNoticeStack';
import { useAuth } from '../auth/AuthProvider';
import {
    getSavedInterfacesStorageKey,
    loadSavedInterfaces,
    saveAllSavedInterfaces,
    type SavedInterfaceRecordV1
} from '../store/savedInterfacesStore';
import type { GraphPhysicsPlaygroundProps, PendingAnalysisPayload } from '../playground/modules/graphPhysicsTypes';
import {
    ONBOARDING_FADE_EASING,
} from './appshell/transitions/transitionContract';
import { OnboardingLayerHost } from './appshell/transitions/OnboardingLayerHost';
import { useOnboardingTransition } from './appshell/transitions/useOnboardingTransition';
import { useOnboardingWheelGuard } from './appshell/transitions/useOnboardingWheelGuard';
import { AppScreen, isOnboardingScreen } from './appshell/screenFlow/screenTypes';
import { getInitialScreen } from './appshell/screenFlow/screenStart';
import { useWelcome1FontGate } from './appshell/screenFlow/useWelcome1FontGate';
import {
    getBackScreen,
    getCreateNewTarget,
    getNextScreen,
    getSkipTarget,
} from './appshell/screenFlow/screenFlowController';
import { renderScreenContent } from './appshell/render/renderScreenContent';
import { useOnboardingOverlayState } from './appshell/overlays/useOnboardingOverlayState';
import { OnboardingChrome } from './appshell/overlays/OnboardingChrome';
import { useAppShellModals } from './appshell/overlays/useAppShellModals';
import { ModalLayer } from './appshell/overlays/ModalLayer';
import { useProfileController } from './appshell/overlays/useProfileController';
import { useLogoutConfirmController } from './appshell/overlays/useLogoutConfirmController';
import { useSearchInterfacesEngine } from './appshell/overlays/useSearchInterfacesEngine';
import { createSavedInterfacesCommitSurfaces } from './appshell/savedInterfaces/savedInterfacesCommits';
import { useSavedInterfacesSync } from './appshell/savedInterfaces/useSavedInterfacesSync';
import { resolveAuthStorageId, sortAndCapSavedInterfaces } from './appshell/appShellHelpers';
import {
    FALLBACK_STYLE,
    getNonSidebarDimTransitionCss,
    MAIN_SCREEN_CONTAINER_STYLE,
    NON_SIDEBAR_BASE_FILTER,
    NON_SIDEBAR_DIMMED_FILTER,
    NON_SIDEBAR_LAYER_STYLE,
    SHELL_STYLE,
    WELCOME1_FONT_GATE_BLANK_STYLE,
} from './appshell/appShellStyles';
import { SidebarLayer } from './appshell/sidebar/SidebarLayer';
import { useSidebarInterfaces } from './appshell/sidebar/useSidebarInterfaces';

const Graph = React.lazy(() =>
    import('../playground/GraphPhysicsPlayground').then((mod) => ({
        default: mod.GraphPhysicsPlayground,
    }))
);

type Screen = AppScreen;
const STORAGE_KEY = 'arnvoid_screen';
const PERSIST_SCREEN = false;
const DEBUG_ONBOARDING_SCROLL_GUARD = false;
const WELCOME1_FONT_TIMEOUT_MS = 1500;

export const AppShell: React.FC = () => {
    const { user, loading: authLoading, refreshMe, applyUserPatch, logout } = useAuth();
    const [prefersReducedMotion, setPrefersReducedMotion] = React.useState(false);
    const [screen, setScreen] = React.useState<Screen>(() => getInitialScreen({
        onboardingEnabled: ONBOARDING_ENABLED,
        onboardingStartScreen: ONBOARDING_START_SCREEN,
        onboardingStartScreenRaw: ONBOARDING_START_SCREEN_RAW,
        isDev: import.meta.env.DEV,
        persistScreen: PERSIST_SCREEN,
        storageKey: STORAGE_KEY,
    }));
    const [pendingAnalysis, setPendingAnalysis] = React.useState<PendingAnalysisPayload>(null);
    const [savedInterfaces, setSavedInterfaces] = React.useState<SavedInterfaceRecordV1[]>([]);
    const [pendingLoadInterface, setPendingLoadInterface] = React.useState<SavedInterfaceRecordV1 | null>(null);
    const [graphIsLoading, setGraphIsLoading] = React.useState(false);
    const [documentViewerToggleToken, setDocumentViewerToggleToken] = React.useState(0);
    const [isSidebarExpanded, setIsSidebarExpanded] = React.useState(false);
    const savedInterfacesRef = React.useRef<SavedInterfaceRecordV1[]>([]);
    const restoreReadPathActiveRef = React.useRef(false);
    const activeStorageKeyRef = React.useRef<string>(getSavedInterfacesStorageKey());
    const authStorageId = React.useMemo(() => resolveAuthStorageId(user), [user]);
    const isAuthReady = !authLoading;
    const isLoggedIn = isAuthReady && user !== null && authStorageId !== null;
    const sidebarAccountName = React.useMemo(() => {
        if (!user) return undefined;
        if (typeof user.displayName === 'string' && user.displayName.trim()) return user.displayName.trim();
        if (typeof user.name === 'string' && user.name.trim()) return user.name.trim();
        if (typeof user.email === 'string' && user.email.trim()) return user.email.trim();
        return undefined;
    }, [user]);
    const sidebarAccountImageUrl = React.useMemo(() => {
        if (!user) return undefined;
        return typeof user.picture === 'string' && user.picture.trim() ? user.picture : undefined;
    }, [user]);
    const authIdentityKey = React.useMemo(() => {
        if (!isAuthReady) return null;
        if (isLoggedIn && authStorageId) {
            return `user:${authStorageId}`;
        }
        return 'guest';
    }, [authStorageId, isAuthReady, isLoggedIn]);
    const {
        transitionToScreen,
        fromScreen,
        isFadeArmed,
        effectiveFadeMs,
        isCrossfading,
        isBlockingInput,
    } = useOnboardingTransition<Screen>({ screen, setScreen });
    const {
        enterPromptOverlayOpen,
        isOnboardingOverlayOpen,
        setWelcome1OverlayOpen,
        setEnterPromptOverlayOpen,
    } = useOnboardingOverlayState({ screen });

    const GraphWithPending = Graph as React.ComponentType<GraphPhysicsPlaygroundProps>;
    const showMoneyUi = screen === 'prompt' || screen === 'graph';
    const showPersistentSidebar = screen === 'prompt' || screen === 'graph';
    const loginBlockingActive = screen === 'prompt' && enterPromptOverlayOpen;
    const sidebarDisabled = (screen === 'graph' && graphIsLoading) || loginBlockingActive;
    const onboardingActive = isOnboardingScreen(screen) || isBlockingInput;
    const welcome1FontGateDone = useWelcome1FontGate({
        screen,
        timeoutMs: WELCOME1_FONT_TIMEOUT_MS,
        isDev: import.meta.env.DEV,
    });
    useOnboardingWheelGuard({
        enabled: ONBOARDING_ENABLED,
        active: onboardingActive,
        debug: DEBUG_ONBOARDING_SCROLL_GUARD,
    });
    const {
        profileDraftDisplayName,
        profileDraftUsername,
        profileError,
        profileSaving,
        setProfileDraftDisplayName,
        setProfileDraftUsername,
        setProfileError,
        openProfileOverlay: openProfileOverlayController,
        closeProfileOverlay: closeProfileOverlayController,
        onProfileSave: onProfileSaveController,
    } = useProfileController({
        user,
        applyUserPatch,
        refreshMe,
        isDev: import.meta.env.DEV,
    });
    const {
        logoutConfirmBusy,
        logoutConfirmError,
        openLogoutConfirm: openLogoutConfirmController,
        closeLogoutConfirm: closeLogoutConfirmController,
        confirmLogout: confirmLogoutController,
    } = useLogoutConfirmController({
        logout,
        isDev: import.meta.env.DEV,
    });
    const {
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
        openProfileOverlay: openProfileOverlayState,
        closeProfileOverlay: closeProfileOverlayState,
        forceCloseProfileOverlay,
        openLogoutConfirm: openLogoutConfirmState,
        closeLogoutConfirm: closeLogoutConfirmState,
        forceCloseLogoutConfirm,
        selectSearchResultById: selectSearchResultByIdState,
    } = useAppShellModals({
        sidebarDisabled,
        isLoggedIn,
        hasUser: user !== null,
        profileSaving,
        logoutConfirmBusy,
    });

    const moneyUi = showMoneyUi ? (
        <>
            <ShortageWarning />
            <MoneyNoticeStack />
        </>
    ) : null;

    const applySavedInterfacesState = React.useCallback((next: SavedInterfaceRecordV1[]) => {
        const normalized = sortAndCapSavedInterfaces(next);
        savedInterfacesRef.current = normalized;
        setSavedInterfaces(normalized);
        saveAllSavedInterfaces(normalized);
        return normalized;
    }, []);
    const refreshSavedInterfaces = React.useCallback(() => {
        const next = loadSavedInterfaces();
        savedInterfacesRef.current = next;
        setSavedInterfaces(next);
        return next;
    }, []);
    const { enqueueRemoteUpsert, enqueueRemoteDelete } = useSavedInterfacesSync({
        isAuthReady,
        isLoggedIn,
        authStorageId,
        authIdentityKey,
        isRestoreReadPathActive: () => restoreReadPathActiveRef.current,
        refreshSavedInterfaces,
        loadSavedInterfacesFn: loadSavedInterfaces,
        applySavedInterfacesState,
        setPendingLoadInterface,
        setPendingAnalysis,
        closeDeleteConfirm,
        resetSearchUi,
        activeStorageKeyRef,
    });
    const {
        commitUpsertInterface,
        commitPatchLayoutByDocId,
        commitDeleteInterface,
        commitRenameInterface,
    } = React.useMemo(() => createSavedInterfacesCommitSurfaces({
        getSavedInterfaces: () => savedInterfacesRef.current,
        applySavedInterfacesState,
        setPendingLoadInterface,
        enqueueRemoteUpsert,
        enqueueRemoteDelete,
        isRestoreReadPathActive: () => restoreReadPathActiveRef.current,
        isDev: import.meta.env.DEV,
    }), [
        applySavedInterfacesState,
        enqueueRemoteDelete,
        enqueueRemoteUpsert,
        setPendingLoadInterface,
    ]);
    const selectSavedInterfaceById = React.useCallback((id: string) => {
        const record = savedInterfaces.find((item) => item.id === id);
        if (!record) return;
        setPendingLoadInterface(record);
        if (screen !== 'graph') {
            transitionToScreen('graph');
        }
        console.log('[appshell] pending_load_interface id=%s', id);
    }, [savedInterfaces, screen, transitionToScreen]);
    const confirmDelete = React.useCallback(() => {
        if (!pendingDeleteId) {
            console.log('[appshell] delete_interface_skipped reason=no_id');
            return;
        }
        const deletedId = pendingDeleteId;
        commitDeleteInterface(deletedId, 'sidebar_delete');
        console.log('[appshell] delete_interface_ok id=%s', deletedId);
        closeDeleteConfirm();
    }, [closeDeleteConfirm, commitDeleteInterface, pendingDeleteId]);
    const handleRenameInterface = React.useCallback((id: string, newTitle: string) => {
        commitRenameInterface(id, newTitle, 'sidebar_rename');
    }, [commitRenameInterface]);
    const closeProfileOverlay = React.useCallback(() => {
        closeProfileOverlayController(closeProfileOverlayState);
    }, [closeProfileOverlayController, closeProfileOverlayState]);
    const openProfileOverlay = React.useCallback(() => {
        openProfileOverlayController(openProfileOverlayState);
    }, [openProfileOverlayController, openProfileOverlayState]);
    const closeLogoutConfirm = React.useCallback(() => {
        closeLogoutConfirmController(closeLogoutConfirmState);
    }, [closeLogoutConfirmController, closeLogoutConfirmState]);
    const openLogoutConfirm = React.useCallback(() => {
        openLogoutConfirmController(openLogoutConfirmState);
    }, [openLogoutConfirmController, openLogoutConfirmState]);
    const confirmLogout = React.useCallback(async () => {
        await confirmLogoutController(forceCloseLogoutConfirm);
    }, [confirmLogoutController, forceCloseLogoutConfirm]);
    const onProfileSave = React.useCallback(async () => {
        await onProfileSaveController(forceCloseProfileOverlay);
    }, [forceCloseProfileOverlay, onProfileSaveController]);

    React.useEffect(() => {
        const media = window.matchMedia('(prefers-reduced-motion: reduce)');
        const update = () => setPrefersReducedMotion(media.matches);
        update();
        if (typeof media.addEventListener === 'function') {
            media.addEventListener('change', update);
            return () => media.removeEventListener('change', update);
        }
        media.addListener(update);
        return () => media.removeListener(update);
    }, []);

    React.useEffect(() => {
        savedInterfacesRef.current = savedInterfaces;
    }, [savedInterfaces]);

    const sidebarInterfaces = useSidebarInterfaces(savedInterfaces);
    const { filteredSearchResults } = useSearchInterfacesEngine({
        savedInterfaces,
        searchInterfacesQuery,
        searchHighlightedIndex,
        setSearchHighlightedIndex,
    });

    const selectSearchResultById = React.useCallback((id: string) => {
        selectSearchResultByIdState(id, selectSavedInterfaceById);
    }, [selectSavedInterfaceById, selectSearchResultByIdState]);

    React.useEffect(() => {
        if (!ONBOARDING_ENABLED || !PERSIST_SCREEN) return;
        if (typeof window === 'undefined') return;
        sessionStorage.setItem(STORAGE_KEY, screen);
    }, [screen]);

    if (screen === 'welcome1' && !welcome1FontGateDone) return <div style={WELCOME1_FONT_GATE_BLANK_STYLE} />;

    const renderScreenContentByScreen = (targetScreen: Screen): React.ReactNode => renderScreenContent({
        screen: targetScreen,
        isSidebarExpanded,
        fallbackStyle: FALLBACK_STYLE,
        GraphWithPending,
        pendingAnalysis,
        documentViewerToggleToken,
        pendingLoadInterface,
        setPendingAnalysis,
        setGraphIsLoading,
        setPendingLoadInterface,
        setWelcome1OverlayOpen,
        setEnterPromptOverlayOpen,
        setRestoreReadPathActive: (active) => {
            restoreReadPathActiveRef.current = active;
        },
        transitionToScreen,
        commitUpsertInterface,
        commitPatchLayoutByDocId,
        getNextScreen,
        getBackScreen,
        getSkipTarget,
    });

    const shouldUseOnboardingLayerHost = isOnboardingScreen(screen)
        || (isCrossfading && fromScreen !== null && isOnboardingScreen(fromScreen));

    const screenContent = shouldUseOnboardingLayerHost
        ? (
            <OnboardingLayerHost
                screen={screen}
                fromScreen={fromScreen}
                isFadeArmed={isFadeArmed}
                isCrossfading={isCrossfading}
                fadeMs={effectiveFadeMs}
                fadeEasing={ONBOARDING_FADE_EASING}
                renderScreenContent={renderScreenContentByScreen}
            />
        )
        : renderScreenContentByScreen(screen);

    return (
        <div
            style={SHELL_STYLE}
            data-graph-loading={graphIsLoading ? '1' : '0'}
            data-search-interfaces-open={isSearchInterfacesOpen ? '1' : '0'}
            data-search-interfaces-query-len={String(searchInterfacesQuery.length)}
        >
            <SidebarLayer
                show={showPersistentSidebar}
                isExpanded={isSidebarExpanded}
                onToggle={() => setIsSidebarExpanded((prev) => !prev)}
                onCreateNew={() => {
                    setPendingLoadInterface(null);
                    setPendingAnalysis(null);
                    transitionToScreen(getCreateNewTarget());
                }}
                onOpenSearchInterfaces={() => openSearchInterfaces()}
                disabled={sidebarDisabled}
                showDocumentViewerButton={screen === 'graph'}
                onToggleDocumentViewer={() => setDocumentViewerToggleToken((prev) => prev + 1)}
                interfaces={sidebarInterfaces}
                onRenameInterface={handleRenameInterface}
                onDeleteInterface={(id) => {
                    if (isSearchInterfacesOpen) return;
                    if (sidebarDisabled) return;
                    const record = savedInterfaces.find((item) => item.id === id);
                    if (!record) return;
                    openDeleteConfirm(record.id, record.title);
                    console.log('[appshell] pending_delete_open id=%s', id);
                }}
                selectedInterfaceId={pendingLoadInterface?.id ?? undefined}
                onSelectInterface={(id) => selectSavedInterfaceById(id)}
                accountName={sidebarAccountName}
                accountImageUrl={sidebarAccountImageUrl}
                onOpenProfile={isLoggedIn ? openProfileOverlay : undefined}
                onRequestLogout={isLoggedIn ? openLogoutConfirm : undefined}
            />
            <div
                style={{
                    ...NON_SIDEBAR_LAYER_STYLE,
                    filter: isSidebarExpanded ? NON_SIDEBAR_DIMMED_FILTER : NON_SIDEBAR_BASE_FILTER,
                    transition: prefersReducedMotion ? 'none' : getNonSidebarDimTransitionCss(isSidebarExpanded),
                }}
            >
                <div data-main-screen-root="1" style={MAIN_SCREEN_CONTAINER_STYLE}>
                    {screenContent}
                </div>
                <OnboardingChrome
                    screen={screen}
                    isOnboardingOverlayOpen={isOnboardingOverlayOpen}
                />
                {moneyUi}
            </div>
            <ModalLayer
                profile={{
                    isProfileOpen,
                    sidebarAccountImageUrl,
                    profileDraftDisplayName,
                    profileDraftUsername,
                    profileError,
                    profileSaving,
                    setProfileDraftDisplayName,
                    setProfileDraftUsername,
                    setProfileError,
                    closeProfileOverlay,
                    onProfileSave,
                }}
                logout={{
                    isLogoutConfirmOpen,
                    logoutConfirmError,
                    logoutConfirmBusy,
                    closeLogoutConfirm,
                    confirmLogout,
                }}
                deleteConfirm={{
                    pendingDeleteId,
                    pendingDeleteTitle,
                    closeDeleteConfirm,
                    confirmDelete,
                }}
                search={{
                    isSearchInterfacesOpen,
                    closeSearchInterfaces,
                    searchInterfacesQuery,
                    setSearchInterfacesQuery,
                    searchInputFocused,
                    setSearchInputFocused,
                    searchHighlightedIndex,
                    setSearchHighlightedIndex,
                    filteredSearchResults,
                    selectSearchResultById,
                    searchInputRef,
                }}
            />
        </div>
    );
};
