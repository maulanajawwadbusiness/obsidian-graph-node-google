import { apiGet } from '../api';
import { useSyncExternalStore } from 'react';

type BalanceStatus = 'idle' | 'loading' | 'ready' | 'error' | 'unauthorized';

type BalanceState = {
    status: BalanceStatus;
    balanceIdr: number | null;
    updatedAt: string | null;
    error: string | null;
    lastFetchedAt: number | null;
};

const listeners = new Set<() => void>();

let state: BalanceState = {
    status: 'idle',
    balanceIdr: null,
    updatedAt: null,
    error: null,
    lastFetchedAt: null,
};

let inFlight: Promise<void> | null = null;

function emitChange() {
    for (const listener of listeners) {
        listener();
    }
}

function setState(partial: Partial<BalanceState>) {
    state = { ...state, ...partial };
    emitChange();
}

export function getBalanceState(): BalanceState {
    return state;
}

export function subscribeBalance(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

export function useBalanceStore(): BalanceState {
    return useSyncExternalStore(subscribeBalance, getBalanceState, getBalanceState);
}

export async function refreshBalance(opts?: { force?: boolean }): Promise<void> {
    const force = Boolean(opts?.force);
    if (inFlight && !force) {
        return inFlight;
    }

    const now = Date.now();
    if (!force && state.lastFetchedAt && now - state.lastFetchedAt < 5000) {
        return;
    }

    setState({ status: 'loading', error: null });

    inFlight = (async () => {
        try {
            const res = await apiGet('/api/rupiah/me');
            if (res.status === 401 || res.status === 403) {
                setState({ status: 'unauthorized', balanceIdr: null, updatedAt: null, error: null, lastFetchedAt: now });
                console.log('[balance] unauthorized');
                return;
            }
            if (!res.ok || !res.data || typeof res.data !== 'object') {
                setState({ status: 'error', error: res.error || 'failed to load balance', lastFetchedAt: now });
                console.log('[balance] fetch error');
                return;
            }

            const payload = res.data as { ok?: boolean; balance_idr?: number; updated_at?: string };
            if (!payload.ok) {
                setState({ status: 'error', error: 'failed to load balance', lastFetchedAt: now });
                console.log('[balance] response not ok');
                return;
            }

            const balanceIdr = typeof payload.balance_idr === 'number' ? payload.balance_idr : null;
            setState({
                status: 'ready',
                balanceIdr,
                updatedAt: payload.updated_at ?? null,
                error: null,
                lastFetchedAt: now
            });
            console.log('[balance] updated');
        } catch (err) {
            setState({ status: 'error', error: String(err), lastFetchedAt: now });
            console.log('[balance] fetch exception');
        } finally {
            inFlight = null;
        }
    })();

    return inFlight;
}
