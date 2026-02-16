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
    if (seenLoadingTrue) {
        return {
            nextPhase: 'done',
            nextSeenLoadingTrue: seenLoadingTrue,
        };
    }
    if (entryIntent === 'none') {
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
    if (currentPhase === 'done' || currentPhase === 'confirmed') return currentPhase;
    return 'stalled';
}
