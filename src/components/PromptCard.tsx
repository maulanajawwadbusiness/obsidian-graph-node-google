import React from 'react';
import { t } from '../i18n/t';

export const PromptCard: React.FC = () => {

    return (
        <div style={CARD_STYLE}>
            <div style={CARD_INNER_STYLE}>
                <div style={GRAPH_PREVIEW_PLACEHOLDER_STYLE}>
                    <div style={PLACEHOLDER_LABEL_STYLE}>{t('onboarding.enterprompt.graph_preview_placeholder')}</div>
                </div>

                <div style={HEADLINE_STYLE}>
                    {t('onboarding.enterprompt.heading')}
                </div>

                <div style={INPUT_PILL_STYLE}>
                    <textarea
                        placeholder={t('onboarding.enterprompt.input_placeholder')}
                        style={INPUT_STYLE}
                        rows={3}
                        readOnly
                    />
                </div>
            </div>
        </div>
    );
};

const CARD_STYLE: React.CSSProperties = {
    position: 'relative',
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    background: '#0f1115',
    color: '#e7e7e7',
};

const CARD_INNER_STYLE: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '32px',
    maxWidth: '720px',
    width: '100%',
    padding: '0 24px',
    boxSizing: 'border-box',
};

const HEADLINE_STYLE: React.CSSProperties = {
    fontSize: '24px',
    fontWeight: 600,
    lineHeight: 1.4,
    textAlign: 'center',
    color: '#e7e7e7',
    fontFamily: 'var(--font-ui)',
};

const GRAPH_PREVIEW_PLACEHOLDER_STYLE: React.CSSProperties = {
    width: '100%',
    height: '240px',
    borderRadius: '12px',
    border: '1px dashed #2b2f3a',
    background: 'rgba(20, 25, 35, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
};

const PLACEHOLDER_LABEL_STYLE: React.CSSProperties = {
    fontSize: '13px',
    color: '#5a6070',
    fontFamily: 'var(--font-ui)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
};

const INPUT_PILL_STYLE: React.CSSProperties = {
    width: '100%',
    maxWidth: '600px',
};

const INPUT_STYLE: React.CSSProperties = {
    width: '100%',
    padding: '16px 20px',
    borderRadius: '16px',
    border: '1px solid #2b2f3a',
    background: '#141923',
    color: '#e7e7e7',
    fontSize: '15px',
    fontFamily: 'var(--font-ui)',
    resize: 'none',
    outline: 'none',
    transition: 'border-color 0.2s ease',
    boxSizing: 'border-box',
};
