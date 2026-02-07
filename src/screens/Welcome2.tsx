import React from 'react';
import { DEFAULT_CADENCE } from '../config/onboardingCadence';
import { useTypedTimeline } from '../hooks/useTypedTimeline';
import { MANIFESTO_TEXT } from './welcome2ManifestoText';
import { buildWelcome2Timeline } from './welcome2Timeline';

type Welcome2Props = {
    onNext: () => void;
    onSkip: () => void;
    onBack: () => void;
};

export const Welcome2: React.FC<Welcome2Props> = ({ onNext, onSkip, onBack }) => {
    void onNext;
    const builtTimeline = React.useMemo(
        () => buildWelcome2Timeline(MANIFESTO_TEXT, DEFAULT_CADENCE),
        []
    );
    const { visibleText } = useTypedTimeline(builtTimeline);

    return (
        <div style={ROOT_STYLE}>
            <div style={CONTENT_STYLE}>
                <div
                    id="welcome2-manifesto-text"
                    className="welcome2-typable-text"
                    style={TEXT_STYLE}
                >
                    <span>{visibleText}</span>
                    <span style={CURSOR_STYLE}>|</span>
                </div>

                <div style={BUTTON_ROW_STYLE}>
                    <button type="button" style={BUTTON_STYLE} onClick={onBack}>
                        Back
                    </button>
                    <button type="button" style={BUTTON_STYLE} onClick={onSkip}>
                        Skip
                    </button>
                </div>
            </div>
        </div>
    );
};

const ROOT_STYLE: React.CSSProperties = {
    minHeight: '100vh',
    width: '100%',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    padding: '64px',
    background: '#06060A',
    color: '#e7e7e7',
    boxSizing: 'border-box',
};

const CONTENT_STYLE: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '40px',
    maxWidth: '760px',
    width: '100%',
};

const TEXT_STYLE: React.CSSProperties = {
    fontSize: '18px',
    lineHeight: 1.8,
    color: '#b9bcc5',
    whiteSpace: 'pre-wrap',
    fontFamily: 'var(--font-ui)',
};

const CURSOR_STYLE: React.CSSProperties = {
    color: '#63abff',
    animation: 'blink 1s step-end infinite',
    fontFamily: 'monospace',
};

const BUTTON_ROW_STYLE: React.CSSProperties = {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap',
};

const BUTTON_STYLE: React.CSSProperties = {
    padding: '10px 16px',
    borderRadius: '8px',
    border: '1px solid #2b2f3a',
    background: 'transparent',
    color: '#c7cbd6',
    cursor: 'pointer',
    fontSize: '14px',
    fontFamily: 'var(--font-ui)',
};
