import React from 'react';

type Welcome1Props = {
    onNext: () => void;
    onSkip: () => void;
};

export const Welcome1: React.FC<Welcome1Props> = ({ onNext, onSkip }) => {
    return (
        <div style={ROOT_STYLE}>
            <div style={CARD_STYLE}>
                <div style={TITLE_STYLE}>Welcome</div>
                <div style={BODY_STYLE}>
                    This is a placeholder for welcome page 1.
                </div>
                <div style={BUTTON_ROW_STYLE}>
                    <button type="button" style={PRIMARY_BUTTON_STYLE} onClick={onNext}>
                        Next
                    </button>
                    <button type="button" style={SECONDARY_BUTTON_STYLE} onClick={onSkip}>
                        Skip
                    </button>
                </div>
            </div>
        </div>
    );
};

const ROOT_STYLE: React.CSSProperties = {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '32px',
    background: '#0f1115',
    color: '#e7e7e7',
};

const CARD_STYLE: React.CSSProperties = {
    width: '100%',
    maxWidth: '520px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    textAlign: 'center',
};

const TITLE_STYLE: React.CSSProperties = {
    fontSize: '32px',
    fontWeight: 700,
    letterSpacing: '0.5px',
};

const BODY_STYLE: React.CSSProperties = {
    fontSize: '16px',
    lineHeight: 1.6,
    color: '#b9bcc5',
};

const BUTTON_ROW_STYLE: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'center',
    gap: '12px',
};

const PRIMARY_BUTTON_STYLE: React.CSSProperties = {
    padding: '10px 16px',
    borderRadius: '8px',
    border: '1px solid #2b2f3a',
    background: '#1f2430',
    color: '#f2f2f2',
    cursor: 'pointer',
    fontSize: '14px',
};

const SECONDARY_BUTTON_STYLE: React.CSSProperties = {
    padding: '10px 16px',
    borderRadius: '8px',
    border: '1px solid #2b2f3a',
    background: 'transparent',
    color: '#c7cbd6',
    cursor: 'pointer',
    fontSize: '14px',
};
