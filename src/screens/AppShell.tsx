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
import { loadSavedInterfaces, type SavedInterfaceRecordV1 } from '../store/savedInterfacesStore';

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
let hasWarnedInvalidStartScreen = false;

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
    const [graphIsLoading, setGraphIsLoading] = React.useState(false);
    const [documentViewerToggleToken, setDocumentViewerToggleToken] = React.useState(0);
    const [isSidebarExpanded, setIsSidebarExpanded] = React.useState(false);
    const [welcome1OverlayOpen, setWelcome1OverlayOpen] = React.useState(false);
    const [enterPromptOverlayOpen, setEnterPromptOverlayOpen] = React.useState(false);
    const [welcome1FontGateDone, setWelcome1FontGateDone] = React.useState(false);
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
        <div style={SHELL_STYLE} data-graph-loading={graphIsLoading ? '1' : '0'}>
            {showPersistentSidebar ? (
                <Sidebar
                    isExpanded={isSidebarExpanded}
                    onToggle={() => setIsSidebarExpanded((prev) => !prev)}
                    disabled={sidebarDisabled}
                    showDocumentViewerButton={screen === 'graph'}
                    onToggleDocumentViewer={() => setDocumentViewerToggleToken((prev) => prev + 1)}
                    interfaces={sidebarInterfaces}
                    selectedInterfaceId={pendingLoadInterface?.id ?? undefined}
                    onSelectInterface={(id) => {
                        const record = savedInterfaces.find((item) => item.id === id);
                        if (!record) return;
                        setPendingLoadInterface(record);
                        console.log('[appshell] pending_load_interface id=%s', id);
                    }}
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
