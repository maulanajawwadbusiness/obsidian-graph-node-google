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
    getTransitionPolicy,
} from './appshell/transitions/transitionContract';
import { OnboardingLayerHost } from './appshell/transitions/OnboardingLayerHost';
import { useOnboardingTransition } from './appshell/transitions/useOnboardingTransition';
import { useOnboardingWheelGuard } from './appshell/transitions/useOnboardingWheelGuard';
import { AppScreen, isGraphClassScreen, isOnboardingScreen } from './appshell/screenFlow/screenTypes';
import { getInitialScreen } from './appshell/screenFlow/screenStart';
import { useWelcome1FontGate } from './appshell/screenFlow/useWelcome1FontGate';
import {
    getBackScreen,
    getCreateNewTarget,
    getNextScreen,
    PROMPT_FORWARD_GRAPH_CLASS_TARGET,
    getSkipTarget,
} from './appshell/screenFlow/screenFlowController';
import { renderScreenContent } from './appshell/render/renderScreenContent';
import {
    computeGraphLoadingGateBase,
    computeGraphLoadingWatchdogPhase,
    getGateEntryIntent,
    type GateEntryIntent,
    type GatePhase,
} from './appshell/render/graphLoadingGateMachine';
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
import { TooltipProvider } from '../ui/tooltip/TooltipProvider';
import { SidebarLayer } from './appshell/sidebar/SidebarLayer';
import { useSidebarInterfaces } from './appshell/sidebar/useSidebarInterfaces';

const Graph = React.lazy(() =>
    import('../playground/GraphPhysicsPlayground').then((mod) => ({
        default: mod.GraphPhysicsPlayground,
    }))
);

type Screen = AppScreen;
type SidebarInteractionState = 'active' | 'frozen';
const STORAGE_KEY = 'arnvoid_screen';
const PERSIST_SCREEN = false;
const DEBUG_ONBOARDING_SCROLL_GUARD = false;
const WELCOME1_FONT_TIMEOUT_MS = 1500;
const DEBUG_WARM_MOUNT_QUERY_KEY = 'debugWarmMount';
const GATE_LOADING_START_WATCHDOG_MS = 2000;
const SIDEBAR_VISIBILITY_BY_SCREEN: Record<AppScreen, boolean> = {
    welcome1: false,
    welcome2: false,
    prompt: true,
    graph_loading: true,
    graph: true,
};
const SIDEBAR_INTERACTION_BY_SCREEN: Record<AppScreen, SidebarInteractionState> = {
    welcome1: 'active',
    welcome2: 'active',
    prompt: 'active',
    graph_loading: 'frozen',
    graph: 'active',
};
const SIDEBAR_DIM_ALPHA_BY_SCREEN: Record<AppScreen, number> = {
    welcome1: 1,
    welcome2: 1,
    prompt: 1,
    graph_loading: 0.5,
    graph: 1,
};

function isWarmMountDebugEnabled(): boolean {
    if (!import.meta.env.DEV) return false;
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    return params.get(DEBUG_WARM_MOUNT_QUERY_KEY) === '1';
}

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
    const [gatePhase, setGatePhase] = React.useState<GatePhase>('idle');
    const [seenLoadingTrue, setSeenLoadingTrue] = React.useState(false);
    const [gateEntryIntent, setGateEntryIntent] = React.useState<GateEntryIntent>('none');
    const [documentViewerToggleToken, setDocumentViewerToggleToken] = React.useState(0);
    const [isSidebarExpanded, setIsSidebarExpanded] = React.useState(false);
    const sidebarWasExpandedAtGateEntryRef = React.useRef<boolean | null>(null);
    const previousScreenRef = React.useRef<Screen>(screen);
    const gatePhaseRef = React.useRef<GatePhase>('idle');
    const graphLoadingGateRootRef = React.useRef<HTMLDivElement>(null);
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
    const showMoneyUi = screen === 'prompt' || isGraphClassScreen(screen);
    const showPersistentSidebar = SIDEBAR_VISIBILITY_BY_SCREEN[screen];
    const sidebarFrozen = SIDEBAR_INTERACTION_BY_SCREEN[screen] === 'frozen';
    const sidebarDimAlpha = SIDEBAR_DIM_ALPHA_BY_SCREEN[screen];
    const sidebarExpandedForRender = screen === 'graph_loading' ? false : isSidebarExpanded;
    const loginBlockingActive = screen === 'prompt' && enterPromptOverlayOpen;
    const sidebarDisabled = sidebarFrozen || (isGraphClassScreen(screen) && graphIsLoading) || loginBlockingActive;
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

    const transitionWithPromptGraphGuard = React.useCallback((next: Screen) => {
        if (screen === 'prompt' && next === 'graph') {
            if (import.meta.env.DEV) {
                console.warn('[FlowGuard] blocked prompt->graph direct transition; rerouting to graph_loading');
            }
            transitionToScreen(PROMPT_FORWARD_GRAPH_CLASS_TARGET);
            return;
        }
        transitionToScreen(next);
    }, [screen, transitionToScreen]);

    const warnFrozenSidebarAction = React.useCallback((action: string) => {
        if (!import.meta.env.DEV) return;
        console.warn('[SidebarFreezeGuard] blocked_action=%s screen=%s', action, screen);
    }, [screen]);

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
        if (!isGraphClassScreen(screen)) {
            transitionWithPromptGraphGuard('graph');
        }
        console.log('[appshell] pending_load_interface id=%s', id);
    }, [savedInterfaces, screen, transitionWithPromptGraphGuard]);
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
        if (!isWarmMountDebugEnabled()) return;
        const debugWindow = window as Window & {
            __arnvoid_setScreen?: (next: 'graph_loading' | 'graph') => void;
        };
        debugWindow.__arnvoid_setScreen = (next) => {
            transitionToScreen(next);
            console.log('[WarmMount] debug_set_screen next=%s current=%s', next, screen);
        };
        console.log('[WarmMount] debug_set_screen_ready current=%s', screen);
        return () => {
            delete debugWindow.__arnvoid_setScreen;
        };
    }, [screen, transitionToScreen]);

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

    React.useEffect(() => {
        const previousScreen = previousScreenRef.current;
        const enteringGraphLoading = previousScreen !== 'graph_loading' && screen === 'graph_loading';
        const leavingGraphLoading = previousScreen === 'graph_loading' && screen !== 'graph_loading';
        if (enteringGraphLoading) {
            sidebarWasExpandedAtGateEntryRef.current = isSidebarExpanded;
            if (isSidebarExpanded) {
                setIsSidebarExpanded(false);
            }
        }
        if (leavingGraphLoading) {
            const shouldRestoreExpanded = sidebarWasExpandedAtGateEntryRef.current === true;
            sidebarWasExpandedAtGateEntryRef.current = null;
            if (shouldRestoreExpanded) {
                setIsSidebarExpanded(true);
            }
        }
        previousScreenRef.current = screen;
    }, [isSidebarExpanded, screen]);

    React.useEffect(() => {
        if (screen === 'graph_loading') {
            const entryIntent = getGateEntryIntent(
                pendingAnalysis !== null,
                pendingLoadInterface !== null
            );
            setGateEntryIntent(entryIntent);
            setGatePhase('arming');
            setSeenLoadingTrue(false);
            return;
        }
        setGateEntryIntent('none');
        setGatePhase('idle');
    }, [pendingAnalysis, pendingLoadInterface, screen]);

    React.useEffect(() => {
        const base = computeGraphLoadingGateBase({
            screen,
            entryIntent: gateEntryIntent,
            runtime: { isLoading: graphIsLoading, aiErrorMessage: null },
            seenLoadingTrue,
            currentPhase: gatePhase,
        });
        if (base.nextSeenLoadingTrue !== seenLoadingTrue) {
            setSeenLoadingTrue(base.nextSeenLoadingTrue);
        }
        if (base.nextPhase !== gatePhase) {
            setGatePhase(base.nextPhase);
        }
    }, [gateEntryIntent, gatePhase, graphIsLoading, screen, seenLoadingTrue]);

    React.useEffect(() => {
        if (screen !== 'graph_loading') return;
        if (gateEntryIntent === 'none') return;
        if (seenLoadingTrue) return;
        const timeoutId = window.setTimeout(() => {
            setGatePhase((current) => computeGraphLoadingWatchdogPhase({
                screen,
                entryIntent: gateEntryIntent,
                seenLoadingTrue,
                currentPhase: current,
            }));
            if (import.meta.env.DEV) {
                console.warn(
                    '[GatePhase] loading_watchdog_stalled intent=%s after=%dms',
                    gateEntryIntent,
                    GATE_LOADING_START_WATCHDOG_MS
                );
            }
        }, GATE_LOADING_START_WATCHDOG_MS);
        return () => {
            window.clearTimeout(timeoutId);
        };
    }, [gateEntryIntent, screen, seenLoadingTrue]);

    React.useEffect(() => {
        if (!isWarmMountDebugEnabled()) return;
        const prev = gatePhaseRef.current;
        if (prev !== gatePhase) {
            console.log('[GatePhase] %s->%s', prev, gatePhase);
            gatePhaseRef.current = gatePhase;
        }
    }, [gatePhase]);

    React.useEffect(() => {
        if (screen !== 'graph_loading') return;
        const modalBlockingFocus = isProfileOpen || isLogoutConfirmOpen || pendingDeleteId !== null || isSearchInterfacesOpen;
        if (modalBlockingFocus) return;
        const rafId = window.requestAnimationFrame(() => {
            graphLoadingGateRootRef.current?.focus();
        });
        return () => {
            window.cancelAnimationFrame(rafId);
        };
    }, [isLogoutConfirmOpen, isProfileOpen, isSearchInterfacesOpen, pendingDeleteId, screen]);

    React.useEffect(() => {
        if (!import.meta.env.DEV) return;
        if (screen !== 'graph_loading') return;
        if (sidebarFrozen) return;
        console.warn('[SidebarFreezeGuard] invariant_failed screen=%s sidebarFrozen=%s', screen, String(sidebarFrozen));
    }, [screen, sidebarFrozen]);

    React.useEffect(() => {
        if (!import.meta.env.DEV) return;
        if (screen !== 'graph_loading') return;
        if (sidebarWasExpandedAtGateEntryRef.current !== true) return;
        if (!sidebarExpandedForRender) return;
        console.warn('[SidebarFreezeGuard] collapsed_clamp_expected_but_rendered_expanded=true');
    }, [screen, sidebarExpandedForRender]);

    const confirmGraphLoadingGate = React.useCallback(() => {
        if (screen !== 'graph_loading') return;
        if (gatePhase !== 'done') return;
        const activeElement = document.activeElement;
        if (
            activeElement instanceof HTMLElement &&
            graphLoadingGateRootRef.current &&
            graphLoadingGateRootRef.current.contains(activeElement)
        ) {
            activeElement.blur();
        }
        setGatePhase('confirmed');
        transitionToScreen('graph');
    }, [gatePhase, screen, transitionToScreen]);

    const backToPromptFromGate = React.useCallback(() => {
        if (screen !== 'graph_loading') return;
        transitionToScreen('prompt');
    }, [screen, transitionToScreen]);

    React.useEffect(() => {
        if (screen !== 'graph_loading') return;
        const onKeyDownCapture = (event: KeyboardEvent) => {
            const gateRoot = graphLoadingGateRootRef.current;
            const eventTarget = event.target as Node | null;
            if (gateRoot && eventTarget && gateRoot.contains(eventTarget)) {
                return;
            }
            if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                backToPromptFromGate();
                return;
            }
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                event.stopPropagation();
            }
        };
        window.addEventListener('keydown', onKeyDownCapture, true);
        return () => {
            window.removeEventListener('keydown', onKeyDownCapture, true);
        };
    }, [backToPromptFromGate, screen]);

    React.useEffect(() => {
        if (!import.meta.env.DEV) return;
        if (screen !== 'graph_loading') return;
        const rafId = window.requestAnimationFrame(() => {
            const activeElement = document.activeElement;
            const sidebarRoot = document.querySelector('[data-sidebar-root="1"]');
            if (
                activeElement instanceof HTMLElement &&
                sidebarRoot instanceof HTMLElement &&
                sidebarRoot.contains(activeElement)
            ) {
                console.warn('[FocusGuard] active_element_inside_sidebar_during_graph_loading');
            }
            const modalBlockingFocus = isProfileOpen || isLogoutConfirmOpen || pendingDeleteId !== null || isSearchInterfacesOpen;
            if (modalBlockingFocus) return;
            if (
                activeElement instanceof HTMLElement &&
                graphLoadingGateRootRef.current &&
                !graphLoadingGateRootRef.current.contains(activeElement)
            ) {
                console.warn('[FocusGuard] active_element_outside_gate_during_graph_loading');
            }
        });
        return () => {
            window.cancelAnimationFrame(rafId);
        };
    }, [gatePhase, isLogoutConfirmOpen, isProfileOpen, isSearchInterfacesOpen, pendingDeleteId, screen]);

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
        isSidebarExpanded: sidebarExpandedForRender,
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
        gateConfirmVisible: gatePhase === 'done',
        gateConfirmEnabled: gatePhase === 'done',
        gateRootRef: graphLoadingGateRootRef,
        onGateConfirm: confirmGraphLoadingGate,
        gateShowBackToPrompt: targetScreen === 'graph_loading' && gatePhase !== 'done',
        onGateBackToPrompt: backToPromptFromGate,
        transitionToScreen,
        commitUpsertInterface,
        commitPatchLayoutByDocId,
        getNextScreen,
        getBackScreen,
        getSkipTarget,
    });

    const shouldUseOnboardingLayerHost = (() => {
        if (isGraphClassScreen(screen)) return false;
        if (isOnboardingScreen(screen)) return true;
        if (!isCrossfading || fromScreen === null) return false;
        if (isGraphClassScreen(fromScreen)) return false;
        const policy = getTransitionPolicy(fromScreen, screen);
        return policy.animate && isOnboardingScreen(fromScreen);
    })();

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
        <TooltipProvider>
            <div
                style={SHELL_STYLE}
                data-graph-loading={graphIsLoading ? '1' : '0'}
                data-gate-phase={gatePhase}
                data-gate-seen-loading={seenLoadingTrue ? '1' : '0'}
                data-gate-entry-intent={gateEntryIntent}
                data-sidebar-frozen={sidebarFrozen ? '1' : '0'}
                data-sidebar-dim-alpha={String(sidebarDimAlpha)}
                data-search-interfaces-open={isSearchInterfacesOpen ? '1' : '0'}
                data-search-interfaces-query-len={String(searchInterfacesQuery.length)}
            >
                <SidebarLayer
                    show={showPersistentSidebar}
                    isExpanded={sidebarExpandedForRender}
                    frozen={sidebarFrozen}
                    dimAlpha={sidebarDimAlpha}
                    onToggle={() => {
                        if (sidebarFrozen) {
                            warnFrozenSidebarAction('toggle');
                            return;
                        }
                        setIsSidebarExpanded((prev) => !prev);
                    }}
                    onCreateNew={() => {
                        if (sidebarFrozen) {
                            warnFrozenSidebarAction('create_new');
                            return;
                        }
                        setPendingLoadInterface(null);
                        setPendingAnalysis(null);
                        transitionToScreen(getCreateNewTarget());
                    }}
                    onOpenSearchInterfaces={() => {
                        if (sidebarFrozen) {
                            warnFrozenSidebarAction('open_search');
                            return;
                        }
                        openSearchInterfaces();
                    }}
                    disabled={sidebarDisabled}
                    showDocumentViewerButton={isGraphClassScreen(screen)}
                    onToggleDocumentViewer={() => {
                        if (sidebarFrozen) {
                            warnFrozenSidebarAction('toggle_document_viewer');
                            return;
                        }
                        setDocumentViewerToggleToken((prev) => prev + 1);
                    }}
                    interfaces={sidebarInterfaces}
                    onRenameInterface={(id, newTitle) => {
                        if (sidebarFrozen) {
                            warnFrozenSidebarAction('rename_interface');
                            return;
                        }
                        handleRenameInterface(id, newTitle);
                    }}
                    onDeleteInterface={(id) => {
                        if (isSearchInterfacesOpen) return;
                        if (sidebarDisabled) {
                            if (sidebarFrozen) {
                                warnFrozenSidebarAction('delete_interface');
                            }
                            return;
                        }
                        const record = savedInterfaces.find((item) => item.id === id);
                        if (!record) return;
                        openDeleteConfirm(record.id, record.title);
                        console.log('[appshell] pending_delete_open id=%s', id);
                    }}
                    selectedInterfaceId={pendingLoadInterface?.id ?? undefined}
                    onSelectInterface={(id) => {
                        if (sidebarFrozen) {
                            warnFrozenSidebarAction('select_interface');
                            return;
                        }
                        selectSavedInterfaceById(id);
                    }}
                    accountName={sidebarAccountName}
                    accountImageUrl={sidebarAccountImageUrl}
                    onOpenProfile={isLoggedIn ? openProfileOverlay : undefined}
                    onRequestLogout={isLoggedIn ? openLogoutConfirm : undefined}
                />
                <div
                    style={{
                        ...NON_SIDEBAR_LAYER_STYLE,
                        filter: sidebarExpandedForRender ? NON_SIDEBAR_DIMMED_FILTER : NON_SIDEBAR_BASE_FILTER,
                        transition: prefersReducedMotion ? 'none' : getNonSidebarDimTransitionCss(sidebarExpandedForRender),
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
        </TooltipProvider>
    );
};
