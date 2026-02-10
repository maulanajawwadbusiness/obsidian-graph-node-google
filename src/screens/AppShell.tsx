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
import {
    deleteSavedInterface,
    loadSavedInterfaces,
    patchSavedInterfaceTitle,
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
const SEARCH_RECENT_LIMIT = 20;
const SEARCH_RESULT_LIMIT = 20;
let hasWarnedInvalidStartScreen = false;

type SearchInterfaceIndexItem = {
    id: string;
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
    const searchInputRef = React.useRef<HTMLInputElement | null>(null);
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
        setSavedInterfaces(loadSavedInterfaces());
    }, []);
    const handleInterfaceSaved = React.useCallback(() => {
        refreshSavedInterfaces();
    }, [refreshSavedInterfaces]);
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
        setIsSearchInterfacesOpen(true);
        setSearchInterfacesQuery('');
        setSearchHighlightedIndex(0);
        console.log('[appshell] search_open');
    }, [pendingDeleteId, setSearchInterfacesQuery, sidebarDisabled]);
    const closeSearchInterfaces = React.useCallback(() => {
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
        deleteSavedInterface(deletedId);
        refreshSavedInterfaces();
        setPendingLoadInterface((curr) => (curr?.id === deletedId ? null : curr));
        console.log('[appshell] delete_interface_ok id=%s', deletedId);
        closeDeleteConfirm();
    }, [closeDeleteConfirm, pendingDeleteId, refreshSavedInterfaces]);

    React.useEffect(() => {
        if (!isSearchInterfacesOpen) return;
        if (!pendingDeleteId) return;
        closeSearchInterfaces();
    }, [closeSearchInterfaces, isSearchInterfacesOpen, pendingDeleteId]);

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
        refreshSavedInterfaces();
    }, [refreshSavedInterfaces]);

    React.useEffect(() => {
        if (screen !== 'graph') return;
        refreshSavedInterfaces();
    }, [screen, refreshSavedInterfaces]);

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
        () => savedInterfaces.map((record) => ({
            id: record.id,
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
        const scored: Array<{ item: SearchInterfaceIndexItem; score: number }> = [];
        for (const item of searchIndex) {
            let score = 0;
            let allMatched = true;
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
                    score += 500;
                } else {
                    score += Math.max(1, 200 - idx);
                }
            }
            if (!allMatched) continue;
            score -= Math.abs(item.normalizedTitle.length - normalizedQuery.length);
            scored.push({ item, score });
        }
        scored.sort((a, b) => {
            if (a.score !== b.score) return b.score - a.score;
            return b.item.updatedAt - a.item.updatedAt;
        });
        return scored.slice(0, SEARCH_RESULT_LIMIT).map((entry) => entry.item);
    }, [searchIndex, searchInterfacesQuery]);

    React.useEffect(() => {
        if (searchHighlightedIndex < filteredSearchResults.length) return;
        setSearchHighlightedIndex(filteredSearchResults.length > 0 ? filteredSearchResults.length - 1 : 0);
    }, [filteredSearchResults.length, searchHighlightedIndex]);

    const selectSearchResultById = React.useCallback((id: string) => {
        closeSearchInterfaces();
        selectSavedInterfaceById(id);
    }, [closeSearchInterfaces, selectSavedInterfaceById]);

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
                    onRenameInterface={(id, newTitle) => {
                        patchSavedInterfaceTitle(id, newTitle);
                        refreshSavedInterfaces();
                    }}
                    onDeleteInterface={(id) => {
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
                        style={SEARCH_OVERLAY_CARD_STYLE}
                        onKeyDown={(e) => {
                            e.stopPropagation();
                            if (e.key !== 'Escape') return;
                            e.preventDefault();
                            closeSearchInterfaces();
                        }}
                    >
                        <div style={SEARCH_HEADER_ROW_STYLE}>
                            <span style={SEARCH_HEADER_TITLE_STYLE}>Search Interfaces</span>
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
                        </div>
                        <input
                            {...hardShieldInput}
                            ref={searchInputRef}
                            autoFocus
                            value={searchInterfacesQuery}
                            placeholder="Search saved interfaces..."
                            style={SEARCH_INPUT_STYLE}
                            onChange={(e) => setSearchInterfacesQuery(e.target.value)}
                            onKeyDown={(e) => {
                                e.stopPropagation();
                                if (e.key === 'Escape') {
                                    e.preventDefault();
                                    closeSearchInterfaces();
                                    return;
                                }
                                if (e.key === 'Enter') {
                                    const picked = filteredSearchResults[searchHighlightedIndex] ?? filteredSearchResults[0];
                                    if (!picked) return;
                                    e.preventDefault();
                                    selectSearchResultById(picked.id);
                                    return;
                                }
                                if (e.key === 'ArrowDown') {
                                    e.preventDefault();
                                    setSearchHighlightedIndex((curr) => {
                                        if (filteredSearchResults.length === 0) return 0;
                                        return Math.min(filteredSearchResults.length - 1, curr + 1);
                                    });
                                    return;
                                }
                                if (e.key === 'ArrowUp') {
                                    e.preventDefault();
                                    setSearchHighlightedIndex((curr) => Math.max(0, curr - 1));
                                }
                            }}
                        />
                        <div
                            {...hardShieldInput}
                            data-search-interfaces-results="1"
                            style={SEARCH_RESULTS_STYLE}
                        >
                            {normalizeSearchText(searchInterfacesQuery).length === 0 ? (
                                <div style={SEARCH_SECTION_LABEL_STYLE}>Recent</div>
                            ) : null}
                            {filteredSearchResults.length === 0 ? (
                                <div style={SEARCH_EMPTY_STYLE}>No matching interfaces.</div>
                            ) : (
                                filteredSearchResults.map((item, index) => {
                                    const isHighlighted = index === searchHighlightedIndex;
                                    return (
                                        <button
                                            {...hardShieldInput}
                                            key={item.id}
                                            type="button"
                                            style={{
                                                ...SEARCH_RESULT_ROW_STYLE,
                                                borderColor: isHighlighted ? 'rgba(99, 171, 255, 0.5)' : SEARCH_RESULT_ROW_STYLE.borderColor,
                                                background: isHighlighted ? 'rgba(99, 171, 255, 0.16)' : SEARCH_RESULT_ROW_STYLE.background,
                                            }}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                selectSearchResultById(item.id);
                                            }}
                                            onMouseEnter={() => setSearchHighlightedIndex(index)}
                                        >
                                            <span style={SEARCH_RESULT_TITLE_STYLE}>{item.title}</span>
                                            <span style={SEARCH_RESULT_META_STYLE}>
                                                {item.nodeCount} dots | {item.linkCount} links | {item.subtitle}
                                            </span>
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
    width: 'min(560px, calc(100vw - 32px))',
    maxHeight: 'calc(100vh - 64px)',
    borderRadius: '14px',
    border: '1px solid rgba(255, 255, 255, 0.14)',
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

const SEARCH_HEADER_ROW_STYLE: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
};

const SEARCH_HEADER_TITLE_STYLE: React.CSSProperties = {
    color: 'rgba(231, 231, 231, 0.82)',
    fontSize: '12px',
    lineHeight: 1.2,
    letterSpacing: '0.3px',
    fontFamily: 'var(--font-ui)',
};

const SEARCH_CLOSE_BUTTON_STYLE: React.CSSProperties = {
    width: '24px',
    height: '24px',
    borderRadius: '6px',
    border: '1px solid rgba(255, 255, 255, 0.18)',
    background: 'rgba(255, 255, 255, 0.04)',
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
};

const SEARCH_INPUT_STYLE: React.CSSProperties = {
    width: '100%',
    borderRadius: '10px',
    border: '1px solid rgba(99, 171, 255, 0.45)',
    background: 'rgba(12, 15, 22, 0.95)',
    color: '#e7e7e7',
    fontFamily: 'var(--font-ui)',
    fontSize: '14px',
    lineHeight: 1.4,
    padding: '11px 12px',
    outline: 'none',
};

const SEARCH_RESULTS_STYLE: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    flex: '1 1 auto',
    minHeight: 0,
    gap: '8px',
    maxHeight: '52vh',
    overflowY: 'auto',
};

const SEARCH_SECTION_LABEL_STYLE: React.CSSProperties = {
    color: 'rgba(231, 231, 231, 0.58)',
    fontSize: '11px',
    lineHeight: 1.2,
    letterSpacing: '0.35px',
    textTransform: 'uppercase',
    padding: '2px 4px 0',
    fontFamily: 'var(--font-ui)',
};

const SEARCH_RESULT_ROW_STYLE: React.CSSProperties = {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '4px',
    padding: '10px 12px',
    borderRadius: '10px',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    background: 'rgba(255, 255, 255, 0.03)',
    textAlign: 'left',
    cursor: 'pointer',
};

const SEARCH_RESULT_TITLE_STYLE: React.CSSProperties = {
    color: '#f3f7ff',
    fontSize: '14px',
    lineHeight: 1.35,
    fontWeight: 600,
    fontFamily: 'var(--font-ui)',
};

const SEARCH_RESULT_META_STYLE: React.CSSProperties = {
    color: 'rgba(231, 231, 231, 0.72)',
    fontSize: '12px',
    lineHeight: 1.35,
    fontFamily: 'var(--font-ui)',
};

const SEARCH_EMPTY_STYLE: React.CSSProperties = {
    color: 'rgba(231, 231, 231, 0.62)',
    fontSize: '13px',
    lineHeight: 1.4,
    padding: '10px 6px',
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
