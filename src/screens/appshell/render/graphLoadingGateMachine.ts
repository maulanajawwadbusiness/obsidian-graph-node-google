import { AppScreen } from '../screenFlow/screenTypes';

export type GatePhase = 'idle' | 'arming' | 'loading' | 'stalled' | 'error' | 'done' | 'confirmed';
export type GateEntryIntent = 'analysis' | 'restore' | 'none';

export type RuntimeStatusSnapshot = {
    isLoading: boolean;
    aiErrorMessage: string | null;
};

type GateBaseInput = {
    screen: AppScreen;
    entryIntent: GateEntryIntent;
    runtime: RuntimeStatusSnapshot;
    seenLoadingTrue: boolean;
    currentPhase: GatePhase;
};

type GateBaseOutput = {
    nextPhase: GatePhase;
    nextSeenLoadingTrue: boolean;
};

type GateWatchdogInput = {
    screen: AppScreen;
    entryIntent: GateEntryIntent;
    seenLoadingTrue: boolean;
    currentPhase: GatePhase;
};

type GateControls = {
    allowConfirm: boolean;
    allowBack: boolean;
};

type GateNextAction = 'none';

export function getGateEntryIntent(
    hasPendingAnalysis: boolean,
    hasPendingLoadInterface: boolean
): GateEntryIntent {
    if (hasPendingAnalysis) return 'analysis';
    if (hasPendingLoadInterface) return 'restore';
    return 'none';
}

export function computeGraphLoadingGateBase(input: GateBaseInput): GateBaseOutput {
    const { screen, entryIntent, runtime, seenLoadingTrue, currentPhase } = input;
    if (screen !== 'graph_loading') {
        return { nextPhase: 'idle', nextSeenLoadingTrue: false };
    }
    if (runtime.isLoading) {
        return {
            nextPhase: 'loading',
            nextSeenLoadingTrue: true,
        };
    }
    if (entryIntent === 'none') {
        return {
            nextPhase: 'done',
            nextSeenLoadingTrue: seenLoadingTrue,
        };
    }
    if (!runtime.isLoading && runtime.aiErrorMessage) {
        return {
            nextPhase: 'error',
            nextSeenLoadingTrue: seenLoadingTrue,
        };
    }
    if (seenLoadingTrue) {
        return {
            nextPhase: 'done',
            nextSeenLoadingTrue: seenLoadingTrue,
        };
    }
    return {
        nextPhase: currentPhase,
        nextSeenLoadingTrue: seenLoadingTrue,
    };
}

export function computeGraphLoadingWatchdogPhase(input: GateWatchdogInput): GatePhase {
    const { screen, entryIntent, seenLoadingTrue, currentPhase } = input;
    if (screen !== 'graph_loading') return currentPhase;
    if (entryIntent === 'none') return currentPhase;
    if (seenLoadingTrue) return currentPhase;
    if (currentPhase === 'done' || currentPhase === 'confirmed' || currentPhase === 'error') return currentPhase;
    return 'stalled';
}

export function getGateControls(phase: GatePhase): GateControls {
    return {
        allowConfirm: phase === 'done',
        allowBack: phase !== 'done',
    };
}

export function getGateNextAction(screen: AppScreen, phase: GatePhase): GateNextAction {
    if (screen !== 'graph_loading') return 'none';
    if (phase === 'error') return 'none';
    return 'none';
}
