import React from 'react';

type EnterPromptProps = {
    onEnter: () => void;
    onBack: () => void;
    onSkip: () => void;
};

export const EnterPrompt: React.FC<EnterPromptProps> = ({ onEnter, onBack, onSkip }) => {
    return (
        <div style={ROOT_STYLE}>
            <div style={CARD_STYLE}>
                <div style={TITLE_STYLE}>Enter Prompt</div>
                <div style={BODY_STYLE}>
                    Placeholder page. Login overlay will be added later.
                </div>
                <div style={INPUT_PLACEHOLDER_STYLE}>Prompt input placeholder</div>
                <div style={BUTTON_ROW_STYLE}>
                    <button type="button" style={SECONDARY_BUTTON_STYLE} onClick={onBack}>
                        Back
                    </button>
                    <button type="button" style={PRIMARY_BUTTON_STYLE} onClick={onEnter}>
                        Enter
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
    fontSize: '28px',
    fontWeight: 700,
    letterSpacing: '0.5px',
};

const BODY_STYLE: React.CSSProperties = {
    fontSize: '16px',
    lineHeight: 1.6,
    color: '#b9bcc5',
};

const INPUT_PLACEHOLDER_STYLE: React.CSSProperties = {
    padding: '12px 14px',
    borderRadius: '8px',
    border: '1px solid #2b2f3a',
    background: '#141923',
    color: '#7f8796',
    fontSize: '14px',
};

const BUTTON_ROW_STYLE: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'center',
    gap: '12px',
    flexWrap: 'wrap',
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
