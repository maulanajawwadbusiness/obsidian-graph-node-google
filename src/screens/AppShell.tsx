import React, { Suspense } from 'react';
import { ONBOARDING_ENABLED, ONBOARDING_START_SCREEN, ONBOARDING_START_SCREEN_RAW } from '../config/env';
import { Welcome1 } from './Welcome1';
import { Welcome2 } from './Welcome2';
import { EnterPrompt } from './EnterPrompt';
import { BalanceBadge } from '../components/BalanceBadge';
import { ShortageWarning } from '../components/ShortageWarning';
import { MoneyNoticeStack } from '../components/MoneyNoticeStack';
import { FullscreenButton } from '../components/FullscreenButton';
import { Sidebar, type SidebarInterfaceItem } from '../components/Sidebar';
import { useAuth } from '../auth/AuthProvider';
import {
    deleteSavedInterface as deleteSavedInterfaceRemote,
    listSavedInterfaces,
    upsertSavedInterface as upsertSavedInterfaceRemote,
} from '../api';
import {
    buildSavedInterfacesStorageKeyForUser,
    DEFAULT_SAVED_INTERFACES_CAP,
    SAVED_INTERFACES_KEY,
    deleteSavedInterface as deleteSavedInterfaceLocal,
    getSavedInterfacesStorageKey,
    loadSavedInterfaces,
    parseSavedInterfaceRecord,
    patchSavedInterfaceTitle,
    saveAllSavedInterfaces,
    setSavedInterfacesStorageKey,
    type SavedInterfaceRecordV1
} from '../store/savedInterfacesStore';

const Graph = React.lazy(() =>
    import('../playground/GraphPhysicsPlayground').then((mod) => ({
        default: mod.GraphPhysicsPlayground,
    }))
);

type Screen = 'welcome1' | 'welcome2' | 'prompt' | 'graph';
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
    onInterfaceSaved?: () => void;
};
const STORAGE_KEY = 'arnvoid_screen';
const PERSIST_SCREEN = false;
const DEBUG_ONBOARDING_SCROLL_GUARD = false;
const WELCOME1_FONT_TIMEOUT_MS = 1500;
const SEARCH_RECENT_LIMIT = 12;
const SEARCH_RESULT_LIMIT = 20;
const REMOTE_BACKFILL_LIMIT = 10;
const hydratedStorageKeysSession = new Set<string>();
const backfilledStorageKeysSession = new Set<string>();
let hasWarnedInvalidStartScreen = false;

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

function truncateDisplayTitle(raw: string, maxChars = 75): string {
    if (raw.length <= maxChars) return raw;
    return `${raw.slice(0, maxChars).trimEnd()}...`;
}

function buildSyncStamp(record: SavedInterfaceRecordV1): string {
    return `${record.updatedAt}|${record.title}`;
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

function warnInvalidOnboardingStartScreenOnce() {
    if (!import.meta.env.DEV) return;
    if (hasWarnedInvalidStartScreen) return;
    if (ONBOARDING_START_SCREEN_RAW.trim() === '') return;
    if (ONBOARDING_START_SCREEN !== null) return;
    hasWarnedInvalidStartScreen = true;
    console.warn(
        '[OnboardingStart] invalid VITE_ONBOARDING_START_SCREEN="%s". Allowed: screen1|screen2|screen3|screen4|welcome1|welcome2|prompt|graph',
        ONBOARDING_START_SCREEN_RAW
    );
}

function getInitialScreen(): Screen {
    if (!ONBOARDING_ENABLED) return 'graph';
    if (import.meta.env.DEV && ONBOARDING_START_SCREEN !== null) return ONBOARDING_START_SCREEN;
    warnInvalidOnboardingStartScreenOnce();
    if (PERSIST_SCREEN && typeof window !== 'undefined') {
        const stored = sessionStorage.getItem(STORAGE_KEY) as Screen | null;
        if (stored === 'welcome1' || stored === 'welcome2' || stored === 'prompt' || stored === 'graph') {
            return stored;
        }
    }
    return 'welcome1';
}

export const AppShell: React.FC = () => {
    const { user, loading: authLoading } = useAuth();
    const [screen, setScreen] = React.useState<Screen>(() => getInitialScreen());
    const [pendingAnalysis, setPendingAnalysis] = React.useState<PendingAnalysisPayload>(null);
    const [savedInterfaces, setSavedInterfaces] = React.useState<SavedInterfaceRecordV1[]>([]);
    const [pendingLoadInterface, setPendingLoadInterface] = React.useState<SavedInterfaceRecordV1 | null>(null);
    const [isSearchInterfacesOpen, setIsSearchInterfacesOpen] = React.useState(false);
    const [searchInterfacesQuery, setSearchInterfacesQueryState] = React.useState('');
    const [searchHighlightedIndex, setSearchHighlightedIndex] = React.useState(0);
    const [pendingDeleteId, setPendingDeleteId] = React.useState<string | null>(null);
    const [pendingDeleteTitle, setPendingDeleteTitle] = React.useState<string | null>(null);
    const [graphIsLoading, setGraphIsLoading] = React.useState(false);
    const [documentViewerToggleToken, setDocumentViewerToggleToken] = React.useState(0);
    const [isSidebarExpanded, setIsSidebarExpanded] = React.useState(false);
    const [welcome1OverlayOpen, setWelcome1OverlayOpen] = React.useState(false);
    const [enterPromptOverlayOpen, setEnterPromptOverlayOpen] = React.useState(false);
    const [welcome1FontGateDone, setWelcome1FontGateDone] = React.useState(false);
    const [searchInputFocused, setSearchInputFocused] = React.useState(false);
    const searchInputRef = React.useRef<HTMLInputElement | null>(null);
    const didSelectThisOpenRef = React.useRef(false);
    const savedInterfacesRef = React.useRef<SavedInterfaceRecordV1[]>([]);
    const activeStorageKeyRef = React.useRef<string>(getSavedInterfacesStorageKey());
    const hydratedStorageKeyRef = React.useRef<string | null>(null);
    const backfilledStorageKeyRef = React.useRef<string | null>(null);
    const lastSyncedStampByIdRef = React.useRef<Map<string, string>>(new Map());
    const remoteSyncChainRef = React.useRef<Promise<void>>(Promise.resolve());
    const remoteSyncEnabledRef = React.useRef(false);
    const remoteKnownUpdatedAtByIdRef = React.useRef<Map<string, number>>(new Map());
    const authStorageId = React.useMemo(() => resolveAuthStorageId(user), [user]);
    const isAuthReady = !authLoading;
    const isLoggedIn = isAuthReady && user !== null && authStorageId !== null;
    const stopEventPropagation = React.useCallback((e: React.SyntheticEvent) => {
        e.stopPropagation();
    }, []);
    const hardShieldInput = React.useMemo(
        () => ({
            onPointerDown: stopEventPropagation,
            onPointerUp: stopEventPropagation,
            onClick: stopEventPropagation,
            onWheelCapture: stopEventPropagation,
            onWheel: stopEventPropagation,
        }),
        [stopEventPropagation]
    );
    const GraphWithPending = Graph as React.ComponentType<GraphPendingAnalysisProps>;
    const showMoneyUi = screen === 'prompt' || screen === 'graph';
    const showBalanceBadge = false;
    const showPersistentSidebar = screen === 'prompt' || screen === 'graph';
    const sidebarDisabled = screen === 'graph' && graphIsLoading;
    const showOnboardingFullscreenButton = screen === 'welcome1' || screen === 'welcome2' || screen === 'prompt';
    const onboardingActive = screen === 'welcome1' || screen === 'welcome2' || screen === 'prompt';
    const isOnboardingOverlayOpen = welcome1OverlayOpen || enterPromptOverlayOpen;
    const onboardingFullscreenButtonStyle: React.CSSProperties = screen === 'prompt'
        ? {
            ...ONBOARDING_FULLSCREEN_BUTTON_STYLE,
            width: '30px',
            height: '30px',
            padding: '6px',
        }
        : ONBOARDING_FULLSCREEN_BUTTON_STYLE;

    const moneyUi = showMoneyUi ? (
        <>
            {showBalanceBadge ? <BalanceBadge /> : null}
            <ShortageWarning />
            <MoneyNoticeStack />
        </>
    ) : null;

    const onboardingFullscreenButton = showOnboardingFullscreenButton ? (
        <FullscreenButton
            style={onboardingFullscreenButtonStyle}
            blocked={isOnboardingOverlayOpen}
        />
    ) : null;

    const refreshSavedInterfaces = React.useCallback(() => {
        const next = loadSavedInterfaces();
        savedInterfacesRef.current = next;
        setSavedInterfaces(next);
        return next;
    }, []);
    const enqueueRemoteTask = React.useCallback((task: () => Promise<void>) => {
        remoteSyncChainRef.current = remoteSyncChainRef.current
            .then(task)
            .catch((error) => {
                console.warn('[savedInterfaces] remote_sync_task_failed error=%s', String(error));
            });
    }, []);
    const remoteUpsertRecord = React.useCallback((record: SavedInterfaceRecordV1, reason: string) => {
        if (!remoteSyncEnabledRef.current) return;
        const stamp = buildSyncStamp(record);
        if (lastSyncedStampByIdRef.current.get(record.id) === stamp) return;
        enqueueRemoteTask(async () => {
            if (!remoteSyncEnabledRef.current) return;
            await upsertSavedInterfaceRemote({
                clientInterfaceId: record.id,
                title: record.title,
                payloadVersion: 1,
                payloadJson: record,
            });
            lastSyncedStampByIdRef.current.set(record.id, stamp);
            remoteKnownUpdatedAtByIdRef.current.set(record.id, record.updatedAt);
            console.log('[savedInterfaces] remote_upsert_ok id=%s reason=%s', record.id, reason);
        });
    }, [enqueueRemoteTask]);
    const remoteDeleteById = React.useCallback((id: string, reason: string) => {
        if (!remoteSyncEnabledRef.current) return;
        enqueueRemoteTask(async () => {
            if (!remoteSyncEnabledRef.current) return;
            await deleteSavedInterfaceRemote(id);
            lastSyncedStampByIdRef.current.delete(id);
            remoteKnownUpdatedAtByIdRef.current.delete(id);
            console.log('[savedInterfaces] remote_delete_ok id=%s reason=%s', id, reason);
        });
    }, [enqueueRemoteTask]);
    const handleInterfaceSaved = React.useCallback(() => {
        const beforeById = new Map(savedInterfacesRef.current.map((record) => [record.id, record]));
        const next = refreshSavedInterfaces();
        if (!remoteSyncEnabledRef.current) return;
        for (const record of next) {
            const before = beforeById.get(record.id);
            if (!before) {
                remoteUpsertRecord(record, 'analysis_save_new');
                continue;
            }
            if (before.updatedAt !== record.updatedAt || before.title !== record.title) {
                remoteUpsertRecord(record, 'analysis_save_update');
            }
        }
    }, [refreshSavedInterfaces, remoteUpsertRecord]);
    const closeDeleteConfirm = React.useCallback(() => {
        setPendingDeleteId(null);
        setPendingDeleteTitle(null);
    }, []);
    const setSearchInterfacesQuery = React.useCallback((next: string) => {
        setSearchInterfacesQueryState(next);
        setSearchHighlightedIndex(0);
    }, []);
    const selectSavedInterfaceById = React.useCallback((id: string) => {
        const record = savedInterfaces.find((item) => item.id === id);
        if (!record) return;
        setPendingLoadInterface(record);
        if (screen !== 'graph') {
            setScreen('graph');
        }
        console.log('[appshell] pending_load_interface id=%s', id);
    }, [savedInterfaces, screen]);
    const openSearchInterfaces = React.useCallback(() => {
        if (pendingDeleteId) return;
        if (sidebarDisabled) return;
        didSelectThisOpenRef.current = false;
        setIsSearchInterfacesOpen(true);
        setSearchInterfacesQuery('');
        setSearchHighlightedIndex(0);
        console.log('[appshell] search_open');
    }, [pendingDeleteId, setSearchInterfacesQuery, sidebarDisabled]);
    const closeSearchInterfaces = React.useCallback(() => {
        didSelectThisOpenRef.current = false;
        setIsSearchInterfacesOpen(false);
        setSearchInterfacesQuery('');
        setSearchHighlightedIndex(0);
        console.log('[appshell] search_close');
    }, [setSearchInterfacesQuery]);
    const confirmDelete = React.useCallback(() => {
        if (!pendingDeleteId) {
            console.log('[appshell] delete_interface_skipped reason=no_id');
            return;
        }
        const deletedId = pendingDeleteId;
        deleteSavedInterfaceLocal(deletedId);
        refreshSavedInterfaces();
        remoteDeleteById(deletedId, 'sidebar_delete');
        setPendingLoadInterface((curr) => (curr?.id === deletedId ? null : curr));
        console.log('[appshell] delete_interface_ok id=%s', deletedId);
        closeDeleteConfirm();
    }, [closeDeleteConfirm, pendingDeleteId, refreshSavedInterfaces, remoteDeleteById]);
    const handleRenameInterface = React.useCallback((id: string, newTitle: string) => {
        patchSavedInterfaceTitle(id, newTitle);
        const next = refreshSavedInterfaces();
        const record = next.find((item) => item.id === id);
        if (record) {
            remoteUpsertRecord(record, 'sidebar_rename');
        }
    }, [refreshSavedInterfaces, remoteUpsertRecord]);

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
        savedInterfacesRef.current = savedInterfaces;
    }, [savedInterfaces]);

    React.useEffect(() => {
        remoteSyncEnabledRef.current = isLoggedIn;
    }, [isLoggedIn]);

    React.useEffect(() => {
        if (!isAuthReady) return;
        const nextStorageKey = isLoggedIn && authStorageId
            ? buildSavedInterfacesStorageKeyForUser(authStorageId)
            : getSavedInterfacesStorageKey().startsWith(`${SAVED_INTERFACES_KEY}_user_`)
                ? SAVED_INTERFACES_KEY
                : getSavedInterfacesStorageKey();
        if (activeStorageKeyRef.current === nextStorageKey) return;
        setSavedInterfacesStorageKey(nextStorageKey);
        activeStorageKeyRef.current = nextStorageKey;
        hydratedStorageKeyRef.current = null;
        backfilledStorageKeyRef.current = null;
        lastSyncedStampByIdRef.current.clear();
        remoteKnownUpdatedAtByIdRef.current.clear();
        setPendingLoadInterface(null);
        refreshSavedInterfaces();
        console.log('[savedInterfaces] storage_key_switched key=%s', nextStorageKey);
    }, [authStorageId, isAuthReady, isLoggedIn, refreshSavedInterfaces]);

    React.useEffect(() => {
        refreshSavedInterfaces();
    }, [refreshSavedInterfaces]);

    React.useEffect(() => {
        if (screen !== 'graph') return;
        refreshSavedInterfaces();
    }, [screen, refreshSavedInterfaces]);

    React.useEffect(() => {
        if (!isAuthReady || !isLoggedIn) return;
        const storageKey = activeStorageKeyRef.current;
        if (!storageKey) return;
        if (hydratedStorageKeyRef.current === storageKey || hydratedStorageKeysSession.has(storageKey)) return;
        hydratedStorageKeyRef.current = storageKey;
        hydratedStorageKeysSession.add(storageKey);

        let cancelled = false;
        void (async () => {
            try {
                const localRecords = loadSavedInterfaces();
                const remoteItems = await listSavedInterfaces();
                if (cancelled) return;

                const remoteRecords: SavedInterfaceRecordV1[] = [];
                const remoteById = new Map<string, SavedInterfaceRecordV1>();
                for (const item of remoteItems) {
                    const parsed = parseSavedInterfaceRecord(item.payloadJson);
                    if (!parsed) {
                        console.warn('[savedInterfaces] remote_payload_invalid_skipped id=%s', item.clientInterfaceId);
                        continue;
                    }
                    remoteRecords.push(parsed);
                    remoteById.set(parsed.id, parsed);
                    lastSyncedStampByIdRef.current.set(parsed.id, buildSyncStamp(parsed));
                    remoteKnownUpdatedAtByIdRef.current.set(parsed.id, parsed.updatedAt);
                }

                const mergedById = new Map<string, SavedInterfaceRecordV1>();
                for (const localRecord of localRecords) {
                    mergedById.set(localRecord.id, localRecord);
                }
                for (const remoteRecord of remoteRecords) {
                    const existing = mergedById.get(remoteRecord.id);
                    if (!existing) {
                        mergedById.set(remoteRecord.id, remoteRecord);
                        continue;
                    }
                    if (remoteRecord.updatedAt >= existing.updatedAt) {
                        mergedById.set(remoteRecord.id, remoteRecord);
                    }
                }

                const merged = sortAndCapSavedInterfaces(Array.from(mergedById.values()));
                saveAllSavedInterfaces(merged);
                const reloaded = loadSavedInterfaces();
                if (cancelled) return;
                savedInterfacesRef.current = reloaded;
                setSavedInterfaces(reloaded);
                console.log('[savedInterfaces] hydrate_merge_ok local=%d remote=%d merged=%d', localRecords.length, remoteRecords.length, reloaded.length);

                if (backfilledStorageKeyRef.current === storageKey || backfilledStorageKeysSession.has(storageKey)) {
                    return;
                }
                backfilledStorageKeyRef.current = storageKey;
                backfilledStorageKeysSession.add(storageKey);

                let queued = 0;
                for (const record of reloaded) {
                    if (queued >= REMOTE_BACKFILL_LIMIT) break;
                    const remoteRecord = remoteById.get(record.id);
                    if (!remoteRecord || record.updatedAt > remoteRecord.updatedAt) {
                        remoteUpsertRecord(record, 'login_backfill');
                        queued += 1;
                    }
                }
                if (queued > 0) {
                    console.log('[savedInterfaces] backfill_queued count=%d', queued);
                }
            } catch (error) {
                console.warn('[savedInterfaces] hydrate_remote_failed error=%s', String(error));
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [isAuthReady, isLoggedIn, remoteUpsertRecord]);

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
        if (didSelectThisOpenRef.current) return;
        didSelectThisOpenRef.current = true;
        closeSearchInterfaces();
        selectSavedInterfaceById(id);
    }, [closeSearchInterfaces, selectSavedInterfaceById]);

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

    React.useEffect(() => {
        if (!ONBOARDING_ENABLED || !onboardingActive) return;
        if (typeof window === 'undefined') return;

        const onWheel = (event: WheelEvent) => {
            event.preventDefault();
            if (DEBUG_ONBOARDING_SCROLL_GUARD) {
                console.log('[OnboardingGesture] wheel prevented');
            }
        };

        window.addEventListener('wheel', onWheel, { passive: false, capture: true });
        return () => {
            window.removeEventListener('wheel', onWheel, true);
        };
    }, [onboardingActive]);

    React.useEffect(() => {
        if (screen !== 'welcome1') return;
        if (welcome1FontGateDone) return;
        const startMs = performance.now();
        const shouldLog = import.meta.env.DEV;
        if (shouldLog) {
            console.log('[OnboardingFont] font_check_start');
        }

        let settled = false;
        let disposed = false;
        let timeoutId: number | null = null;

        const settle = (timedOut: boolean) => {
            if (settled || disposed) return;
            settled = true;
            if (timeoutId !== null) {
                window.clearTimeout(timeoutId);
            }

            if (shouldLog) {
                const elapsedMs = Math.round(performance.now() - startMs);
                if (timedOut) {
                    console.log('[OnboardingFont] font_timeout_ms=1500 proceed');
                } else {
                    console.log('[OnboardingFont] font_ready_ms=%d', elapsedMs);
                }
            }
            setWelcome1FontGateDone(true);
        };

        if (typeof document === 'undefined' || !document.fonts || typeof document.fonts.load !== 'function') {
            settle(false);
            return () => {
                disposed = true;
            };
        }

        timeoutId = window.setTimeout(() => {
            settle(true);
        }, WELCOME1_FONT_TIMEOUT_MS);

        void document.fonts
            .load('16px "Quicksand"')
            .then(() => {
                settle(false);
            })
            .catch(() => {
                settle(true);
            });

        return () => {
            disposed = true;
            if (timeoutId !== null) {
                window.clearTimeout(timeoutId);
            }
        };
    }, [screen, welcome1FontGateDone]);

    if (screen === 'welcome1') {
        if (!welcome1FontGateDone) {
            return <div style={WELCOME1_FONT_GATE_BLANK_STYLE} />;
        }
    }

    const screenContent = screen === 'graph'
        ? (
            <Suspense fallback={<div style={FALLBACK_STYLE}>Loading graph...</div>}>
                <GraphWithPending
                    pendingAnalysisPayload={pendingAnalysis}
                    onPendingAnalysisConsumed={() => setPendingAnalysis(null)}
                    onLoadingStateChange={(v) => setGraphIsLoading(v)}
                    documentViewerToggleToken={documentViewerToggleToken}
                    pendingLoadInterface={pendingLoadInterface}
                    onPendingLoadInterfaceConsumed={() => setPendingLoadInterface(null)}
                    onInterfaceSaved={handleInterfaceSaved}
                />
            </Suspense>
        )
        : screen === 'welcome1'
            ? (
                <Welcome1
                    onNext={() => setScreen('welcome2')}
                    onSkip={() => setScreen('graph')}
                    onOverlayOpenChange={setWelcome1OverlayOpen}
                />
            )
            : screen === 'welcome2'
                ? (
                    <Welcome2
                        onBack={() => setScreen('welcome1')}
                        onNext={() => setScreen('prompt')}
                        onSkip={() => setScreen('graph')}
                    />
                )
                : (
                    <EnterPrompt
                        onBack={() => setScreen('welcome2')}
                        onEnter={() => setScreen('graph')}
                        onSkip={() => setScreen('graph')}
                        onOverlayOpenChange={setEnterPromptOverlayOpen}
                        onSubmitPromptText={(text) => {
                            setPendingAnalysis({ kind: 'text', text, createdAt: Date.now() });
                            console.log(`[appshell] pending_analysis_set kind=text len=${text.length}`);
                        }}
                        onSubmitPromptFile={(file) => {
                            setPendingAnalysis({ kind: 'file', file, createdAt: Date.now() });
                            console.log('[appshell] pending_analysis_set kind=file name=%s size=%d', file.name, file.size);
                        }}
                    />
                );

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
                        setScreen('prompt');
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
                        setPendingDeleteId(record.id);
                        setPendingDeleteTitle(record.title);
                        console.log('[appshell] pending_delete_open id=%s', id);
                    }}
                    selectedInterfaceId={pendingLoadInterface?.id ?? undefined}
                    onSelectInterface={(id) => selectSavedInterfaceById(id)}
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
                {onboardingFullscreenButton}
                {moneyUi}
            </div>
            {pendingDeleteId ? (
                <div
                    data-delete-backdrop="1"
                    style={DELETE_CONFIRM_BACKDROP_STYLE}
                    onPointerDown={(e) => e.stopPropagation()}
                    onPointerUp={(e) => e.stopPropagation()}
                    onClick={(e) => {
                        e.stopPropagation();
                        closeDeleteConfirm();
                    }}
                    onWheelCapture={(e) => e.stopPropagation()}
                    onWheel={(e) => e.stopPropagation()}
                >
                    <div
                        data-delete-modal="1"
                        style={DELETE_CONFIRM_CARD_STYLE}
                        onPointerDown={(e) => e.stopPropagation()}
                        onPointerUp={(e) => e.stopPropagation()}
                        onClick={(e) => e.stopPropagation()}
                        onWheelCapture={(e) => e.stopPropagation()}
                        onWheel={(e) => e.stopPropagation()}
                    >
                        <div style={DELETE_CONFIRM_TITLE_STYLE}>
                            Delete saved interface?
                        </div>
                        <div style={DELETE_CONFIRM_TEXT_STYLE}>
                            This will permanently remove "{pendingDeleteTitle ?? pendingDeleteId}" from this device.
                            This action cannot be undone.
                        </div>
                        <div style={DELETE_CONFIRM_BUTTON_ROW_STYLE}>
                            <button
                                type="button"
                                style={DELETE_CONFIRM_CANCEL_STYLE}
                                onPointerDown={(e) => e.stopPropagation()}
                                onPointerUp={(e) => e.stopPropagation()}
                                onWheelCapture={(e) => e.stopPropagation()}
                                onWheel={(e) => e.stopPropagation()}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    closeDeleteConfirm();
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                style={DELETE_CONFIRM_PRIMARY_STYLE}
                                onPointerDown={(e) => e.stopPropagation()}
                                onPointerUp={(e) => e.stopPropagation()}
                                onWheelCapture={(e) => e.stopPropagation()}
                                onWheel={(e) => e.stopPropagation()}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    confirmDelete();
                                }}
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
            {isSearchInterfacesOpen ? (
                <div
                    {...hardShieldInput}
                    data-search-interfaces-backdrop="1"
                    data-search-backdrop="1"
                    style={SEARCH_OVERLAY_BACKDROP_STYLE}
                    onClick={(e) => {
                        e.stopPropagation();
                        closeSearchInterfaces();
                    }}
                >
                    <div
                        {...hardShieldInput}
                        data-search-interfaces-modal="1"
                        data-search-modal="1"
                        style={{
                            ...SEARCH_OVERLAY_CARD_STYLE,
                            boxShadow: searchInputFocused
                                ? '0 0 0 1px rgba(231, 231, 231, 0.08), 0 18px 56px rgba(0, 0, 0, 0.45)'
                                : SEARCH_OVERLAY_CARD_STYLE.boxShadow,
                        }}
                        onKeyDown={(e) => {
                            e.stopPropagation();
                            if (e.key !== 'Escape') return;
                            e.preventDefault();
                            closeSearchInterfaces();
                        }}
                    >
                        <button
                            {...hardShieldInput}
                            type="button"
                            aria-label="Close search"
                            style={SEARCH_CLOSE_BUTTON_STYLE}
                            onClick={(e) => {
                                e.stopPropagation();
                                closeSearchInterfaces();
                            }}
                        >
                            x
                        </button>
                        <input
                            {...hardShieldInput}
                            ref={searchInputRef}
                            autoFocus
                            value={searchInterfacesQuery}
                            placeholder="Search interfaces..."
                            style={SEARCH_INPUT_STYLE}
                            onChange={(e) => setSearchInterfacesQuery(e.target.value)}
                            onFocus={() => setSearchInputFocused(true)}
                            onBlur={() => setSearchInputFocused(false)}
                            onKeyDown={(e) => {
                                e.stopPropagation();
                                if (e.key === 'Escape') {
                                    e.preventDefault();
                                    closeSearchInterfaces();
                                    return;
                                }
                                if (e.key === 'Enter') {
                                    if (searchHighlightedIndex < 0) return;
                                    const picked = filteredSearchResults[searchHighlightedIndex] ?? filteredSearchResults[0];
                                    if (!picked) return;
                                    e.preventDefault();
                                    selectSearchResultById(picked.id);
                                    return;
                                }
                                if (e.key === 'ArrowDown') {
                                    e.preventDefault();
                                    setSearchHighlightedIndex((curr) => {
                                        if (filteredSearchResults.length === 0) return -1;
                                        if (curr < 0) return 0;
                                        return Math.min(filteredSearchResults.length - 1, curr + 1);
                                    });
                                    return;
                                }
                                if (e.key === 'ArrowUp') {
                                    e.preventDefault();
                                    setSearchHighlightedIndex((curr) => {
                                        if (curr < 0) return -1;
                                        return Math.max(0, curr - 1);
                                    });
                                }
                            }}
                        />
                        <div
                            {...hardShieldInput}
                            className="search-interfaces-scroll"
                            data-search-interfaces-results="1"
                            style={SEARCH_RESULTS_STYLE}
                        >
                            {normalizeSearchText(searchInterfacesQuery).length === 0 ? (
                                <div style={SEARCH_SECTION_LABEL_STYLE}>Recent</div>
                            ) : null}
                            {filteredSearchResults.length === 0 ? (
                                <div style={SEARCH_EMPTY_STYLE}>
                                    <span style={SEARCH_EMPTY_TITLE_STYLE}>No interfaces found.</span>
                                    <span style={SEARCH_EMPTY_HINT_STYLE}>Try a different keyword.</span>
                                </div>
                            ) : (
                                filteredSearchResults.map((item, index) => {
                                    const isHighlighted = normalizeSearchText(searchInterfacesQuery).length > 0
                                        && index === searchHighlightedIndex;
                                    return (
                                        <button
                                            {...hardShieldInput}
                                            key={item.id}
                                            type="button"
                                            style={{
                                                ...SEARCH_RESULT_ROW_STYLE,
                                                borderColor: isHighlighted ? 'rgba(99, 171, 255, 0.5)' : SEARCH_RESULT_ROW_STYLE.borderColor,
                                                background: isHighlighted ? 'rgba(171, 210, 255, 0.11)' : SEARCH_RESULT_ROW_STYLE.background,
                                            }}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                selectSearchResultById(item.id);
                                            }}
                                            onMouseEnter={() => setSearchHighlightedIndex(index)}
                                        >
                                            <span style={SEARCH_RESULT_TITLE_STYLE}>{truncateDisplayTitle(item.title)}</span>
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>
            ) : null}
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

const DELETE_CONFIRM_BACKDROP_STYLE: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(6, 8, 12, 0.64)',
    zIndex: 3200,
    pointerEvents: 'auto',
};

const DELETE_CONFIRM_CARD_STYLE: React.CSSProperties = {
    width: '100%',
    maxWidth: '420px',
    margin: '0 16px',
    borderRadius: '14px',
    border: '1px solid rgba(255, 255, 255, 0.14)',
    background: '#0d1118',
    boxShadow: '0 18px 56px rgba(0, 0, 0, 0.45)',
    padding: '18px 18px 16px',
    color: '#e7e7e7',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
};

const DELETE_CONFIRM_TITLE_STYLE: React.CSSProperties = {
    fontSize: '17px',
    lineHeight: 1.25,
    fontWeight: 700,
    color: '#f3f7ff',
};

const DELETE_CONFIRM_TEXT_STYLE: React.CSSProperties = {
    fontSize: '14px',
    lineHeight: 1.5,
    color: 'rgba(231, 231, 231, 0.88)',
};

const DELETE_CONFIRM_BUTTON_ROW_STYLE: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '8px',
    marginTop: '4px',
};

const DELETE_CONFIRM_CANCEL_STYLE: React.CSSProperties = {
    border: '1px solid rgba(255, 255, 255, 0.26)',
    background: 'rgba(255, 255, 255, 0.04)',
    color: '#f1f4fb',
    borderRadius: '8px',
    padding: '8px 14px',
    cursor: 'pointer',
    fontWeight: 600,
};

const DELETE_CONFIRM_PRIMARY_STYLE: React.CSSProperties = {
    border: '1px solid #ff4b4e',
    background: '#ff4b4e',
    color: '#ffffff',
    borderRadius: '8px',
    padding: '8px 14px',
    cursor: 'pointer',
    fontWeight: 700,
};

const SEARCH_OVERLAY_BACKDROP_STYLE: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '16px',
    boxSizing: 'border-box',
    background: 'rgba(6, 8, 12, 0.58)',
    zIndex: 3100,
    pointerEvents: 'auto',
};

const SEARCH_OVERLAY_CARD_STYLE: React.CSSProperties = {
    position: 'relative',
    width: 'min(560px, calc(100vw - 32px))',
    height: 'min(320px, calc(100vh - 64px))',
    maxHeight: 'calc(100vh - 64px)',
    overflowX: 'hidden',
    borderRadius: '14px',
    border: 'none',
    background: '#0d1118',
    boxShadow: '0 18px 56px rgba(0, 0, 0, 0.45)',
    padding: '16px',
    boxSizing: 'border-box',
    overflow: 'hidden',
    color: '#e7e7e7',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
};

const SEARCH_CLOSE_BUTTON_STYLE: React.CSSProperties = {
    position: 'absolute',
    top: '12px',
    right: '-6px',
    width: '24px',
    height: '24px',
    borderRadius: '6px',
    border: 'none',
    background: 'transparent',
    color: 'rgba(231, 231, 231, 0.86)',
    cursor: 'pointer',
    lineHeight: 1,
    fontSize: '14px',
    fontWeight: 600,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    fontFamily: 'var(--font-ui)',
    opacity: 0.7,
};

const SEARCH_INPUT_STYLE: React.CSSProperties = {
    flex: '0 0 auto',
    width: '100%',
    borderRadius: '10px',
    border: 'none',
    background: 'rgba(12, 15, 22, 0.95)',
    color: '#e7e7e7',
    fontFamily: 'var(--font-ui)',
    fontSize: '10.5px',
    lineHeight: 1.4,
    padding: '9px 36px 9px 20px',
    outline: 'none',
    WebkitTapHighlightColor: 'transparent',
};

const SEARCH_RESULTS_STYLE: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    flex: '1 1 auto',
    minHeight: 0,
    gap: '8px',
    paddingLeft: '10px',
    marginRight: '-16px',
    paddingRight: '16px',
    paddingBottom: '10px',
    overflowY: 'auto',
    overflowX: 'hidden',
};

const SEARCH_SECTION_LABEL_STYLE: React.CSSProperties = {
    color: 'rgba(231, 231, 231, 0.58)',
    fontSize: '8.25px',
    lineHeight: 1.2,
    letterSpacing: '0.35px',
    textTransform: 'none',
    padding: '2px 10px 0',
    fontFamily: 'var(--font-ui)',
};

const SEARCH_RESULT_ROW_STYLE: React.CSSProperties = {
    width: '100%',
    minWidth: 0,
    display: 'block',
    padding: '8px 10px',
    borderRadius: '10px',
    border: 'none',
    background: 'transparent',
    textAlign: 'left',
    cursor: 'pointer',
};

const SEARCH_RESULT_TITLE_STYLE: React.CSSProperties = {
    color: '#f3f7ff',
    fontSize: '10.5px',
    lineHeight: 1.35,
    fontWeight: 600,
    fontFamily: 'var(--font-ui)',
    minWidth: 0,
    maxWidth: '100%',
    width: '100%',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
};

const SEARCH_EMPTY_STYLE: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    color: 'rgba(231, 231, 231, 0.62)',
    fontSize: '13px',
    lineHeight: 1.4,
    padding: '10px 10px',
};

const SEARCH_EMPTY_TITLE_STYLE: React.CSSProperties = {
    color: 'rgba(231, 231, 231, 0.74)',
    fontFamily: 'var(--font-ui)',
    fontSize: '13px',
    lineHeight: 1.35,
};

const SEARCH_EMPTY_HINT_STYLE: React.CSSProperties = {
    color: 'rgba(231, 231, 231, 0.52)',
    fontFamily: 'var(--font-ui)',
    fontSize: '12px',
    lineHeight: 1.35,
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

const ONBOARDING_FULLSCREEN_BUTTON_STYLE: React.CSSProperties = {
    position: 'fixed',
    top: '24px',
    right: '24px',
    zIndex: 1200
};

const WELCOME1_FONT_GATE_BLANK_STYLE: React.CSSProperties = {
    minHeight: '100vh',
    width: '100%',
    background: '#06060A',
};
