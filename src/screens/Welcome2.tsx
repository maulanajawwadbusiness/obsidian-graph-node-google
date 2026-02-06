import React, { useEffect } from 'react';
import { ONBOARDING_MANIFESTO_MS } from '../config/env';

type Welcome2Props = {
    onNext: () => void;
    onSkip: () => void;
    onBack: () => void;
};

export const Welcome2: React.FC<Welcome2Props> = ({ onNext, onSkip, onBack }) => {
    const MANIFESTO_TEXT = `For me, I often feel tired when I read paper at 2 am.

We human has been using the same text medium over the past 50 years.

I think it is time for us to think differently on how to process information`;

    useEffect(() => {
        const timer = setTimeout(() => {
            onNext();
        }, ONBOARDING_MANIFESTO_MS);

        return () => clearTimeout(timer);
    }, [onNext]);

    return (
        <div style={ROOT_STYLE}>
            <div style={CONTENT_STYLE}>
                <div
                    id="welcome2-manifesto-text"
                    className="welcome2-typable-text"
                    style={TEXT_STYLE}
                >
                    {MANIFESTO_TEXT}
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
    background: '#0D0D16',
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
    whiteSpace: 'pre-line',
    fontFamily: 'var(--font-ui)',
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
