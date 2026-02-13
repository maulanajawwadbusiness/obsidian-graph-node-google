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
    LAYER_MODAL_DELETE,
    LAYER_MODAL_FEEDBACK,
    LAYER_MODAL_LOGOUT_CONFIRM,
    LAYER_MODAL_PROFILE,
    LAYER_MODAL_SEARCH,
    LAYER_ONBOARDING_FULLSCREEN_BUTTON,
} from '../ui/layers';
import {
    deleteSavedInterface as deleteSavedInterfaceRemote,
    listSavedInterfaces,
    updateProfile,
    upsertSavedInterface as upsertSavedInterfaceRemote,
} from '../api';
import {
    buildSavedInterfacesStorageKeyForUser,
    DEFAULT_SAVED_INTERFACES_CAP,
    SAVED_INTERFACES_KEY,
    getSavedInterfacesStorageKey,
    loadSavedInterfaces,
    parseSavedInterfaceRecord,
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
const REMOTE_BACKFILL_LIMIT = 10;
const REMOTE_OUTBOX_KEY_PREFIX = `${SAVED_INTERFACES_KEY}_remote_outbox`;
const REMOTE_RETRY_BASE_MS = 30_000;
const REMOTE_RETRY_MAX_MS = 5 * 60_000;
const REMOTE_OUTBOX_PAUSE_401_MS = 60_000;
const PROFILE_DISPLAY_NAME_MAX = 80;
const PROFILE_USERNAME_MAX = 32;
const PROFILE_USERNAME_REGEX = /^[A-Za-z0-9_.-]+$/;
const hydratedStorageKeysSession = new Set<string>();
const backfilledStorageKeysSession = new Set<string>();
let lastIdentityKeySession: string | null = null;
let hasWarnedInvalidStartScreen = false;

type RemoteOutboxOp = 'upsert' | 'delete';

type RemoteOutboxItem = {
    id: string;
    identityKey: string;
    op: RemoteOutboxOp;
    clientInterfaceId: string;
    payload?: SavedInterfaceRecordV1;
    attempt: number;
    nextRetryAt: number;
    createdAt: number;
    lastErrorCode?: string;
    nonRetryable?: boolean;
};

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

function parseIsoMs(value: string | null | undefined): number | null {
    if (!value) return null;
    const ms = Date.parse(value);
    return Number.isFinite(ms) ? ms : null;
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

function canUseBrowserStorage(): boolean {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function buildRemoteOutboxStorageKey(identityKey: string): string {
    return `${REMOTE_OUTBOX_KEY_PREFIX}_${identityKey}`;
}

function parseRemoteOutbox(raw: string | null, identityKey: string): RemoteOutboxItem[] {
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw) as unknown;
        if (!Array.isArray(parsed)) return [];
        const items: RemoteOutboxItem[] = [];
        for (const item of parsed) {
            if (!item || typeof item !== 'object') continue;
            const typed = item as Record<string, unknown>;
            const op = typed.op === 'upsert' || typed.op === 'delete' ? typed.op : null;
            const clientInterfaceId = typeof typed.clientInterfaceId === 'string' ? typed.clientInterfaceId : '';
            if (!op || !clientInterfaceId) continue;
            const nextRetryAt = typeof typed.nextRetryAt === 'number' && Number.isFinite(typed.nextRetryAt)
                ? typed.nextRetryAt
                : Date.now();
            const createdAt = typeof typed.createdAt === 'number' && Number.isFinite(typed.createdAt)
                ? typed.createdAt
                : Date.now();
            const attempt = typeof typed.attempt === 'number' && Number.isFinite(typed.attempt)
                ? Math.max(0, Math.floor(typed.attempt))
                : 0;
            const payload = op === 'upsert' ? parseSavedInterfaceRecord(typed.payload) ?? undefined : undefined;
            items.push({
                id: typeof typed.id === 'string' && typed.id ? typed.id : `${identityKey}:${op}:${clientInterfaceId}:${createdAt}`,
                identityKey,
                op,
                clientInterfaceId,
                payload,
                attempt,
                nextRetryAt,
                createdAt,
                lastErrorCode: typeof typed.lastErrorCode === 'string' ? typed.lastErrorCode : undefined,
                nonRetryable: typed.nonRetryable === true,
            });
        }
        return items;
    } catch {
        return [];
    }
}

function classifyRemoteError(error: unknown): { code: string; retryable: boolean; pauseAuth: boolean } {
    const message = String(error ?? 'unknown');
    const lower = message.toLowerCase();
    if (lower.includes('payload_missing')) {
        return { code: 'payload_missing', retryable: false, pauseAuth: false };
    }
    const codeMatch = message.match(/\b(401|403|413|429|5\d\d)\b/);
    const code = codeMatch?.[1] ?? 'unknown';
    if (code === '401') {
        return { code, retryable: true, pauseAuth: true };
    }
    if (code === '413') {
        return { code, retryable: false, pauseAuth: false };
    }
    if (code === '429') {
        return { code, retryable: true, pauseAuth: false };
    }
    if (code.startsWith('5')) {
        return { code, retryable: true, pauseAuth: false };
    }
    if (lower.includes('timeout') || lower.includes('network') || lower.includes('failed to fetch') || code === 'unknown') {
        return { code: code === 'unknown' ? 'network' : code, retryable: true, pauseAuth: false };
    }
    return { code, retryable: false, pauseAuth: false };
}

function computeRetryDelayMs(attempt: number): number {
    const power = Math.max(0, attempt - 1);
    const base = Math.min(REMOTE_RETRY_MAX_MS, REMOTE_RETRY_BASE_MS * Math.pow(2, power));
    const jitter = Math.floor(base * (0.15 * Math.random()));
    return Math.min(REMOTE_RETRY_MAX_MS, base + jitter);
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
    const { user, loading: authLoading, refreshMe, applyUserPatch, logout } = useAuth();
    const [screen, setScreen] = React.useState<Screen>(() => getInitialScreen());
    const [pendingAnalysis, setPendingAnalysis] = React.useState<PendingAnalysisPayload>(null);
    const [savedInterfaces, setSavedInterfaces] = React.useState<SavedInterfaceRecordV1[]>([]);
    const [pendingLoadInterface, setPendingLoadInterface] = React.useState<SavedInterfaceRecordV1 | null>(null);
    const [isSearchInterfacesOpen, setIsSearchInterfacesOpen] = React.useState(false);
    const [searchInterfacesQuery, setSearchInterfacesQueryState] = React.useState('');
    const [searchHighlightedIndex, setSearchHighlightedIndex] = React.useState(0);
    const [isFeedbackOpen, setIsFeedbackOpen] = React.useState(false);
    const [feedbackDraftMessage, setFeedbackDraftMessage] = React.useState('');
    const [pendingDeleteId, setPendingDeleteId] = React.useState<string | null>(null);
    const [pendingDeleteTitle, setPendingDeleteTitle] = React.useState<string | null>(null);
    const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = React.useState(false);
    const [logoutConfirmBusy, setLogoutConfirmBusy] = React.useState(false);
    const [logoutConfirmError, setLogoutConfirmError] = React.useState<string | null>(null);
    const [isProfileOpen, setIsProfileOpen] = React.useState(false);
    const [profileDraftDisplayName, setProfileDraftDisplayName] = React.useState('');
    const [profileDraftUsername, setProfileDraftUsername] = React.useState('');
    const [profileError, setProfileError] = React.useState<string | null>(null);
    const [profileSaving, setProfileSaving] = React.useState(false);
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
    const restoreReadPathActiveRef = React.useRef(false);
    const authIdentityKeyRef = React.useRef<string>('guest');
    const syncEpochRef = React.useRef(0);
    const prevIdentityKeyRef = React.useRef<string | null>(null);
    const activeStorageKeyRef = React.useRef<string>(getSavedInterfacesStorageKey());
    const hydratedStorageKeyRef = React.useRef<string | null>(null);
    const backfilledStorageKeyRef = React.useRef<string | null>(null);
    const lastSyncedStampByIdRef = React.useRef<Map<string, string>>(new Map());
    const remoteSyncEnabledRef = React.useRef(false);
    const remoteKnownUpdatedAtByIdRef = React.useRef<Map<string, number>>(new Map());
    const remoteOutboxRef = React.useRef<RemoteOutboxItem[]>([]);
    const remoteOutboxStorageKeyRef = React.useRef<string>('');
    const remoteOutboxDrainTimerRef = React.useRef<number | null>(null);
    const remoteOutboxDrainingRef = React.useRef(false);
    const remoteOutboxPausedUntilRef = React.useRef<number>(0);
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
    const loginBlockingActive = screen === 'prompt' && enterPromptOverlayOpen;
    const sidebarDisabled = (screen === 'graph' && graphIsLoading) || loginBlockingActive;
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
    const persistRemoteOutbox = React.useCallback((items: RemoteOutboxItem[]) => {
        if (!canUseBrowserStorage()) return;
        if (!remoteOutboxStorageKeyRef.current) return;
        try {
            window.localStorage.setItem(remoteOutboxStorageKeyRef.current, JSON.stringify(items));
        } catch {
            console.warn('[savedInterfaces] remote_outbox_persist_failed');
        }
    }, []);
    const scheduleRemoteOutboxDrain = React.useCallback((delayMs = 0) => {
        if (remoteOutboxDrainTimerRef.current !== null) {
            window.clearTimeout(remoteOutboxDrainTimerRef.current);
            remoteOutboxDrainTimerRef.current = null;
        }
        if (delayMs < 0) return;
        remoteOutboxDrainTimerRef.current = window.setTimeout(() => {
            remoteOutboxDrainTimerRef.current = null;
            void drainRemoteOutbox();
        }, Math.max(0, Math.floor(delayMs)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const updateRemoteOutbox = React.useCallback((updater: (current: RemoteOutboxItem[]) => RemoteOutboxItem[]) => {
        const next = updater(remoteOutboxRef.current);
        remoteOutboxRef.current = next;
        persistRemoteOutbox(next);
        return next;
    }, [persistRemoteOutbox]);
    const drainRemoteOutbox = React.useCallback(async () => {
        if (remoteOutboxDrainingRef.current) return;
        if (!remoteSyncEnabledRef.current) return;
        if (restoreReadPathActiveRef.current) {
            scheduleRemoteOutboxDrain(1000);
            return;
        }
        const epochAtStart = syncEpochRef.current;
        const identityAtStart = authIdentityKeyRef.current;
        const storageKeyAtStart = remoteOutboxStorageKeyRef.current;
        if (!storageKeyAtStart) return;
        remoteOutboxDrainingRef.current = true;
        try {
            while (true) {
                if (!remoteSyncEnabledRef.current) return;
                if (restoreReadPathActiveRef.current) return;
                if (syncEpochRef.current !== epochAtStart) return;
                if (authIdentityKeyRef.current !== identityAtStart) return;
                if (remoteOutboxStorageKeyRef.current !== storageKeyAtStart) return;
                const now = Date.now();
                if (remoteOutboxPausedUntilRef.current > now) {
                    scheduleRemoteOutboxDrain(remoteOutboxPausedUntilRef.current - now);
                    return;
                }
                const queue = remoteOutboxRef.current
                    .filter((item) => !item.nonRetryable && item.identityKey === identityAtStart)
                    .sort((a, b) => a.nextRetryAt - b.nextRetryAt || a.createdAt - b.createdAt);
                if (queue.length === 0) return;
                const item = queue[0];
                if (item.nextRetryAt > now) {
                    scheduleRemoteOutboxDrain(item.nextRetryAt - now);
                    return;
                }
                try {
                    if (item.op === 'upsert') {
                        if (!item.payload) {
                            throw new Error('payload_missing');
                        }
                        await upsertSavedInterfaceRemote({
                            clientInterfaceId: item.clientInterfaceId,
                            title: item.payload.title,
                            payloadVersion: 1,
                            payloadJson: item.payload,
                        });
                        const stamp = buildSyncStamp(item.payload);
                        lastSyncedStampByIdRef.current.set(item.clientInterfaceId, stamp);
                        remoteKnownUpdatedAtByIdRef.current.set(item.clientInterfaceId, item.payload.updatedAt);
                    } else {
                        await deleteSavedInterfaceRemote(item.clientInterfaceId);
                        lastSyncedStampByIdRef.current.delete(item.clientInterfaceId);
                        remoteKnownUpdatedAtByIdRef.current.delete(item.clientInterfaceId);
                    }
                    updateRemoteOutbox((current) => current.filter((entry) => entry.id !== item.id));
                    console.log('[savedInterfaces] remote_outbox_success op=%s id=%s attempt=%d', item.op, item.clientInterfaceId, item.attempt);
                    continue;
                } catch (error) {
                    const classified = classifyRemoteError(error);
                    if (classified.pauseAuth) {
                        remoteOutboxPausedUntilRef.current = now + REMOTE_OUTBOX_PAUSE_401_MS;
                        updateRemoteOutbox((current) => current.map((entry) => (
                            entry.id === item.id
                                ? { ...entry, attempt: entry.attempt + 1, nextRetryAt: remoteOutboxPausedUntilRef.current, lastErrorCode: classified.code }
                                : entry
                        )));
                        console.log('[savedInterfaces] remote_outbox_paused_401 id=%s', item.clientInterfaceId);
                        scheduleRemoteOutboxDrain(REMOTE_OUTBOX_PAUSE_401_MS);
                        return;
                    }
                    if (!classified.retryable) {
                        updateRemoteOutbox((current) => current.filter((entry) => entry.id !== item.id));
                        if (import.meta.env.DEV) {
                            console.log('[savedInterfaces] remote_outbox_drop_non_retryable op=%s id=%s code=%s', item.op, item.clientInterfaceId, classified.code);
                        }
                        continue;
                    }
                    const nextAttempt = item.attempt + 1;
                    const delayMs = computeRetryDelayMs(nextAttempt);
                    const nextRetryAt = now + delayMs;
                    updateRemoteOutbox((current) => current.map((entry) => (
                        entry.id === item.id
                            ? { ...entry, attempt: nextAttempt, nextRetryAt, lastErrorCode: classified.code }
                            : entry
                    )));
                    console.log('[savedInterfaces] remote_outbox_retry_scheduled op=%s id=%s attempt=%d delay_ms=%d code=%s', item.op, item.clientInterfaceId, nextAttempt, delayMs, classified.code);
                    scheduleRemoteOutboxDrain(delayMs);
                    return;
                }
            }
        } finally {
            remoteOutboxDrainingRef.current = false;
        }
    }, [scheduleRemoteOutboxDrain, updateRemoteOutbox]);
    const enqueueRemoteUpsert = React.useCallback((record: SavedInterfaceRecordV1, reason: string) => {
        if (!remoteSyncEnabledRef.current) return;
        const identityKey = authIdentityKeyRef.current;
        const stamp = buildSyncStamp(record);
        if (lastSyncedStampByIdRef.current.get(record.id) === stamp) return;
        updateRemoteOutbox((current) => {
            const withoutDelete = current.filter((entry) => !(entry.identityKey === identityKey && entry.clientInterfaceId === record.id && entry.op === 'delete'));
            const existingIndex = withoutDelete.findIndex((entry) => entry.identityKey === identityKey && entry.clientInterfaceId === record.id && entry.op === 'upsert');
            const nextItem: RemoteOutboxItem = {
                id: existingIndex >= 0 ? withoutDelete[existingIndex].id : `${identityKey}:upsert:${record.id}:${Date.now()}`,
                identityKey,
                op: 'upsert',
                clientInterfaceId: record.id,
                payload: record,
                attempt: 0,
                nextRetryAt: Date.now(),
                createdAt: existingIndex >= 0 ? withoutDelete[existingIndex].createdAt : Date.now(),
            };
            if (existingIndex >= 0) {
                const next = [...withoutDelete];
                next[existingIndex] = nextItem;
                return next;
            }
            return [...withoutDelete, nextItem];
        });
        console.log('[savedInterfaces] remote_outbox_enqueue op=upsert id=%s reason=%s', record.id, reason);
        scheduleRemoteOutboxDrain(0);
    }, [scheduleRemoteOutboxDrain, updateRemoteOutbox]);
    const enqueueRemoteDelete = React.useCallback((id: string, reason: string) => {
        if (!remoteSyncEnabledRef.current) return;
        const identityKey = authIdentityKeyRef.current;
        updateRemoteOutbox((current) => {
            const filtered = current.filter((entry) => !(entry.identityKey === identityKey && entry.clientInterfaceId === id));
            return [
                ...filtered,
                {
                    id: `${identityKey}:delete:${id}:${Date.now()}`,
                    identityKey,
                    op: 'delete',
                    clientInterfaceId: id,
                    attempt: 0,
                    nextRetryAt: Date.now(),
                    createdAt: Date.now(),
                },
            ];
        });
        console.log('[savedInterfaces] remote_outbox_enqueue op=delete id=%s reason=%s', id, reason);
        scheduleRemoteOutboxDrain(0);
    }, [scheduleRemoteOutboxDrain, updateRemoteOutbox]);
    const commitUpsertInterface = React.useCallback((record: SavedInterfaceRecordV1, reason: string) => {
        if (restoreReadPathActiveRef.current) {
            if (import.meta.env.DEV) {
                console.log('[savedInterfaces] restore_write_blocked op=upsert id=%s reason=%s', record.id, reason);
            }
            return;
        }
        if (reason.startsWith('restore_')) {
            if (import.meta.env.DEV) {
                console.log('[savedInterfaces] restore_write_blocked op=upsert id=%s reason=%s', record.id, reason);
            }
            return;
        }
        const nowMs = Date.now();
        const current = savedInterfacesRef.current;
        const existingIndex = current.findIndex((item) => item.dedupeKey === record.dedupeKey);
        let committed: SavedInterfaceRecordV1;
        let next: SavedInterfaceRecordV1[];
        if (existingIndex >= 0) {
            const existing = current[existingIndex];
            committed = {
                ...record,
                id: existing.id,
                createdAt: existing.createdAt,
                updatedAt: nowMs,
            };
            next = [
                committed,
                ...current.filter((_, index) => index !== existingIndex),
            ];
        } else {
            committed = {
                ...record,
                createdAt: Number.isFinite(record.createdAt) ? record.createdAt : nowMs,
                updatedAt: nowMs,
            };
            next = [committed, ...current];
        }
        applySavedInterfacesState(next);
        enqueueRemoteUpsert(committed, reason);
    }, [applySavedInterfacesState, enqueueRemoteUpsert]);
    const commitPatchLayoutByDocId = React.useCallback((
        docId: string,
        layout: SavedInterfaceRecordV1['layout'],
        camera: SavedInterfaceRecordV1['camera'],
        reason: string
    ) => {
        if (restoreReadPathActiveRef.current) {
            if (import.meta.env.DEV) {
                console.log('[savedInterfaces] restore_write_blocked op=layout_patch docId=%s reason=%s', docId, reason);
            }
            return;
        }
        if (reason.startsWith('restore_')) {
            if (import.meta.env.DEV) {
                console.log('[savedInterfaces] restore_write_blocked op=layout_patch docId=%s reason=%s', docId, reason);
            }
            return;
        }
        if (!docId) return;
        const current = savedInterfacesRef.current;
        const index = current.findIndex((item) => item.docId === docId);
        if (index < 0) {
            if (import.meta.env.DEV) {
                console.log('[savedInterfaces] layout_patch_skipped reason=no_target_docId');
            }
            return;
        }
        const next = [...current];
        const existing = next[index];
        const committed: SavedInterfaceRecordV1 = {
            ...existing,
            layout,
            camera: camera ?? existing.camera,
        };
        next[index] = committed;
        applySavedInterfacesState(next);
        enqueueRemoteUpsert(committed, reason);
    }, [applySavedInterfacesState, enqueueRemoteUpsert]);
    const commitDeleteInterface = React.useCallback((id: string, reason: string) => {
        const current = savedInterfacesRef.current;
        const next = current.filter((item) => item.id !== id);
        applySavedInterfacesState(next);
        setPendingLoadInterface((curr) => (curr?.id === id ? null : curr));
        enqueueRemoteDelete(id, reason);
    }, [applySavedInterfacesState, enqueueRemoteDelete]);
    const commitRenameInterface = React.useCallback((id: string, newTitle: string, reason: string) => {
        const current = savedInterfacesRef.current;
        const index = current.findIndex((item) => item.id === id);
        if (index < 0) {
            if (import.meta.env.DEV) {
                console.log('[savedInterfaces] title_patch_skipped reason=not_found');
            }
            return;
        }
        const next = [...current];
        const existing = next[index];
        const committed: SavedInterfaceRecordV1 = {
            ...existing,
            title: newTitle,
        };
        next[index] = committed;
        applySavedInterfacesState(next);
        enqueueRemoteUpsert(committed, reason);
    }, [applySavedInterfacesState, enqueueRemoteUpsert]);
    const commitHydrateMerge = React.useCallback((merged: SavedInterfaceRecordV1[]) => {
        return applySavedInterfacesState(merged);
    }, [applySavedInterfacesState]);
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
        commitDeleteInterface(deletedId, 'sidebar_delete');
        console.log('[appshell] delete_interface_ok id=%s', deletedId);
        closeDeleteConfirm();
    }, [closeDeleteConfirm, commitDeleteInterface, pendingDeleteId]);
    const handleRenameInterface = React.useCallback((id: string, newTitle: string) => {
        commitRenameInterface(id, newTitle, 'sidebar_rename');
    }, [commitRenameInterface]);
    const closeFeedbackModal = React.useCallback(() => {
        setIsFeedbackOpen(false);
        setFeedbackDraftMessage('');
    }, []);
    const closeProfileOverlay = React.useCallback(() => {
        if (profileSaving) return;
        setIsProfileOpen(false);
        setProfileError(null);
    }, [profileSaving]);
    const closeLogoutConfirm = React.useCallback(() => {
        if (logoutConfirmBusy) return;
        setIsLogoutConfirmOpen(false);
        setLogoutConfirmError(null);
    }, [logoutConfirmBusy]);
    const openLogoutConfirm = React.useCallback(() => {
        if (!isLoggedIn) return;
        if (sidebarDisabled) return;
        if (isFeedbackOpen) {
            closeFeedbackModal();
        }
        if (isSearchInterfacesOpen) {
            closeSearchInterfaces();
        }
        if (pendingDeleteId) {
            closeDeleteConfirm();
        }
        if (isProfileOpen) {
            closeProfileOverlay();
        }
        setLogoutConfirmError(null);
        setIsLogoutConfirmOpen(true);
    }, [
        closeDeleteConfirm,
        closeFeedbackModal,
        closeProfileOverlay,
        closeSearchInterfaces,
        isFeedbackOpen,
        isLoggedIn,
        isProfileOpen,
        isSearchInterfacesOpen,
        pendingDeleteId,
        sidebarDisabled
    ]);
    const confirmLogout = React.useCallback(async () => {
        if (logoutConfirmBusy) return;
        setLogoutConfirmBusy(true);
        setLogoutConfirmError(null);
        try {
            await logout();
            setIsLogoutConfirmOpen(false);
            setLogoutConfirmError(null);
        } catch (error) {
            setLogoutConfirmError('Failed to log out. Please try again.');
            if (import.meta.env.DEV) {
                console.warn('[appshell] logout_confirm_failed error=%s', String(error));
            }
        } finally {
            setLogoutConfirmBusy(false);
        }
    }, [logout, logoutConfirmBusy]);
    const openProfileOverlay = React.useCallback(() => {
        if (!isLoggedIn || !user) return;
        if (sidebarDisabled) return;
        if (isFeedbackOpen) {
            closeFeedbackModal();
        }
        if (isSearchInterfacesOpen) {
            closeSearchInterfaces();
        }
        if (pendingDeleteId) {
            closeDeleteConfirm();
        }
        const nextDisplayName = typeof user?.displayName === 'string' && user.displayName.trim()
            ? user.displayName.trim()
            : (typeof user?.name === 'string' && user.name.trim() ? user.name.trim() : '');
        const nextUsername = typeof user?.username === 'string' && user.username.trim() ? user.username.trim() : '';
        setProfileDraftDisplayName(nextDisplayName);
        setProfileDraftUsername(nextUsername);
        setProfileError(null);
        setIsProfileOpen(true);
    }, [closeDeleteConfirm, closeFeedbackModal, closeSearchInterfaces, isFeedbackOpen, isLoggedIn, isSearchInterfacesOpen, pendingDeleteId, sidebarDisabled, user]);
    const openFeedbackModal = React.useCallback(() => {
        if (!isLoggedIn) return;
        if (sidebarDisabled) {
            if (import.meta.env.DEV) {
                console.log('[appshell] feedback_open_blocked reason=sidebar_disabled');
            }
            return;
        }
        if (isProfileOpen || isLogoutConfirmOpen) {
            if (import.meta.env.DEV) {
                console.log('[appshell] feedback_open_blocked reason=modal_conflict');
            }
            return;
        }
        if (isSearchInterfacesOpen) {
            closeSearchInterfaces();
        }
        if (pendingDeleteId) {
            closeDeleteConfirm();
        }
        setIsFeedbackOpen(true);
    }, [
        closeDeleteConfirm,
        closeSearchInterfaces,
        isLoggedIn,
        isLogoutConfirmOpen,
        isProfileOpen,
        isSearchInterfacesOpen,
        pendingDeleteId,
        sidebarDisabled
    ]);
    const onProfileSave = React.useCallback(async () => {
        if (profileSaving) return;
        const displayName = profileDraftDisplayName.replace(/\s+/g, ' ').trim();
        const username = profileDraftUsername.trim();

        if (displayName.length > PROFILE_DISPLAY_NAME_MAX) {
            setProfileError(`Display Name max length is ${PROFILE_DISPLAY_NAME_MAX}.`);
            return;
        }
        if (username.length > PROFILE_USERNAME_MAX) {
            setProfileError(`Username max length is ${PROFILE_USERNAME_MAX}.`);
            return;
        }
        if (username.length > 0 && !PROFILE_USERNAME_REGEX.test(username)) {
            setProfileError('Username may only contain letters, numbers, dot, underscore, and dash.');
            return;
        }

        setProfileSaving(true);
        setProfileError(null);
        try {
            const updatedUser = await updateProfile({ displayName, username });
            applyUserPatch(updatedUser);
            setIsProfileOpen(false);
            void refreshMe().catch((error) => {
                if (import.meta.env.DEV) {
                    console.warn('[appshell] profile_refresh_after_save_failed error=%s', String(error));
                }
            });
        } catch (error) {
            setProfileError('Failed to save profile. Please try again.');
            if (import.meta.env.DEV) {
                console.warn('[appshell] profile_save_failed error=%s', String(error));
            }
        } finally {
            setProfileSaving(false);
        }
    }, [applyUserPatch, profileDraftDisplayName, profileDraftUsername, profileSaving, refreshMe]);

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

    React.useEffect(() => {
        if (!isFeedbackOpen) return;
        if (!sidebarDisabled) return;
        closeFeedbackModal();
    }, [closeFeedbackModal, isFeedbackOpen, sidebarDisabled]);

    React.useEffect(() => {
        if (!isFeedbackOpen) return;
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return;
            event.stopPropagation();
            closeFeedbackModal();
        };
        window.addEventListener('keydown', onKeyDown, true);
        return () => {
            window.removeEventListener('keydown', onKeyDown, true);
        };
    }, [closeFeedbackModal, isFeedbackOpen]);

    React.useEffect(() => {
        savedInterfacesRef.current = savedInterfaces;
    }, [savedInterfaces]);

    React.useEffect(() => {
        remoteSyncEnabledRef.current = isLoggedIn;
        if (!isLoggedIn) {
            scheduleRemoteOutboxDrain(-1);
            return;
        }
        remoteOutboxPausedUntilRef.current = 0;
        scheduleRemoteOutboxDrain(0);
    }, [isLoggedIn, scheduleRemoteOutboxDrain]);

    React.useEffect(() => {
        const onOnline = () => {
            remoteOutboxPausedUntilRef.current = 0;
            scheduleRemoteOutboxDrain(0);
        };
        window.addEventListener('online', onOnline);
        return () => {
            window.removeEventListener('online', onOnline);
        };
    }, [scheduleRemoteOutboxDrain]);

    React.useEffect(() => {
        return () => {
            scheduleRemoteOutboxDrain(-1);
        };
    }, [scheduleRemoteOutboxDrain]);

    React.useEffect(() => {
        if (!authIdentityKey) return;
        if (prevIdentityKeyRef.current === authIdentityKey) return;
        prevIdentityKeyRef.current = authIdentityKey;
        authIdentityKeyRef.current = authIdentityKey;
        syncEpochRef.current += 1;
        remoteSyncEnabledRef.current = isLoggedIn;

        const nextStorageKey = isLoggedIn && authStorageId
            ? buildSavedInterfacesStorageKeyForUser(authStorageId)
            : SAVED_INTERFACES_KEY;
        if (lastIdentityKeySession !== authIdentityKey) {
            lastIdentityKeySession = authIdentityKey;
            hydratedStorageKeysSession.delete(nextStorageKey);
            backfilledStorageKeysSession.delete(nextStorageKey);
        }
        if (activeStorageKeyRef.current !== nextStorageKey) {
            setSavedInterfacesStorageKey(nextStorageKey);
            activeStorageKeyRef.current = nextStorageKey;
        }
        remoteOutboxStorageKeyRef.current = buildRemoteOutboxStorageKey(authIdentityKey);
        if (canUseBrowserStorage()) {
            const rawOutbox = window.localStorage.getItem(remoteOutboxStorageKeyRef.current);
            remoteOutboxRef.current = parseRemoteOutbox(rawOutbox, authIdentityKey);
        } else {
            remoteOutboxRef.current = [];
        }
        remoteOutboxPausedUntilRef.current = 0;
        scheduleRemoteOutboxDrain(isLoggedIn ? 0 : -1);
        hydratedStorageKeyRef.current = null;
        backfilledStorageKeyRef.current = null;
        lastSyncedStampByIdRef.current.clear();
        remoteKnownUpdatedAtByIdRef.current.clear();
        setPendingLoadInterface(null);
        setPendingAnalysis(null);
        closeDeleteConfirm();
        didSelectThisOpenRef.current = false;
        setIsSearchInterfacesOpen(false);
        setSearchInterfacesQueryState('');
        setSearchHighlightedIndex(0);
        setSearchInputFocused(false);
        refreshSavedInterfaces();
        console.log('[savedInterfaces] identity_switched identity=%s key=%s', authIdentityKey, nextStorageKey);
    }, [authIdentityKey, authStorageId, closeDeleteConfirm, isLoggedIn, refreshSavedInterfaces, scheduleRemoteOutboxDrain]);

    React.useEffect(() => {
        refreshSavedInterfaces();
    }, [refreshSavedInterfaces]);

    React.useEffect(() => {
        if (!isAuthReady || !isLoggedIn) return;
        const storageKey = activeStorageKeyRef.current;
        if (!storageKey) return;
        if (hydratedStorageKeyRef.current === storageKey || hydratedStorageKeysSession.has(storageKey)) return;
        hydratedStorageKeyRef.current = storageKey;
        hydratedStorageKeysSession.add(storageKey);

        let cancelled = false;
        const epochAtStart = syncEpochRef.current;
        const identityAtStart = authIdentityKeyRef.current;
        void (async () => {
            try {
                const localRecords = loadSavedInterfaces();
                const remoteItems = await listSavedInterfaces();
                if (cancelled) return;
                if (syncEpochRef.current !== epochAtStart) return;
                if (authIdentityKeyRef.current !== identityAtStart) return;
                if (activeStorageKeyRef.current !== storageKey) return;

                const remoteRecords: SavedInterfaceRecordV1[] = [];
                const remoteById = new Map<string, SavedInterfaceRecordV1>();
                for (const item of remoteItems) {
                    // Ordering truth is payloadJson.updatedAt, not DB row updated_at.
                    // DB upsert updates row timestamp on rename, which would reorder unexpectedly.
                    const parsed = parseSavedInterfaceRecord(item.payloadJson);
                    if (!parsed) {
                        console.warn('[savedInterfaces] remote_payload_invalid_skipped id=%s', item.clientInterfaceId);
                        continue;
                    }
                    if (import.meta.env.DEV) {
                        const dbUpdatedAtMs = parseIsoMs(item.dbUpdatedAt);
                        if (dbUpdatedAtMs !== null && Math.abs(dbUpdatedAtMs - parsed.updatedAt) > 1000) {
                            console.log(
                                '[savedInterfaces] db_ts_diverges_ignored id=%s db_updated_at=%d payload_updatedAt=%d',
                                parsed.id,
                                dbUpdatedAtMs,
                                parsed.updatedAt
                            );
                        }
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
                const reloaded = commitHydrateMerge(merged);
                if (cancelled) return;
                if (syncEpochRef.current !== epochAtStart) return;
                if (authIdentityKeyRef.current !== identityAtStart) return;
                if (activeStorageKeyRef.current !== storageKey) return;
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
                        enqueueRemoteUpsert(record, 'login_backfill');
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
    }, [commitHydrateMerge, enqueueRemoteUpsert, isAuthReady, isLoggedIn]);

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
                    onRestoreReadPathChange={(active) => {
                        restoreReadPathActiveRef.current = active;
                    }}
                    onSavedInterfaceUpsert={(record, reason) => commitUpsertInterface(record, reason)}
                    onSavedInterfaceLayoutPatch={(docId, layout, camera, reason) =>
                        commitPatchLayoutByDocId(docId, layout, camera, reason)
                    }
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
                    accountName={sidebarAccountName}
                    accountImageUrl={sidebarAccountImageUrl}
                    onOpenProfile={isLoggedIn ? openProfileOverlay : undefined}
                    onRequestLogout={isLoggedIn ? openLogoutConfirm : undefined}
                    onOpenFeedback={isLoggedIn ? openFeedbackModal : undefined}
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
            {isProfileOpen ? (
                <div
                    {...hardShieldInput}
                    data-profile-backdrop="1"
                    style={PROFILE_OVERLAY_BACKDROP_STYLE}
                    onClick={(e) => {
                        e.stopPropagation();
                        closeProfileOverlay();
                    }}
                >
                    <div
                        {...hardShieldInput}
                        data-profile-modal="1"
                        style={PROFILE_OVERLAY_CARD_STYLE}
                    >
                        <div style={PROFILE_TITLE_STYLE}>Profile</div>
                        <div style={PROFILE_AVATAR_ROW_STYLE}>
                            {sidebarAccountImageUrl ? (
                                <img src={sidebarAccountImageUrl} alt="avatar" style={PROFILE_AVATAR_IMAGE_STYLE} />
                            ) : (
                                <div style={PROFILE_AVATAR_FALLBACK_STYLE}>BA</div>
                            )}
                        </div>
                        <label style={PROFILE_FIELD_STYLE}>
                            <span style={PROFILE_LABEL_STYLE}>Display Name</span>
                            <input
                                {...hardShieldInput}
                                type="text"
                                value={profileDraftDisplayName}
                                disabled={profileSaving}
                                onChange={(e) => {
                                    setProfileDraftDisplayName(e.target.value);
                                    setProfileError(null);
                                }}
                                placeholder="Display Name"
                                style={PROFILE_INPUT_STYLE}
                            />
                        </label>
                        <label style={PROFILE_FIELD_STYLE}>
                            <span style={PROFILE_LABEL_STYLE}>Username</span>
                            <input
                                {...hardShieldInput}
                                className="profile-username-input"
                                type="text"
                                value={profileDraftUsername}
                                disabled={profileSaving}
                                onChange={(e) => {
                                    setProfileDraftUsername(e.target.value);
                                    setProfileError(null);
                                }}
                                placeholder="Username"
                                style={PROFILE_INPUT_STYLE}
                            />
                        </label>
                        {profileError ? <div style={PROFILE_ERROR_STYLE}>{profileError}</div> : null}
                        <div style={PROFILE_BUTTON_ROW_STYLE}>
                            <button
                                {...hardShieldInput}
                                type="button"
                                style={PROFILE_CANCEL_STYLE}
                                disabled={profileSaving}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    closeProfileOverlay();
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                {...hardShieldInput}
                                type="button"
                                style={{
                                    ...PROFILE_PRIMARY_STYLE,
                                    opacity: profileSaving ? 0.75 : 1,
                                }}
                                disabled={profileSaving}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    void onProfileSave();
                                }}
                            >
                                {profileSaving ? 'Saving...' : 'Save'}
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
            {isLogoutConfirmOpen ? (
                <div
                    {...hardShieldInput}
                    data-logout-confirm-backdrop="1"
                    style={LOGOUT_CONFIRM_BACKDROP_STYLE}
                    onClick={(e) => {
                        e.stopPropagation();
                        closeLogoutConfirm();
                    }}
                >
                    <div
                        {...hardShieldInput}
                        data-logout-confirm-modal="1"
                        style={LOGOUT_CONFIRM_CARD_STYLE}
                    >
                        <div style={LOGOUT_CONFIRM_TITLE_STYLE}>Log out?</div>
                        <div style={LOGOUT_CONFIRM_TEXT_STYLE}>
                            You will be signed out from this account on this device.
                        </div>
                        {logoutConfirmError ? <div style={LOGOUT_CONFIRM_ERROR_STYLE}>{logoutConfirmError}</div> : null}
                        <div style={LOGOUT_CONFIRM_BUTTON_ROW_STYLE}>
                            <button
                                {...hardShieldInput}
                                type="button"
                                style={LOGOUT_CONFIRM_CANCEL_STYLE}
                                disabled={logoutConfirmBusy}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    closeLogoutConfirm();
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                {...hardShieldInput}
                                type="button"
                                style={{
                                    ...LOGOUT_CONFIRM_PRIMARY_STYLE,
                                    opacity: logoutConfirmBusy ? 0.75 : 1,
                                }}
                                disabled={logoutConfirmBusy}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    void confirmLogout();
                                }}
                            >
                                {logoutConfirmBusy ? 'Logging out...' : 'Log Out'}
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
            {isFeedbackOpen ? (
                <div
                    {...hardShieldInput}
                    data-feedback-backdrop="1"
                    style={FEEDBACK_OVERLAY_BACKDROP_STYLE}
                    onClick={(e) => {
                        e.stopPropagation();
                        closeFeedbackModal();
                    }}
                >
                    <div
                        {...hardShieldInput}
                        data-feedback-modal="1"
                        style={FEEDBACK_OVERLAY_CARD_STYLE}
                    >
                        <div style={FEEDBACK_TITLE_STYLE}>Suggestion and Feedback</div>
                        <div {...hardShieldInput} style={FEEDBACK_BODY_STYLE}>
                            <textarea
                                {...hardShieldInput}
                                value={feedbackDraftMessage}
                                placeholder="Tell us what can be improved..."
                                onChange={(e) => setFeedbackDraftMessage(e.target.value)}
                                style={FEEDBACK_TEXTAREA_STYLE}
                            />
                        </div>
                        <div style={FEEDBACK_BUTTON_ROW_STYLE}>
                            <button
                                {...hardShieldInput}
                                type="button"
                                style={FEEDBACK_CANCEL_STYLE}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    closeFeedbackModal();
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                {...hardShieldInput}
                                type="button"
                                disabled
                                style={FEEDBACK_SEND_STYLE}
                                onClick={(e) => {
                                    e.stopPropagation();
                                }}
                            >
                                Send
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
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

const PROFILE_OVERLAY_BACKDROP_STYLE: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(6, 8, 12, 0.64)',
    zIndex: LAYER_MODAL_PROFILE,
    pointerEvents: 'auto',
};

const PROFILE_OVERLAY_CARD_STYLE: React.CSSProperties = {
    width: '100%',
    maxWidth: '300px',
    margin: '0 16px',
    borderRadius: '12px',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    background: '#0d0d18',
    boxShadow: '0 18px 56px rgba(0, 0, 0, 0.45)',
    padding: '20px 15px',
    color: '#f1f4fb',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
};

const PROFILE_TITLE_STYLE: React.CSSProperties = {
    fontFamily: 'var(--font-ui)',
    fontWeight: 400,
    fontSize: '14px',
    lineHeight: 1.2,
    color: '#f3f7ff',
};

const PROFILE_AVATAR_ROW_STYLE: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'center',
    padding: '4px 0 2px',
};

const PROFILE_AVATAR_IMAGE_STYLE: React.CSSProperties = {
    width: '65px',
    height: '65px',
    borderRadius: '50%',
    objectFit: 'cover',
    display: 'block',
};

const PROFILE_AVATAR_FALLBACK_STYLE: React.CSSProperties = {
    width: '65px',
    height: '65px',
    borderRadius: '50%',
    background: '#2dd4bf',
    color: '#000',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'var(--font-ui)',
    fontWeight: 300,
    fontSize: '12px',
};

const PROFILE_FIELD_STYLE: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
};

const PROFILE_LABEL_STYLE: React.CSSProperties = {
    fontSize: '12px',
    lineHeight: 1.2,
    color: '#ffffff',
    fontFamily: 'var(--font-ui)',
    fontWeight: 300,
};

const PROFILE_INPUT_STYLE: React.CSSProperties = {
    width: '100%',
    borderRadius: '10px',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    background: 'rgba(12, 15, 22, 0.95)',
    color: '#ffffff',
    fontFamily: 'var(--font-ui)',
    fontWeight: 300,
    fontSize: '13px',
    lineHeight: 1.4,
    padding: '9px 10px',
    outline: 'none',
    boxSizing: 'border-box',
};

const PROFILE_ERROR_STYLE: React.CSSProperties = {
    fontSize: '12px',
    color: '#ff6b6b',
    fontFamily: 'var(--font-ui)',
    fontWeight: 300,
};

const PROFILE_BUTTON_ROW_STYLE: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '8px',
    marginTop: '2px',
};

const PROFILE_CANCEL_STYLE: React.CSSProperties = {
    border: '1px solid rgba(255, 255, 255, 0.24)',
    background: 'rgba(255, 255, 255, 0.04)',
    color: '#f1f4fb',
    borderRadius: '7px',
    padding: '7px 12px',
    fontSize: '12px',
    cursor: 'pointer',
    fontWeight: 300,
    fontFamily: 'var(--font-ui)',
};

const PROFILE_PRIMARY_STYLE: React.CSSProperties = {
    border: '1px solid #63abff',
    background: '#63abff',
    color: '#0b1220',
    borderRadius: '7px',
    padding: '7px 12px',
    fontSize: '12px',
    cursor: 'pointer',
    fontWeight: 300,
    fontFamily: 'var(--font-ui)',
};

const LOGOUT_CONFIRM_BACKDROP_STYLE: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(6, 8, 12, 0.64)',
    zIndex: LAYER_MODAL_LOGOUT_CONFIRM,
    pointerEvents: 'auto',
};

const LOGOUT_CONFIRM_CARD_STYLE: React.CSSProperties = {
    width: '100%',
    maxWidth: '360px',
    margin: '0 16px',
    borderRadius: '12px',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    background: '#0d0d18',
    boxShadow: '0 18px 56px rgba(0, 0, 0, 0.45)',
    padding: '18px',
    color: '#f1f4fb',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
};

const LOGOUT_CONFIRM_TITLE_STYLE: React.CSSProperties = {
    fontFamily: 'var(--font-ui)',
    fontWeight: 300,
    fontSize: '16px',
    lineHeight: 1.2,
    color: '#f3f7ff',
};

const LOGOUT_CONFIRM_TEXT_STYLE: React.CSSProperties = {
    fontFamily: 'var(--font-ui)',
    fontWeight: 300,
    fontSize: '12px',
    lineHeight: 1.5,
    color: 'rgba(231, 231, 231, 0.74)',
};

const LOGOUT_CONFIRM_ERROR_STYLE: React.CSSProperties = {
    fontFamily: 'var(--font-ui)',
    fontWeight: 300,
    fontSize: '12px',
    lineHeight: 1.4,
    color: '#ff6b6b',
};

const LOGOUT_CONFIRM_BUTTON_ROW_STYLE: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '8px',
    marginTop: '2px',
};

const LOGOUT_CONFIRM_CANCEL_STYLE: React.CSSProperties = {
    border: '1px solid rgba(255, 255, 255, 0.24)',
    background: 'rgba(255, 255, 255, 0.04)',
    color: '#f1f4fb',
    borderRadius: '7px',
    padding: '7px 12px',
    fontSize: '12px',
    cursor: 'pointer',
    fontWeight: 300,
    fontFamily: 'var(--font-ui)',
};

const LOGOUT_CONFIRM_PRIMARY_STYLE: React.CSSProperties = {
    border: '1px solid #ff4b4e',
    background: '#ff4b4e',
    color: '#ffffff',
    borderRadius: '7px',
    padding: '7px 12px',
    fontSize: '12px',
    cursor: 'pointer',
    fontWeight: 300,
    fontFamily: 'var(--font-ui)',
};

const FEEDBACK_OVERLAY_BACKDROP_STYLE: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '16px',
    boxSizing: 'border-box',
    background: 'rgba(6, 8, 12, 0.62)',
    zIndex: LAYER_MODAL_FEEDBACK,
    pointerEvents: 'auto',
};

const FEEDBACK_OVERLAY_CARD_STYLE: React.CSSProperties = {
    width: 'min(560px, calc(100vw - 32px))',
    height: 'min(360px, calc(100vh - 64px))',
    maxHeight: 'calc(100vh - 64px)',
    borderRadius: '12px',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    background: '#0d0d18',
    boxShadow: '0 18px 56px rgba(0, 0, 0, 0.45)',
    padding: '16px',
    boxSizing: 'border-box',
    color: '#f1f4fb',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    overflow: 'hidden',
};

const FEEDBACK_TITLE_STYLE: React.CSSProperties = {
    fontFamily: 'var(--font-ui)',
    fontSize: '14px',
    lineHeight: 1.2,
    color: '#f3f7ff',
};

const FEEDBACK_BODY_STYLE: React.CSSProperties = {
    flex: 1,
    minHeight: 0,
    display: 'flex',
};

const FEEDBACK_TEXTAREA_STYLE: React.CSSProperties = {
    width: '100%',
    height: '100%',
    resize: 'none',
    borderRadius: '10px',
    border: '1px solid rgba(255, 255, 255, 0.14)',
    background: 'rgba(10, 12, 18, 0.95)',
    color: '#e7e7e7',
    fontFamily: 'var(--font-ui)',
    fontSize: '13px',
    lineHeight: 1.35,
    padding: '10px 12px',
    boxSizing: 'border-box',
    outline: 'none',
};

const FEEDBACK_BUTTON_ROW_STYLE: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '8px',
};

const FEEDBACK_CANCEL_STYLE: React.CSSProperties = {
    border: '1px solid rgba(255, 255, 255, 0.22)',
    background: 'transparent',
    color: '#e7e7e7',
    borderRadius: '7px',
    padding: '7px 12px',
    fontSize: '12px',
    cursor: 'pointer',
    fontWeight: 300,
    fontFamily: 'var(--font-ui)',
};

const FEEDBACK_SEND_STYLE: React.CSSProperties = {
    border: '1px solid rgba(99, 171, 255, 0.4)',
    background: 'rgba(99, 171, 255, 0.2)',
    color: '#d7f5ff',
    borderRadius: '7px',
    padding: '7px 12px',
    fontSize: '12px',
    cursor: 'not-allowed',
    opacity: 0.7,
    fontWeight: 300,
    fontFamily: 'var(--font-ui)',
};

const DELETE_CONFIRM_BACKDROP_STYLE: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(6, 8, 12, 0.64)',
    zIndex: LAYER_MODAL_DELETE,
    pointerEvents: 'auto',
};

const DELETE_CONFIRM_CARD_STYLE: React.CSSProperties = {
    width: '100%',
    maxWidth: '420px',
    margin: '0 16px',
    borderRadius: '11.9px',
    border: 'none',
    background: '#0d0d18',
    boxShadow: '0 18px 56px rgba(0, 0, 0, 0.45)',
    padding: '20px',
    color: '#06060A',
    fontWeight: 300,
    display: 'flex',
    flexDirection: 'column',
    gap: '8.5px',
};

const DELETE_CONFIRM_TITLE_STYLE: React.CSSProperties = {
    fontSize: '11.9px',
    lineHeight: 1.25,
    fontWeight: 300,
    color: '#f3f7ff',
};

const DELETE_CONFIRM_TEXT_STYLE: React.CSSProperties = {
    fontSize: '11.9px',
    lineHeight: 1.5,
    color: 'rgba(231, 231, 231, 0.7)',
};

const DELETE_CONFIRM_BUTTON_ROW_STYLE: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '6.8px',
    marginTop: '3.4px',
};

const DELETE_CONFIRM_CANCEL_STYLE: React.CSSProperties = {
    border: '1px solid rgba(255, 255, 255, 0.26)',
    background: 'rgba(255, 255, 255, 0.04)',
    color: '#f1f4fb',
    borderRadius: '6.8px',
    padding: '6.8px 11.9px',
    fontSize: '11.9px',
    cursor: 'pointer',
    fontWeight: 300,
};

const DELETE_CONFIRM_PRIMARY_STYLE: React.CSSProperties = {
    border: '1px solid #ff4b4e',
    background: '#ff4b4e',
    color: '#ffffff',
    borderRadius: '6.8px',
    padding: '6.8px 11.9px',
    fontSize: '11.9px',
    cursor: 'pointer',
    fontWeight: 300,
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
    zIndex: LAYER_MODAL_SEARCH,
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
    background: '#0d0d18',
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
    fontWeight: 300,
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
    fontWeight: 300,
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
    fontWeight: 300,
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
    fontWeight: 300,
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
    fontFamily: 'var(--font-ui)',
    fontWeight: 300,
};

const SEARCH_EMPTY_TITLE_STYLE: React.CSSProperties = {
    color: 'rgba(231, 231, 231, 0.74)',
    fontFamily: 'var(--font-ui)',
    fontWeight: 300,
    fontSize: '13px',
    lineHeight: 1.35,
};

const SEARCH_EMPTY_HINT_STYLE: React.CSSProperties = {
    color: 'rgba(231, 231, 231, 0.52)',
    fontFamily: 'var(--font-ui)',
    fontWeight: 300,
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
    zIndex: LAYER_ONBOARDING_FULLSCREEN_BUTTON
};

const WELCOME1_FONT_GATE_BLANK_STYLE: React.CSSProperties = {
    minHeight: '100vh',
    width: '100%',
    background: '#06060A',
};
