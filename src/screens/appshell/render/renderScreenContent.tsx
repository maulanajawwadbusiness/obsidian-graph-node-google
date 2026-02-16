import React, { Suspense } from 'react';
import { EnterPrompt } from '../../EnterPrompt';
import { Welcome1 } from '../../Welcome1';
import { Welcome2 } from '../../Welcome2';
import { GraphScreenShell } from './GraphScreenShell';
import { GraphLoadingGate } from './GraphLoadingGate';
import { AppScreen, isGraphClassScreen } from '../screenFlow/screenTypes';
import { GraphRuntimeLeaseBoundary } from '../../../runtime/GraphRuntimeLeaseBoundary';
import { type GatePhase } from './graphLoadingGateMachine';
import { type GateVisualPhase } from './GraphLoadingGate';
import type {
    GraphPhysicsPlaygroundProps,
    PendingAnalysisPayload,
    GraphRuntimeStatusSnapshot,
} from '../../../playground/modules/graphPhysicsTypes';
import type { SavedInterfaceRecordV1 } from '../../../store/savedInterfacesStore';

type ScreenRenderBucket = 'onboarding' | 'graph_class';
type LegacyLoadingScreenMode = 'enabled' | 'disabled';

const SCREEN_RENDER_BUCKET: Record<AppScreen, ScreenRenderBucket> = {
    welcome1: 'onboarding',
    welcome2: 'onboarding',
    prompt: 'onboarding',
    graph_loading: 'graph_class',
    graph: 'graph_class',
};

const LEGACY_LOADING_MODE_BY_SCREEN: Record<AppScreen, LegacyLoadingScreenMode> = {
    welcome1: 'enabled',
    welcome2: 'enabled',
    prompt: 'enabled',
    graph_loading: 'disabled',
    graph: 'disabled',
};

export type RenderScreenArgs = {
    screen: AppScreen;
    isSidebarExpanded: boolean;
    fallbackStyle: React.CSSProperties;
    GraphWithPending: React.ComponentType<GraphPhysicsPlaygroundProps>;
    pendingAnalysis: PendingAnalysisPayload;
    documentViewerToggleToken: number;
    pendingLoadInterface: SavedInterfaceRecordV1 | null;
    setPendingAnalysis: React.Dispatch<React.SetStateAction<PendingAnalysisPayload>>;
    onGraphLoadingStateChange: (isLoading: boolean) => void;
    onGraphRuntimeStatusChange: (status: GraphRuntimeStatusSnapshot) => void;
    setPendingLoadInterface: React.Dispatch<React.SetStateAction<SavedInterfaceRecordV1 | null>>;
    setWelcome1OverlayOpen: (open: boolean) => void;
    setEnterPromptOverlayOpen: (open: boolean) => void;
    setRestoreReadPathActive: (active: boolean) => void;
    promptAnalysisErrorMessage: string | null;
    clearPromptAnalysisError: () => void;
    gatePhase: GatePhase;
    gateVisualPhase: GateVisualPhase;
    gateFadeMs: number;
    gateFadeEasing: string;
    gateInteractionLocked: boolean;
    gateErrorMessage: string | null;
    gateConfirmVisible: boolean;
    gateConfirmEnabled: boolean;
    gateRootRef?: React.RefObject<HTMLDivElement>;
    onGateConfirm?: () => void;
    gateShowBackToPrompt: boolean;
    onGateBackToPrompt: () => void;
    transitionToScreen: (next: AppScreen) => void;
    commitUpsertInterface: (record: SavedInterfaceRecordV1, reason: string) => void;
    commitPatchLayoutByDocId: (
        docId: string,
        layout: SavedInterfaceRecordV1['layout'],
        camera: SavedInterfaceRecordV1['camera'],
        reason: string
    ) => void;
    getNextScreen: (current: AppScreen) => AppScreen | null;
    getBackScreen: (current: AppScreen) => AppScreen | null;
    getSkipTarget: () => AppScreen;
};

export function renderScreenContent(args: RenderScreenArgs): React.ReactNode {
    const {
        screen,
        isSidebarExpanded,
        fallbackStyle,
        GraphWithPending,
        pendingAnalysis,
        documentViewerToggleToken,
        pendingLoadInterface,
        setPendingAnalysis,
        onGraphLoadingStateChange,
        onGraphRuntimeStatusChange,
        setPendingLoadInterface,
        setWelcome1OverlayOpen,
        setEnterPromptOverlayOpen,
        setRestoreReadPathActive,
        promptAnalysisErrorMessage,
        clearPromptAnalysisError,
        gatePhase,
        gateVisualPhase,
        gateFadeMs,
        gateFadeEasing,
        gateInteractionLocked,
        gateErrorMessage,
        gateConfirmVisible,
        gateConfirmEnabled,
        gateRootRef,
        onGateConfirm,
        gateShowBackToPrompt,
        onGateBackToPrompt,
        transitionToScreen,
        commitUpsertInterface,
        commitPatchLayoutByDocId,
        getNextScreen,
        getBackScreen,
        getSkipTarget,
    } = args;

    if (SCREEN_RENDER_BUCKET[screen] === 'graph_class' && isGraphClassScreen(screen)) {
        return (
            <Suspense fallback={<div style={fallbackStyle}>Loading graph...</div>}>
                <GraphScreenShell sidebarExpanded={isSidebarExpanded}>
                    {/* Warm-mount contract: graph-class screens must share this exact subtree shape with no screen key. */}
                    <GraphRuntimeLeaseBoundary
                        owner="graph-screen"
                        pendingFallback={<div style={fallbackStyle}>Starting graph runtime...</div>}
                    >
                        <GraphWithPending
                            enableDebugSidebar={false}
                            // Product graph path contract: gate UI is the sole loading surface in graph-class screens.
                            legacyLoadingScreenMode={LEGACY_LOADING_MODE_BY_SCREEN[screen]}
                            pendingAnalysisPayload={pendingAnalysis}
                            onPendingAnalysisConsumed={() => setPendingAnalysis(null)}
                            onLoadingStateChange={onGraphLoadingStateChange}
                            onRuntimeStatusChange={onGraphRuntimeStatusChange}
                            documentViewerToggleToken={documentViewerToggleToken}
                            pendingLoadInterface={pendingLoadInterface}
                            onPendingLoadInterfaceConsumed={() => setPendingLoadInterface(null)}
                            onRestoreReadPathChange={(active) => {
                                setRestoreReadPathActive(active);
                            }}
                            onSavedInterfaceUpsert={(record, reason) => commitUpsertInterface(record, reason)}
                            onSavedInterfaceLayoutPatch={(docId, layout, camera, reason) =>
                                commitPatchLayoutByDocId(docId, layout, camera, reason)
                            }
                        />
                    </GraphRuntimeLeaseBoundary>
                    {screen === 'graph_loading' ? (
                        <GraphLoadingGate
                            rootRef={gateRootRef}
                            phase={gatePhase}
                            visualPhase={gateVisualPhase}
                            fadeMs={gateFadeMs}
                            fadeEasing={gateFadeEasing}
                            interactionLocked={gateInteractionLocked}
                            errorMessage={gateErrorMessage}
                            confirmVisible={gateConfirmVisible}
                            confirmEnabled={gateConfirmEnabled}
                            onConfirm={onGateConfirm}
                            showBackToPrompt={gateShowBackToPrompt}
                            onBackToPrompt={onGateBackToPrompt}
                        />
                    ) : null}
                </GraphScreenShell>
            </Suspense>
        );
    }
    if (screen === 'welcome1') {
        const nextFromWelcome1 = getNextScreen('welcome1');
        const skipTarget = getSkipTarget();
        return (
            <Welcome1
                onNext={() => {
                    if (!nextFromWelcome1) return;
                    transitionToScreen(nextFromWelcome1);
                }}
                onSkip={() => transitionToScreen(skipTarget)}
                onOverlayOpenChange={setWelcome1OverlayOpen}
            />
        );
    }
    if (screen === 'welcome2') {
        const backFromWelcome2 = getBackScreen('welcome2');
        const nextFromWelcome2 = getNextScreen('welcome2');
        const skipTarget = getSkipTarget();
        return (
            <Welcome2
                onBack={() => {
                    if (!backFromWelcome2) return;
                    transitionToScreen(backFromWelcome2);
                }}
                onNext={() => {
                    if (!nextFromWelcome2) return;
                    transitionToScreen(nextFromWelcome2);
                }}
                onSkip={() => transitionToScreen(skipTarget)}
            />
        );
    }
    const backFromPrompt = getBackScreen('prompt');
    const enterFromPrompt = getNextScreen('prompt');
    const promptSkipTarget: AppScreen = 'graph_loading';
    return (
        <EnterPrompt
            onBack={() => {
                if (!backFromPrompt) return;
                transitionToScreen(backFromPrompt);
            }}
            onEnter={() => transitionToScreen(enterFromPrompt ?? 'graph_loading')}
            onSkip={() => {
                clearPromptAnalysisError();
                transitionToScreen(promptSkipTarget);
            }}
            onOverlayOpenChange={setEnterPromptOverlayOpen}
            analysisErrorMessage={promptAnalysisErrorMessage}
            onDismissAnalysisError={clearPromptAnalysisError}
            onSubmitPromptText={(text) => {
                clearPromptAnalysisError();
                setPendingAnalysis({ kind: 'text', text, createdAt: Date.now() });
                console.log(`[appshell] pending_analysis_set kind=text len=${text.length}`);
            }}
            onSubmitPromptFile={(file) => {
                clearPromptAnalysisError();
                setPendingAnalysis({ kind: 'file', file, createdAt: Date.now() });
                console.log('[appshell] pending_analysis_set kind=file name=%s size=%d', file.name, file.size);
            }}
        />
    );
}
