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
import type {
    GraphPhysicsPlaygroundProps,
    PendingAnalysisPayload,
    GraphRuntimeStatusSnapshot,
} from '../playground/modules/graphPhysicsTypes';
import {
    ONBOARDING_FADE_EASING,
    getTransitionPolicy,
} from './appshell/transitions/transitionContract';
import {
    GRAPH_LOADING_SCREEN_FADE_EASING,
    GRAPH_LOADING_SCREEN_FADE_MS,
} from './appshell/transitions/transitionTokens';
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
    ContentFadeOverlay,
    type ContentFadePhase,
} from './appshell/render/ContentFadeOverlay';
import {
    computeGraphLoadingGateBase,
    computeGraphLoadingWatchdogPhase,
    getGateControls,
    getGateEntryIntent,
    getGateNextAction,
    type GateEntryIntent,
    type GatePhase,
    type RuntimeStatusSnapshot,
} from './appshell/render/graphLoadingGateMachine';
import { type GateVisualPhase } from './appshell/render/GraphLoadingGate';
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
import { computeSidebarLockState, type SidebarLockReason } from './appshell/sidebar/sidebarLockPolicy';

const Graph = React.lazy(() =>
    import('../playground/GraphPhysicsPlayground').then((mod) => ({
        default: mod.GraphPhysicsPlayground,
    }))
);

type Screen = AppScreen;
type SidebarInteractionState = 'active' | 'frozen';
type GateExitTarget = 'graph' | 'prompt';
type PendingFadeAction =
    | { kind: 'restoreInterface'; record: SavedInterfaceRecordV1 }
    | { kind: 'createNew' }
    | { kind: 'switchGraph'; record: SavedInterfaceRecordV1 };
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
const FALLBACK_GATE_ERROR_MESSAGE = 'Analysis failed. Please try again.';

function hasSameRuntimeStatus(
    left: RuntimeStatusSnapshot,
    right: GraphRuntimeStatusSnapshot
): boolean {
    return left.isLoading === right.isLoading && left.aiErrorMessage === right.aiErrorMessage;
}

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
    const [graphRuntimeStatus, setGraphRuntimeStatus] = React.useState<RuntimeStatusSnapshot>({
        isLoading: false,
        aiErrorMessage: null,
    });
    const [gatePhase, setGatePhase] = React.useState<GatePhase>('idle');
    const [gateVisualPhase, setGateVisualPhase] = React.useState<GateVisualPhase>('visible');
    const [contentFadePhase, setContentFadePhase] = React.useState<ContentFadePhase>('idle');
    const [pendingGateExitTarget, setPendingGateExitTarget] = React.useState<GateExitTarget | null>(null);
    const [seenLoadingTrue, setSeenLoadingTrue] = React.useState(false);
    const [gateEntryIntent, setGateEntryIntent] = React.useState<GateEntryIntent>('none');
    const [promptAnalysisErrorMessage, setPromptAnalysisErrorMessage] = React.useState<string | null>(null);
    const [documentViewerToggleToken, setDocumentViewerToggleToken] = React.useState(0);
    const [isSidebarExpanded, setIsSidebarExpanded] = React.useState(false);
    const sidebarWasExpandedAtGateEntryRef = React.useRef<boolean | null>(null);
    const previousScreenRef = React.useRef<Screen>(screen);
    const gatePhaseRef = React.useRef<GatePhase>('idle');
    const gateErrorBackRequestedRef = React.useRef(false);
    const gateErrorVisibleRef = React.useRef(false);
    const gateExitRequestedRef = React.useRef(false);
    const sidebarLockReasonRef = React.useRef<SidebarLockReason>('none');
    const graphLoadingGateRootRef = React.useRef<HTMLDivElement>(null);
    const gateEnterRafRef = React.useRef<number | null>(null);
    const gateExitTimerRef = React.useRef<number | null>(null);
    const gateExitFailsafeTimerRef = React.useRef<number | null>(null);
    const pendingFadeActionRef = React.useRef<PendingFadeAction | null>(null);
    const savedInterfacesRef = React.useRef<SavedInterfaceRecordV1[]>([]);
    const restoreReadPathActiveRef = React.useRef(false);
    const activeStorageKeyRef = React.useRef<string>(getSavedInterfacesStorageKey());
    const appShellRenderCountRef = React.useRef(0);
    const runtimeStatusEmitCountRef = React.useRef(0);
    const runtimeStatusNoopCountRef = React.useRef(0);
    const runtimeLoadingNoopCountRef = React.useRef(0);
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
    const graphIsLoading = graphRuntimeStatus.isLoading;
    const handleGraphLoadingStateChange = React.useCallback((isLoading: boolean) => {
        setGraphRuntimeStatus((prev) => {
            if (prev.isLoading === isLoading) {
                if (import.meta.env.DEV) {
                    runtimeLoadingNoopCountRef.current += 1;
                    if (runtimeLoadingNoopCountRef.current % 120 === 0) {
                        console.log(
                            '[RenderLoopGuard] loading_noop=%d runtime_noop=%d runtime_emit=%d',
                            runtimeLoadingNoopCountRef.current,
                            runtimeStatusNoopCountRef.current,
                            runtimeStatusEmitCountRef.current
                        );
                    }
                }
                return prev;
            }
            return {
                ...prev,
                isLoading,
            };
        });
    }, []);
    const handleGraphRuntimeStatusChange = React.useCallback((status: GraphRuntimeStatusSnapshot) => {
        if (import.meta.env.DEV) {
            runtimeStatusEmitCountRef.current += 1;
        }
        setGraphRuntimeStatus((prev) => {
            if (hasSameRuntimeStatus(prev, status)) {
                if (import.meta.env.DEV) {
                    runtimeStatusNoopCountRef.current += 1;
                    if (runtimeStatusNoopCountRef.current % 120 === 0) {
                        console.log(
                            '[RenderLoopGuard] runtime_noop=%d loading_noop=%d runtime_emit=%d',
                            runtimeStatusNoopCountRef.current,
                            runtimeLoadingNoopCountRef.current,
                            runtimeStatusEmitCountRef.current
                        );
                    }
                }
                return prev;
            }
            return {
                isLoading: status.isLoading,
                aiErrorMessage: status.aiErrorMessage,
            };
        });
    }, []);
    const normalizedGateErrorMessage = React.useMemo(() => {
        const raw = graphRuntimeStatus.aiErrorMessage;
        if (typeof raw !== 'string') return FALLBACK_GATE_ERROR_MESSAGE;
        const trimmed = raw.trim();
        return trimmed.length > 0 ? trimmed : FALLBACK_GATE_ERROR_MESSAGE;
    }, [graphRuntimeStatus.aiErrorMessage]);
    const gateControls = React.useMemo(() => getGateControls(gatePhase), [gatePhase]);
    const gateInteractionLocked = pendingGateExitTarget !== null || gateVisualPhase === 'exiting';
    const showMoneyUi = screen === 'prompt' || isGraphClassScreen(screen);
    const showPersistentSidebar = SIDEBAR_VISIBILITY_BY_SCREEN[screen];
    const sidebarFrozen = SIDEBAR_INTERACTION_BY_SCREEN[screen] === 'frozen';
    const sidebarDimAlpha = SIDEBAR_DIM_ALPHA_BY_SCREEN[screen];
    const sidebarExpandedForRender = screen === 'graph_loading' ? false : isSidebarExpanded;
    const loginBlockingActive = screen === 'prompt' && enterPromptOverlayOpen;
    const sidebarLock = React.useMemo(() => computeSidebarLockState({
        screen,
        graphIsLoading,
        loginBlockingActive,
        isFrozenByScreen: sidebarFrozen,
    }), [graphIsLoading, loginBlockingActive, screen, sidebarFrozen]);
    const sidebarDisabled = sidebarLock.disabled;
    const sidebarFrozenActive = sidebarLock.frozen;
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
        sidebarLock,
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

    const clearGateVisualTimers = React.useCallback(() => {
        if (gateEnterRafRef.current !== null) {
            window.cancelAnimationFrame(gateEnterRafRef.current);
            gateEnterRafRef.current = null;
        }
        if (gateExitTimerRef.current !== null) {
            window.clearTimeout(gateExitTimerRef.current);
            gateExitTimerRef.current = null;
        }
        if (gateExitFailsafeTimerRef.current !== null) {
            window.clearTimeout(gateExitFailsafeTimerRef.current);
            gateExitFailsafeTimerRef.current = null;
        }
    }, []);

    const requestGateExit = React.useCallback((target: GateExitTarget) => {
        if (screen !== 'graph_loading') return;
        if (gateExitRequestedRef.current) return;
        if (pendingGateExitTarget !== null) return;
        gateExitRequestedRef.current = true;
        setPendingGateExitTarget(target);
        setGateVisualPhase('exiting');
        if (import.meta.env.DEV) {
            console.log('[GateFade] exit_start target=%s fadeMs=%d', target, GRAPH_LOADING_SCREEN_FADE_MS);
        }
        if (gateExitTimerRef.current !== null) {
            window.clearTimeout(gateExitTimerRef.current);
        }
        gateExitTimerRef.current = window.setTimeout(() => {
            gateExitTimerRef.current = null;
            if (import.meta.env.DEV) {
                console.log('[GateFade] exit_commit target=%s', target);
            }
            transitionToScreen(target);
        }, GRAPH_LOADING_SCREEN_FADE_MS);
    }, [pendingGateExitTarget, screen, transitionToScreen]);

    React.useEffect(() => {
        if (screen !== 'graph_loading') return;
        if (gateVisualPhase !== 'exiting') return;
        if (pendingGateExitTarget === null) return;
        if (gateExitFailsafeTimerRef.current !== null) {
            window.clearTimeout(gateExitFailsafeTimerRef.current);
            gateExitFailsafeTimerRef.current = null;
        }
        const failsafeMs = Math.max(1, GRAPH_LOADING_SCREEN_FADE_MS * 2);
        gateExitFailsafeTimerRef.current = window.setTimeout(() => {
            gateExitFailsafeTimerRef.current = null;
            if (screen !== 'graph_loading') return;
            if (gateVisualPhase !== 'exiting') return;
            if (pendingGateExitTarget === null) return;
            if (import.meta.env.DEV) {
                console.warn(
                    '[GateFadeFailsafe] forced_exit target=%s after=%dms',
                    pendingGateExitTarget,
                    failsafeMs
                );
            }
            transitionToScreen(pendingGateExitTarget);
        }, failsafeMs);
        return () => {
            if (gateExitFailsafeTimerRef.current !== null) {
                window.clearTimeout(gateExitFailsafeTimerRef.current);
                gateExitFailsafeTimerRef.current = null;
            }
        };
    }, [gateVisualPhase, pendingGateExitTarget, screen, transitionToScreen]);

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
        if (screen === 'prompt') {
            if (contentFadePhase !== 'idle') return;
            pendingFadeActionRef.current = { kind: 'restoreInterface', record };
            setContentFadePhase('fadingOut');
            console.log('[B1Fade] start id=%s from=%s', record.id, screen);
            return;
        }
        if (isGraphClassScreen(screen)) {
            if (contentFadePhase !== 'idle') return;
            if (graphRuntimeStatus.isLoading) {
                console.log('[B2Fade] blocked: aiActivity');
                return;
            }
            if (pendingLoadInterface?.id === record.id) return;
            pendingFadeActionRef.current = { kind: 'switchGraph', record };
            setContentFadePhase('fadingOut');
            console.log('[B2Fade] start id=%s from=%s', record.id, screen);
            return;
        }
        setPendingLoadInterface(record);
        if (!isGraphClassScreen(screen)) {
            transitionWithPromptGraphGuard('graph');
        }
        console.log('[appshell] pending_load_interface id=%s', id);
    }, [
        contentFadePhase,
        graphRuntimeStatus.isLoading,
        pendingLoadInterface?.id,
        savedInterfaces,
        screen,
        transitionWithPromptGraphGuard,
    ]);
    const onContentFadeOutDone = React.useCallback(() => {
        const action = pendingFadeActionRef.current;
        pendingFadeActionRef.current = null;
        if (!action) {
            setContentFadePhase('idle');
            return;
        }
        if (action.kind === 'restoreInterface') {
            setPendingLoadInterface(action.record);
            transitionToScreen('graph');
            console.log('[B1Fade] commit id=%s', action.record.id);
        } else if (action.kind === 'createNew') {
            setPendingLoadInterface(null);
            setPendingAnalysis(null);
            transitionToScreen('prompt');
            console.log('[B1ReverseFade] commit');
        } else if (action.kind === 'switchGraph') {
            setPendingLoadInterface(action.record);
            console.log('[B2Fade] commit id=%s', action.record.id);
        }
        setContentFadePhase('fadingIn');
    }, [transitionToScreen]);
    const onContentFadeInDone = React.useCallback(() => {
        setContentFadePhase('idle');
        console.log('[NavFade] done');
    }, []);
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
        return () => {
            clearGateVisualTimers();
        };
    }, [clearGateVisualTimers]);

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
        clearGateVisualTimers();
        setPendingGateExitTarget(null);
        gateExitRequestedRef.current = false;
        if (screen !== 'graph_loading') {
            setGateVisualPhase('visible');
            return;
        }
        setGateVisualPhase('entering');
        if (import.meta.env.DEV) {
            console.log('[GateFade] enter_start fadeMs=%d', GRAPH_LOADING_SCREEN_FADE_MS);
        }
        gateEnterRafRef.current = window.requestAnimationFrame(() => {
            gateEnterRafRef.current = null;
            setGateVisualPhase('visible');
            if (import.meta.env.DEV) {
                console.log('[GateFade] enter_visible');
            }
        });
    }, [clearGateVisualTimers, screen]);

    React.useEffect(() => {
        if (screen === 'graph_loading') {
            const entryIntent = getGateEntryIntent(
                pendingAnalysis !== null,
                pendingLoadInterface !== null
            );
            setGateEntryIntent(entryIntent);
            setGraphRuntimeStatus((prev) => ({ ...prev, aiErrorMessage: null }));
            setPromptAnalysisErrorMessage(null);
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
            runtime: graphRuntimeStatus,
            seenLoadingTrue,
            currentPhase: gatePhase,
        });
        if (base.nextSeenLoadingTrue !== seenLoadingTrue) {
            setSeenLoadingTrue(base.nextSeenLoadingTrue);
        }
        if (base.nextPhase !== gatePhase) {
            setGatePhase(base.nextPhase);
        }
    }, [gateEntryIntent, gatePhase, graphRuntimeStatus, screen, seenLoadingTrue]);

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
        const nextAction = getGateNextAction(screen, gatePhase);
        if (nextAction !== 'none' && import.meta.env.DEV) {
            console.warn('[GateContract] unexpected_gate_next_action action=%s', nextAction);
        }
    }, [gatePhase, screen]);

    React.useEffect(() => {
        if (screen === 'graph_loading' && gatePhase === 'error') {
            gateErrorVisibleRef.current = true;
            return;
        }
        if (gateErrorVisibleRef.current && screen !== 'graph_loading') {
            if (import.meta.env.DEV && !gateErrorBackRequestedRef.current) {
                console.warn('[GateContract] exited_error_gate_without_explicit_back');
            }
            gateErrorVisibleRef.current = false;
            gateErrorBackRequestedRef.current = false;
        }
    }, [gatePhase, screen]);

    React.useEffect(() => {
        if (!import.meta.env.DEV) return;
        if (screen !== 'graph_loading') return;
        console.log(
            '[GateContract] phase=%s loading=%s error=%s intent=%s seen=%s',
            gatePhase,
            graphRuntimeStatus.isLoading ? '1' : '0',
            graphRuntimeStatus.aiErrorMessage ? 'present' : 'none',
            gateEntryIntent,
            seenLoadingTrue ? '1' : '0'
        );
    }, [
        gateEntryIntent,
        gatePhase,
        graphRuntimeStatus.aiErrorMessage,
        graphRuntimeStatus.isLoading,
        screen,
        seenLoadingTrue,
    ]);

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
        const prevReason = sidebarLockReasonRef.current;
        const nextReason = sidebarLock.reason;
        if (prevReason === nextReason) return;
        console.log(
            '[SidebarLock] prev=%s next=%s screen=%s loading=%s',
            prevReason,
            nextReason,
            screen,
            graphIsLoading ? '1' : '0'
        );
        sidebarLockReasonRef.current = nextReason;
    }, [graphIsLoading, screen, sidebarLock.reason]);

    React.useEffect(() => {
        if (!import.meta.env.DEV) return;
        if (screen !== 'graph_loading') return;
        if (sidebarFrozenActive) return;
        console.warn(
            '[SidebarFreezeGuard] invariant_failed screen=%s sidebarFrozen=%s reason=%s',
            screen,
            String(sidebarFrozenActive),
            sidebarLock.reason
        );
    }, [screen, sidebarFrozenActive, sidebarLock.reason]);

    React.useEffect(() => {
        if (!import.meta.env.DEV) return;
        if (screen !== 'graph_loading') return;
        if (sidebarWasExpandedAtGateEntryRef.current !== true) return;
        if (!sidebarExpandedForRender) return;
        console.warn('[SidebarFreezeGuard] collapsed_clamp_expected_but_rendered_expanded=true');
    }, [screen, sidebarExpandedForRender]);

    React.useEffect(() => {
        if (!import.meta.env.DEV) return;
        if (screen !== 'graph_loading') return;
        if (!pendingLoadInterface) return;
        console.warn('[Invariant] restore routed to graph_loading; should be direct graph for b1');
    }, [pendingLoadInterface, screen]);

    const confirmGraphLoadingGate = React.useCallback(() => {
        if (screen !== 'graph_loading') return;
        if (gatePhase !== 'done') return;
        if (gateInteractionLocked) return;
        const activeElement = document.activeElement;
        if (
            activeElement instanceof HTMLElement &&
            graphLoadingGateRootRef.current &&
            graphLoadingGateRootRef.current.contains(activeElement)
        ) {
            activeElement.blur();
        }
        setGatePhase('confirmed');
        requestGateExit('graph');
    }, [gateInteractionLocked, gatePhase, requestGateExit, screen]);

    const backToPromptFromGate = React.useCallback(() => {
        if (screen !== 'graph_loading') return;
        if (gateInteractionLocked) return;
        if (gatePhase === 'error') {
            gateErrorBackRequestedRef.current = true;
            setPromptAnalysisErrorMessage(normalizedGateErrorMessage);
        }
        requestGateExit('prompt');
    }, [gateInteractionLocked, gatePhase, normalizedGateErrorMessage, requestGateExit, screen]);

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

    React.useEffect(() => {
        if (!import.meta.env.DEV) return;
        appShellRenderCountRef.current += 1;
        if (appShellRenderCountRef.current % 120 !== 0) return;
        console.log(
            '[RenderLoopGuard] appshell_render=%d runtime_emit=%d runtime_noop=%d loading_noop=%d',
            appShellRenderCountRef.current,
            runtimeStatusEmitCountRef.current,
            runtimeStatusNoopCountRef.current,
            runtimeLoadingNoopCountRef.current
        );
    });

    const renderScreenContentByScreen = React.useCallback((targetScreen: Screen): React.ReactNode => renderScreenContent({
        screen: targetScreen,
        isSidebarExpanded: sidebarExpandedForRender,
        fallbackStyle: FALLBACK_STYLE,
        GraphWithPending,
        pendingAnalysis,
        documentViewerToggleToken,
        pendingLoadInterface,
        setPendingAnalysis,
        onGraphLoadingStateChange: handleGraphLoadingStateChange,
        onGraphRuntimeStatusChange: handleGraphRuntimeStatusChange,
        setPendingLoadInterface,
        setWelcome1OverlayOpen,
        setEnterPromptOverlayOpen,
        setRestoreReadPathActive: (active) => {
            restoreReadPathActiveRef.current = active;
        },
        promptAnalysisErrorMessage,
        clearPromptAnalysisError: () => setPromptAnalysisErrorMessage(null),
        gatePhase,
        gateVisualPhase,
        gateFadeMs: GRAPH_LOADING_SCREEN_FADE_MS,
        gateFadeEasing: GRAPH_LOADING_SCREEN_FADE_EASING,
        gateInteractionLocked,
        gateErrorMessage: normalizedGateErrorMessage,
        gateConfirmVisible: gateControls.allowConfirm,
        gateConfirmEnabled: gateControls.allowConfirm,
        gateRootRef: graphLoadingGateRootRef,
        onGateConfirm: confirmGraphLoadingGate,
        gateShowBackToPrompt: targetScreen === 'graph_loading' && gateControls.allowBack,
        onGateBackToPrompt: backToPromptFromGate,
        transitionToScreen,
        commitUpsertInterface,
        commitPatchLayoutByDocId,
        getNextScreen,
        getBackScreen,
        getSkipTarget,
    }), [
        backToPromptFromGate,
        commitPatchLayoutByDocId,
        commitUpsertInterface,
        confirmGraphLoadingGate,
        documentViewerToggleToken,
        gateControls.allowBack,
        gateControls.allowConfirm,
        gateInteractionLocked,
        gatePhase,
        gateVisualPhase,
        getBackScreen,
        getNextScreen,
        getSkipTarget,
        GraphWithPending,
        handleGraphLoadingStateChange,
        handleGraphRuntimeStatusChange,
        normalizedGateErrorMessage,
        pendingAnalysis,
        pendingLoadInterface,
        promptAnalysisErrorMessage,
        screen,
        sidebarExpandedForRender,
        transitionToScreen,
    ]);

    if (screen === 'welcome1' && !welcome1FontGateDone) return <div style={WELCOME1_FONT_GATE_BLANK_STYLE} />;

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
                data-gate-visual-phase={gateVisualPhase}
                data-gate-exit-pending={pendingGateExitTarget ?? 'none'}
                data-gate-seen-loading={seenLoadingTrue ? '1' : '0'}
                data-gate-entry-intent={gateEntryIntent}
                data-sidebar-frozen={sidebarFrozenActive ? '1' : '0'}
                data-sidebar-dim-alpha={String(sidebarDimAlpha)}
                data-sidebar-lock-reason={sidebarLock.reason}
                data-search-interfaces-open={isSearchInterfacesOpen ? '1' : '0'}
                data-search-interfaces-query-len={String(searchInterfacesQuery.length)}
            >
                <SidebarLayer
                    show={showPersistentSidebar}
                    isExpanded={sidebarExpandedForRender}
                    frozen={sidebarFrozenActive}
                    dimAlpha={sidebarDimAlpha}
                    lockReason={sidebarLock.reason}
                    onToggle={() => {
                        if (sidebarFrozenActive) {
                            warnFrozenSidebarAction('toggle');
                            return;
                        }
                        setIsSidebarExpanded((prev) => !prev);
                    }}
                    onCreateNew={() => {
                        if (sidebarFrozenActive) {
                            warnFrozenSidebarAction('create_new');
                            return;
                        }
                        if (contentFadePhase !== 'idle') return;
                        if (isGraphClassScreen(screen)) {
                            pendingFadeActionRef.current = { kind: 'createNew' };
                            setContentFadePhase('fadingOut');
                            console.log('[B1ReverseFade] start from=%s', screen);
                            return;
                        }
                        setPendingLoadInterface(null);
                        setPendingAnalysis(null);
                        transitionToScreen(getCreateNewTarget());
                    }}
                    onOpenSearchInterfaces={() => {
                        if (sidebarFrozenActive) {
                            warnFrozenSidebarAction('open_search');
                            return;
                        }
                        openSearchInterfaces();
                    }}
                    disabled={sidebarDisabled}
                    showDocumentViewerButton={isGraphClassScreen(screen)}
                    onToggleDocumentViewer={() => {
                        if (sidebarFrozenActive) {
                            warnFrozenSidebarAction('toggle_document_viewer');
                            return;
                        }
                        setDocumentViewerToggleToken((prev) => prev + 1);
                    }}
                    interfaces={sidebarInterfaces}
                    onRenameInterface={(id, newTitle) => {
                        if (sidebarFrozenActive) {
                            warnFrozenSidebarAction('rename_interface');
                            return;
                        }
                        handleRenameInterface(id, newTitle);
                    }}
                    onDeleteInterface={(id) => {
                        if (isSearchInterfacesOpen) return;
                        if (sidebarDisabled) {
                            if (sidebarFrozenActive) {
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
                        if (sidebarFrozenActive) {
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
                    <ContentFadeOverlay
                        phase={contentFadePhase}
                        fadeMs={GRAPH_LOADING_SCREEN_FADE_MS}
                        fadeEasing={GRAPH_LOADING_SCREEN_FADE_EASING}
                        onFadeOutDone={onContentFadeOutDone}
                        onFadeInDone={onContentFadeInDone}
                    />
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
