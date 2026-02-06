import { useSyncExternalStore } from 'react';

export type ShortageContext = 'analysis' | 'chat' | 'prefill';

export type ShortageState = {
    open: boolean;
    balanceIdr: number;
    requiredIdr: number;
    shortfallIdr: number;
    context: ShortageContext;
};

const listeners = new Set<() => void>();

let state: ShortageState = {
    open: false,
    balanceIdr: 0,
    requiredIdr: 0,
    shortfallIdr: 0,
    context: 'analysis'
};

function emitChange() {
    for (const listener of listeners) {
        listener();
    }
}

function setState(next: Partial<ShortageState>) {
    state = { ...state, ...next };
    emitChange();
}

export function showShortage(params: {
    balanceIdr: number;
    requiredIdr: number;
    shortfallIdr: number;
    context: ShortageContext;
}) {
    setState({
        open: true,
        balanceIdr: params.balanceIdr,
        requiredIdr: params.requiredIdr,
        shortfallIdr: params.shortfallIdr,
        context: params.context
    });
}

export function hideShortage() {
    setState({ open: false });
}

export function getShortageState() {
    return state;
}

export function subscribeShortage(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

export function useShortageStore(): ShortageState {
    return useSyncExternalStore(subscribeShortage, getShortageState, getShortageState);
}
