import React from 'react';
import { hideShortage, useShortageStore } from '../money/shortageStore';
import { openTopupPanel } from '../money/topupEvents';

function formatRupiah(value: number | null): string {
    if (value === null || Number.isNaN(value)) {
        return 'Rp ...';
    }
    const formatted = new Intl.NumberFormat('id-ID').format(Math.max(0, Math.floor(value)));
    return `Rp ${formatted}`;
}

function contextLabel(context: 'analysis' | 'chat' | 'prefill') {
    if (context === 'analysis') return 'analisis';
    if (context === 'prefill') return 'prefill';
    return 'chat';
}

export const ShortageWarning: React.FC = () => {
    const { open, balanceIdr, requiredIdr, shortfallIdr, context, surface } = useShortageStore();

    if (!open) return null;
    if (context === 'chat' && (surface === 'node-popup' || surface === 'mini-chat')) return null;

    return (
        <div style={BACKDROP_STYLE} onPointerDown={(e) => e.stopPropagation()}>
            <div style={PANEL_STYLE} onPointerDown={(e) => e.stopPropagation()}>
                <div style={TITLE_STYLE}>Saldo tidak cukup untuk {contextLabel(context)}</div>
                <div style={SUBTITLE_STYLE}>Perkiraan biaya dan kekurangan saat ini</div>

                <div style={ROW_STYLE}>
                    <div style={ROW_LABEL_STYLE}>Saldo</div>
                    <div style={ROW_VALUE_STYLE}>{formatRupiah(balanceIdr)}</div>
                </div>
                <div style={ROW_STYLE}>
                    <div style={ROW_LABEL_STYLE}>Perkiraan biaya</div>
                    <div style={ROW_VALUE_STYLE}>{formatRupiah(requiredIdr)}</div>
                </div>
                <div style={ROW_STYLE}>
                    <div style={ROW_LABEL_STYLE}>Kekurangan</div>
                    <div style={ROW_VALUE_HIGHLIGHT_STYLE}>{formatRupiah(shortfallIdr)}</div>
                </div>

                <div style={ACTIONS_STYLE}>
                    <button
                        type="button"
                        style={PRIMARY_BUTTON_STYLE}
                        onClick={() => {
                            openTopupPanel();
                            hideShortage();
                        }}
                        onPointerDown={(e) => e.stopPropagation()}
                    >
                        Isi saldo
                    </button>
                    <button
                        type="button"
                        style={SECONDARY_BUTTON_STYLE}
                        onClick={() => hideShortage()}
                        onPointerDown={(e) => e.stopPropagation()}
                    >
                        Batal
                    </button>
                </div>
            </div>
        </div>
    );
};

const BACKDROP_STYLE: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(4, 6, 10, 0.72)',
    backdropFilter: 'blur(6px)',
    zIndex: 200
};

const PANEL_STYLE: React.CSSProperties = {
    width: '360px',
    background: '#0f1115',
    border: '1px solid #2b2f3a',
    borderRadius: '16px',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    color: '#e7e7e7',
    fontFamily: 'var(--font-ui)'
};

const TITLE_STYLE: React.CSSProperties = {
    fontSize: '15px',
    fontWeight: 600
};

const SUBTITLE_STYLE: React.CSSProperties = {
    fontSize: '12px',
    color: '#8c93a6'
};

const ROW_STYLE: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    fontSize: '13px'
};

const ROW_LABEL_STYLE: React.CSSProperties = {
    color: '#8c93a6'
};

const ROW_VALUE_STYLE: React.CSSProperties = {
    color: '#e7e7e7',
    fontWeight: 600
};

const ROW_VALUE_HIGHLIGHT_STYLE: React.CSSProperties = {
    color: '#f0c36a',
    fontWeight: 700
};

const ACTIONS_STYLE: React.CSSProperties = {
    display: 'flex',
    gap: '10px',
    marginTop: '6px'
};

const PRIMARY_BUTTON_STYLE: React.CSSProperties = {
    flex: 1,
    padding: '10px 12px',
    borderRadius: '10px',
    border: 'none',
    background: '#2f6ee5',
    color: '#ffffff',
    fontSize: '13px',
    fontFamily: 'var(--font-ui)',
    cursor: 'pointer'
};

const SECONDARY_BUTTON_STYLE: React.CSSProperties = {
    flex: 1,
    padding: '10px 12px',
    borderRadius: '10px',
    border: '1px solid #2b2f3a',
    background: '#141923',
    color: '#e7e7e7',
    fontSize: '13px',
    fontFamily: 'var(--font-ui)',
    cursor: 'pointer'
};
