import { getBalanceState } from '../store/balanceStore';
import { showShortage, type ShortageContext } from './shortageStore';

export function ensureSufficientBalance(params: {
    requiredIdr: number;
    context: ShortageContext;
}): boolean {
    const { balanceIdr } = getBalanceState();
    if (balanceIdr === null || typeof balanceIdr !== 'number') {
        return true;
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
