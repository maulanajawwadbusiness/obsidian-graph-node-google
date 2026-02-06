import React from 'react';
import { refreshBalance, useBalanceStore } from '../store/balanceStore';

function formatRupiah(value: number | null): string {
    if (value === null || Number.isNaN(value)) {
        return 'Rp ...';
    }
    const formatted = new Intl.NumberFormat('id-ID').format(Math.max(0, Math.floor(value)));
    return `Rp ${formatted}`;
}

export const BalanceBadge: React.FC = () => {
    const { balanceIdr, status } = useBalanceStore();

    React.useEffect(() => {
        if (status === 'idle') {
            void refreshBalance();
        }
    }, [status]);

    const display = status === 'loading' && balanceIdr === null ? 'Rp ...' : formatRupiah(balanceIdr);

    return (
        <div style={WRAP_STYLE} onPointerDown={(e) => e.stopPropagation()}>
            <div style={LABEL_STYLE}>Saldo</div>
            <div style={VALUE_STYLE}>{display}</div>
        </div>
    );
};

const WRAP_STYLE: React.CSSProperties = {
    position: 'fixed',
    top: '20px',
    right: '24px',
    display: 'flex',
    alignItems: 'baseline',
    gap: '8px',
    padding: '8px 14px',
    borderRadius: '999px',
    background: 'rgba(12, 14, 18, 0.92)',
    border: '1px solid #2b2f3a',
    color: '#e7e7e7',
    fontFamily: 'var(--font-ui)',
    boxShadow: '0 8px 26px rgba(0, 0, 0, 0.28)',
    zIndex: 120
};

const LABEL_STYLE: React.CSSProperties = {
    fontSize: '11px',
    textTransform: 'uppercase',
    letterSpacing: '0.6px',
    color: '#6f778a'
};

const VALUE_STYLE: React.CSSProperties = {
    fontSize: '14px',
    fontWeight: 600,
    color: '#f0f2f7'
};
