import React from 'react';
import { dismissMoneyNotice, useMoneyNotices } from '../money/moneyNotices';

export const MoneyNoticeStack: React.FC = () => {
    const notices = useMoneyNotices();

    if (notices.length === 0) return null;

    return (
        <div
            style={STACK_STYLE}
            onPointerDown={(e) => e.stopPropagation()}
            onWheelCapture={(e) => e.stopPropagation()}
            onWheel={(e) => e.stopPropagation()}
        >
            {notices.map((notice) => (
                <div key={notice.id} style={{ ...CARD_STYLE, ...statusStyles[notice.status] }}>
                    <div style={HEADER_STYLE}>
                        <div style={TITLE_STYLE}>{notice.title}</div>
                        <button
                            type="button"
                            style={CLOSE_STYLE}
                            onClick={() => dismissMoneyNotice(notice.id)}
                            onPointerDown={(e) => e.stopPropagation()}
                        >
                            Close
                        </button>
                    </div>
                    <div style={MESSAGE_STYLE}>{notice.message}</div>
                    {notice.ctas && notice.ctas.length > 0 ? (
                        <div style={CTA_ROW_STYLE}>
                            {notice.ctas.map((cta) => (
                                <button
                                    key={cta.label}
                                    type="button"
                                    style={CTA_BUTTON_STYLE}
                                    onClick={() => {
                                        cta.onClick();
                                        dismissMoneyNotice(notice.id);
                                    }}
                                    onPointerDown={(e) => e.stopPropagation()}
                                >
                                    {cta.label}
                                </button>
                            ))}
                        </div>
                    ) : null}
                </div>
            ))}
        </div>
    );
};

const STACK_STYLE: React.CSSProperties = {
    position: 'fixed',
    right: '24px',
    bottom: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    zIndex: 180,
    maxWidth: '320px'
};

const CARD_STYLE: React.CSSProperties = {
    borderRadius: '14px',
    padding: '14px',
    background: '#11131a',
    border: '1px solid #2b2f3a',
    color: '#e7e7e7',
    fontFamily: 'var(--font-ui)',
    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)'
};

const HEADER_STYLE: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between'
};

const TITLE_STYLE: React.CSSProperties = {
    fontSize: '13px',
    fontWeight: 600
};

const MESSAGE_STYLE: React.CSSProperties = {
    marginTop: '6px',
    fontSize: '12px',
    color: '#c2c6d4',
    lineHeight: 1.5
};

const CTA_ROW_STYLE: React.CSSProperties = {
    display: 'flex',
    gap: '8px',
    marginTop: '10px'
};

const CTA_BUTTON_STYLE: React.CSSProperties = {
    flex: 1,
    padding: '8px 10px',
    borderRadius: '10px',
    border: '1px solid #2b2f3a',
    background: '#141923',
    color: '#e7e7e7',
    fontSize: '12px',
    fontFamily: 'var(--font-ui)',
    cursor: 'pointer'
};

const CLOSE_STYLE: React.CSSProperties = {
    border: 'none',
    background: 'transparent',
    color: '#8c93a6',
    fontSize: '11px',
    cursor: 'pointer',
    fontFamily: 'var(--font-ui)'
};

const statusStyles: Record<string, React.CSSProperties> = {
    info: { borderColor: '#2b2f3a' },
    success: { borderColor: '#2a5f4a' },
    warning: { borderColor: '#5c4a26' },
    error: { borderColor: '#6a2a2a' }
};
