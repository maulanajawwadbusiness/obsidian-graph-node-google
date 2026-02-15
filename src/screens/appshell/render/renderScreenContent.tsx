import React, { Suspense } from 'react';
import { EnterPrompt } from '../../EnterPrompt';
import { Welcome1 } from '../../Welcome1';
import { Welcome2 } from '../../Welcome2';
import { GraphScreenShell } from './GraphScreenShell';
import type { AppScreen } from '../screenFlow/screenTypes';
import type {
    GraphPhysicsPlaygroundProps,
    PendingAnalysisPayload,
} from '../../../playground/modules/graphPhysicsTypes';
import type { SavedInterfaceRecordV1 } from '../../../store/savedInterfacesStore';

export type RenderScreenArgs = {
    screen: AppScreen;
    isSidebarExpanded: boolean;
    fallbackStyle: React.CSSProperties;
    GraphWithPending: React.ComponentType<GraphPhysicsPlaygroundProps>;
    pendingAnalysis: PendingAnalysisPayload;
    documentViewerToggleToken: number;
    pendingLoadInterface: SavedInterfaceRecordV1 | null;
    setPendingAnalysis: React.Dispatch<React.SetStateAction<PendingAnalysisPayload>>;
    setGraphIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
    setPendingLoadInterface: React.Dispatch<React.SetStateAction<SavedInterfaceRecordV1 | null>>;
    setWelcome1OverlayOpen: (open: boolean) => void;
    setEnterPromptOverlayOpen: (open: boolean) => void;
    setRestoreReadPathActive: (active: boolean) => void;
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
        setGraphIsLoading,
        setPendingLoadInterface,
        setWelcome1OverlayOpen,
        setEnterPromptOverlayOpen,
        setRestoreReadPathActive,
        transitionToScreen,
        commitUpsertInterface,
        commitPatchLayoutByDocId,
        getNextScreen,
        getBackScreen,
        getSkipTarget,
    } = args;

    if (screen === 'graph' || screen === 'graph_loading') {
        return (
            <Suspense fallback={<div style={fallbackStyle}>Loading graph...</div>}>
                <GraphScreenShell sidebarExpanded={isSidebarExpanded}>
                    <GraphWithPending
                        enableDebugSidebar={false}
                        pendingAnalysisPayload={pendingAnalysis}
                        onPendingAnalysisConsumed={() => setPendingAnalysis(null)}
                        onLoadingStateChange={(v) => setGraphIsLoading(v)}
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
            onSkip={() => transitionToScreen(promptSkipTarget)}
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
}
