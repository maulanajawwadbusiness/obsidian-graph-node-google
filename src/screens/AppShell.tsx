import React from 'react';
import { ONBOARDING_ENABLED, ONBOARDING_START_SCREEN, ONBOARDING_START_SCREEN_RAW } from '../config/env';
import { BalanceBadge } from '../components/BalanceBadge';
import { ShortageWarning } from '../components/ShortageWarning';
import { MoneyNoticeStack } from '../components/MoneyNoticeStack';
import { Sidebar, type SidebarInterfaceItem } from '../components/Sidebar';
import { useAuth } from '../auth/AuthProvider';
import {
    DEFAULT_SAVED_INTERFACES_CAP,
    getSavedInterfacesStorageKey,
    loadSavedInterfaces,
    saveAllSavedInterfaces,
    type SavedInterfaceRecordV1
} from '../store/savedInterfacesStore';
import {
    ONBOARDING_SCREEN_FADE_EASING,
} from './appshell/transitions/transitionTokens';
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
import { createSavedInterfacesCommitSurfaces } from './appshell/savedInterfaces/savedInterfacesCommits';
import { useSavedInterfacesSync } from './appshell/savedInterfaces/useSavedInterfacesSync';

const Graph = React.lazy(() =>
    import('../playground/GraphPhysicsPlayground').then((mod) => ({
        default: mod.GraphPhysicsPlayground,
    }))
);

type Screen = AppScreen;
type PendingAnalysisPayload =
    | { kind: 'text'; text: string; createdAt: number }
    | { kind: 'file'; file: File; createdAt: number }
    | null;
type GraphPendingAnalysisProps = {
    pendingAnalysisPayload: PendingAnalysisPayload;
    onPendingAnalysisConsumed: () => void;
    onLoadingStateChange?: (isLoading: boolean) => void;
    documentViewerToggleToken?: number;
    pendingLoadInterface?: SavedInterfaceRecordV1 | null;
    onPendingLoadInterfaceConsumed?: () => void;
    onRestoreReadPathChange?: (active: boolean) => void;
    onSavedInterfaceUpsert?: (record: SavedInterfaceRecordV1, reason: string) => void;
    onSavedInterfaceLayoutPatch?: (
        docId: string,
        layout: SavedInterfaceRecordV1['layout'],
        camera: SavedInterfaceRecordV1['camera'],
        reason: string
    ) => void;
};
const STORAGE_KEY = 'arnvoid_screen';
const PERSIST_SCREEN = false;
const DEBUG_ONBOARDING_SCROLL_GUARD = false;
const WELCOME1_FONT_TIMEOUT_MS = 1500;
const SEARCH_RECENT_LIMIT = 12;
const SEARCH_RESULT_LIMIT = 20;

type SearchInterfaceIndexItem = {
    id: string;
    sourceIndex: number;
    title: string;
    normalizedTitle: string;
    subtitle: string;
    updatedAt: number;
    nodeCount: number;
    linkCount: number;
    docId: string;
};

function normalizeSearchText(raw: string): string {
    return raw.toLowerCase().replace(/\s+/g, ' ').trim();
}

function resolveAuthStorageId(user: unknown): string | null {
    if (!user || typeof user !== 'object') return null;
    const typed = user as Record<string, unknown>;
    const rawId = typed.id;
    if (typeof rawId === 'string' && rawId.trim().length > 0) {
        return `id_${rawId.trim()}`;
    }
    if (typeof rawId === 'number' && Number.isFinite(rawId)) {
        return `id_${rawId}`;
    }
    const rawSub = typed.sub;
    if (typeof rawSub === 'string' && rawSub.trim().length > 0) {
        return `sub_${rawSub.trim()}`;
    }
    return null;
}

function sortAndCapSavedInterfaces(
    list: SavedInterfaceRecordV1[],
    cap = DEFAULT_SAVED_INTERFACES_CAP
): SavedInterfaceRecordV1[] {
    const sorted = [...list].sort((a, b) => {
        if (a.updatedAt !== b.updatedAt) return b.updatedAt - a.updatedAt;
        return b.createdAt - a.createdAt;
    });
    if (sorted.length <= cap) return sorted;
    return sorted.slice(0, cap);
}

export const AppShell: React.FC = () => {
    const { user, loading: authLoading, refreshMe, applyUserPatch, logout } = useAuth();
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
        screenTransitionFrom,
        screenTransitionReady,
        effectiveScreenFadeMs,
        isScreenTransitioning,
        shouldBlockOnboardingInput,
    } = useOnboardingTransition<Screen>({ screen, setScreen });
    const {
        enterPromptOverlayOpen,
        isOnboardingOverlayOpen,
        setWelcome1OverlayOpen,
        setEnterPromptOverlayOpen,
    } = useOnboardingOverlayState({ screen });

    const GraphWithPending = Graph as React.ComponentType<GraphPendingAnalysisProps>;
    const showMoneyUi = screen === 'prompt' || screen === 'graph';
    const showBalanceBadge = false;
    const showPersistentSidebar = screen === 'prompt' || screen === 'graph';
    const loginBlockingActive = screen === 'prompt' && enterPromptOverlayOpen;
    const sidebarDisabled = (screen === 'graph' && graphIsLoading) || loginBlockingActive;
    const onboardingActive = isOnboardingScreen(screen) || shouldBlockOnboardingInput;
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
            {showBalanceBadge ? <BalanceBadge /> : null}
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
        savedInterfacesRef.current = savedInterfaces;
    }, [savedInterfaces]);

    const sidebarInterfaces = React.useMemo<SidebarInterfaceItem[]>(
        () =>
            savedInterfaces.map((record) => ({
                id: record.id,
                title: record.title,
                subtitle: new Date(record.updatedAt).toLocaleString(),
                nodeCount: record.preview.nodeCount,
                linkCount: record.preview.linkCount,
                updatedAt: record.updatedAt
            })),
        [savedInterfaces]
    );

    const searchIndex = React.useMemo<SearchInterfaceIndexItem[]>(
        () => savedInterfaces.map((record, sourceIndex) => ({
            id: record.id,
            sourceIndex,
            title: record.title,
            normalizedTitle: normalizeSearchText(record.title),
            subtitle: new Date(record.updatedAt).toLocaleString(),
            updatedAt: record.updatedAt,
            nodeCount: record.preview.nodeCount,
            linkCount: record.preview.linkCount,
            docId: record.docId,
        })),
        [savedInterfaces]
    );

    const filteredSearchResults = React.useMemo<SearchInterfaceIndexItem[]>(() => {
        const normalizedQuery = normalizeSearchText(searchInterfacesQuery);
        if (normalizedQuery.length === 0) {
            return searchIndex.slice(0, SEARCH_RECENT_LIMIT);
        }
        const tokens = normalizedQuery.split(' ').filter((token) => token.length > 0);
        if (tokens.length === 0) {
            return searchIndex.slice(0, SEARCH_RECENT_LIMIT);
        }
        const scored: Array<{ item: SearchInterfaceIndexItem; score: number; bucket: number }> = [];
        for (const item of searchIndex) {
            let score = 0;
            let allMatched = true;
            let hasTokenPrefix = false;
            if (item.normalizedTitle.startsWith(normalizedQuery)) {
                score += 3000;
            }
            for (const token of tokens) {
                const idx = item.normalizedTitle.indexOf(token);
                if (idx < 0) {
                    allMatched = false;
                    break;
                }
                if (idx === 0) {
                    hasTokenPrefix = true;
                    score += 500;
                } else {
                    score += Math.max(1, 200 - idx);
                }
            }
            if (!allMatched) continue;
            const bucket = item.normalizedTitle.startsWith(normalizedQuery)
                ? 3
                : hasTokenPrefix
                    ? 2
                    : 1;
            score -= Math.abs(item.normalizedTitle.length - normalizedQuery.length);
            scored.push({ item, score, bucket });
        }
        scored.sort((a, b) => {
            if (a.bucket !== b.bucket) return b.bucket - a.bucket;
            if (a.score !== b.score) return b.score - a.score;
            if (a.item.updatedAt !== b.item.updatedAt) return b.item.updatedAt - a.item.updatedAt;
            return a.item.sourceIndex - b.item.sourceIndex;
        });
        return scored.slice(0, SEARCH_RESULT_LIMIT).map((entry) => entry.item);
    }, [searchIndex, searchInterfacesQuery]);

    React.useEffect(() => {
        if (filteredSearchResults.length === 0) {
            if (searchHighlightedIndex === -1) return;
            setSearchHighlightedIndex(-1);
            return;
        }
        const clamped = Math.min(
            Math.max(searchHighlightedIndex, 0),
            filteredSearchResults.length - 1
        );
        if (clamped === searchHighlightedIndex) return;
        setSearchHighlightedIndex(clamped);
    }, [filteredSearchResults.length, searchHighlightedIndex]);

    const selectSearchResultById = React.useCallback((id: string) => {
        selectSearchResultByIdState(id, selectSavedInterfaceById);
    }, [selectSavedInterfaceById, selectSearchResultByIdState]);

    React.useEffect(() => {
        if (searchHighlightedIndex !== -1) return;
        if (filteredSearchResults.length === 0) return;
        setSearchHighlightedIndex(0);
    }, [filteredSearchResults.length, searchHighlightedIndex]);

    React.useEffect(() => {
        if (!ONBOARDING_ENABLED || !PERSIST_SCREEN) return;
        if (typeof window === 'undefined') return;
        sessionStorage.setItem(STORAGE_KEY, screen);
    }, [screen]);

    if (screen === 'welcome1') {
        if (!welcome1FontGateDone) {
            return <div style={WELCOME1_FONT_GATE_BLANK_STYLE} />;
        }
    }

    const renderScreenContentByScreen = (targetScreen: Screen): React.ReactNode => renderScreenContent({
        screen: targetScreen,
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
        || (isScreenTransitioning && screenTransitionFrom !== null && isOnboardingScreen(screenTransitionFrom));

    const screenContent = shouldUseOnboardingLayerHost
        ? (
            <OnboardingLayerHost
                screen={screen}
                screenTransitionFrom={screenTransitionFrom}
                screenTransitionReady={screenTransitionReady}
                isScreenTransitioning={isScreenTransitioning}
                effectiveScreenFadeMs={effectiveScreenFadeMs}
                fadeEasing={ONBOARDING_SCREEN_FADE_EASING}
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
            {showPersistentSidebar ? (
                <Sidebar
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
            ) : null}
            <div
                style={{
                    ...NON_SIDEBAR_LAYER_STYLE,
                    ...(isSidebarExpanded ? NON_SIDEBAR_DIMMED_STYLE : null),
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

const FALLBACK_STYLE: React.CSSProperties = {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#0f1115',
    color: '#e7e7e7',
    fontSize: '14px',
};

const SHELL_STYLE: React.CSSProperties = {
    position: 'relative',
    width: '100%',
    minHeight: '100vh',
};

const MAIN_SCREEN_CONTAINER_STYLE: React.CSSProperties = {
    position: 'relative',
    width: '100%',
    minHeight: '100vh',
};

const NON_SIDEBAR_LAYER_STYLE: React.CSSProperties = {
    width: '100%',
    minHeight: '100vh',
};

const NON_SIDEBAR_DIMMED_STYLE: React.CSSProperties = {
    filter: 'brightness(0.8)',
};

const WELCOME1_FONT_GATE_BLANK_STYLE: React.CSSProperties = {
    minHeight: '100vh',
    width: '100%',
    background: '#06060A',
};
