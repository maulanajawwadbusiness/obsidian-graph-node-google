import { getBalanceState, refreshBalance } from '../store/balanceStore';
import { showShortage, type ShortageContext } from './shortageStore';

function isDevBalanceBypassEnabled(): boolean {
    return import.meta.env.DEV && import.meta.env.VITE_DEV_BYPASS_BALANCE === '1';
}

async function waitForBalance(timeoutMs: number): Promise<number | null> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        const { balanceIdr, status } = getBalanceState();
        if (typeof balanceIdr === 'number') {
            return balanceIdr;
        }
        if (status === 'unauthorized' || status === 'error') {
            return null;
        }
        await new Promise((resolve) => setTimeout(resolve, 80));
    }
    return getBalanceState().balanceIdr;
}

export async function ensureSufficientBalance(params: {
    requiredIdr: number;
    context: ShortageContext;
    timeoutMs?: number;
}): Promise<boolean> {
    if (isDevBalanceBypassEnabled()) {
        return true;
    }

    const timeoutMs = params.timeoutMs ?? 1200;
    let { balanceIdr } = getBalanceState();

    if (balanceIdr === null) {
        await refreshBalance({ force: true });
        balanceIdr = await waitForBalance(timeoutMs);
    }

    if (balanceIdr === null || typeof balanceIdr !== 'number') {
        showShortage({
            balanceIdr: null,
            requiredIdr: params.requiredIdr,
            shortfallIdr: Math.max(0, params.requiredIdr),
            context: params.context
        });
        return false;
    }

    if (balanceIdr >= params.requiredIdr) {
        return true;
    }

    const shortfall = Math.max(0, params.requiredIdr - balanceIdr);
    showShortage({
        balanceIdr,
        requiredIdr: params.requiredIdr,
        shortfallIdr: shortfall,
        context: params.context
    });
    return false;
}
