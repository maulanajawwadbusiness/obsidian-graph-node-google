import React, { useEffect } from 'react';
import { FullscreenButton } from '../components/FullscreenButton';
import { useFullscreen } from '../hooks/useFullscreen';
import { ONBOARDING_SPLASH_MS } from '../config/env';

type Welcome1Props = {
    onNext: () => void;
    onSkip: () => void;
};

export const Welcome1: React.FC<Welcome1Props> = ({ onNext, onSkip }) => {
    void onSkip;
    const { enterFullscreen } = useFullscreen();

    const SUBTITLE_TEXT = 'Antarmuka Pengetahuan Dua Dimensi';
    const CURSOR_DELAY_MS = 500;
    const [showCursor, setShowCursor] = React.useState(false);

    useEffect(() => {
        const timer = setTimeout(() => {
            onNext();
        }, ONBOARDING_SPLASH_MS);

        return () => clearTimeout(timer);
    }, [onNext]);

    useEffect(() => {
        enterFullscreen().catch((e: unknown) => {
            console.warn('[welcome1] Auto-fullscreen blocked (user interaction required):', e);
        });
    }, [enterFullscreen]);

    useEffect(() => {
        const timer = setTimeout(() => {
            setShowCursor(true);
        }, CURSOR_DELAY_MS);

        return () => clearTimeout(timer);
    }, []);

    return (
        <div style={ROOT_STYLE}>
            <FullscreenButton />

            <div style={CONTENT_STYLE}>
                <div style={TITLE_STYLE}>Arnvoid</div>

                <div style={SUBTITLE_WRAPPER_STYLE}>
                    <span
                        id="welcome1-subtitle-text"
                        className="welcome1-typable-text"
                        style={SUBTITLE_TEXT_STYLE}
                    >
                        {SUBTITLE_TEXT}
                    </span>
                    {showCursor ? <span style={CURSOR_STYLE}>|</span> : null}
                </div>
            </div>
        </div>
    );
};

const ROOT_STYLE: React.CSSProperties = {
    position: 'relative',
    minHeight: '100vh',
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#06060A',
    color: '#e7e7e7',
    overflow: 'hidden',
};

const CONTENT_STYLE: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '16px',
    textAlign: 'center',
};

const TITLE_STYLE: React.CSSProperties = {
    fontSize: '27px',
    fontWeight: 900,
    letterSpacing: '1px',
    fontFamily: 'var(--font-ui)',
    color: '#b9bcc5',
};

const SUBTITLE_WRAPPER_STYLE: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '2px',
};

const SUBTITLE_TEXT_STYLE: React.CSSProperties = {
    fontSize: '27px',
    fontWeight: 400,
    letterSpacing: '0.3px',
    fontFamily: 'var(--font-ui)',
    color: '#b9bcc5',
};

const CURSOR_STYLE: React.CSSProperties = {
    fontSize: '27px',
    color: '#63abff',
    animation: 'blink 1s step-end infinite',
    fontFamily: 'monospace',
};
