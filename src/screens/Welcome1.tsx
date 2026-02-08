import React, { useEffect } from 'react';
import { useFullscreen } from '../hooks/useFullscreen';
import { ONBOARDING_SPLASH_MS } from '../config/env';
import { SHOW_WELCOME1_FULLSCREEN_PROMPT } from '../config/onboardingUiFlags';
import { TypingCursor } from '../components/TypingCursor';

type Welcome1Props = {
    onNext: () => void;
    onSkip: () => void;
};

export const Welcome1: React.FC<Welcome1Props> = ({ onNext, onSkip }) => {
    void onSkip;
    const { enterFullscreen, isFullscreen } = useFullscreen();

    const SUBTITLE_TEXT = 'Antarmuka Pengetahuan Dua Dimensi';
    const CURSOR_DELAY_MS = 500;
    const [hasFullscreenDecision, setHasFullscreenDecision] = React.useState(false);
    const [isFullscreenPromptOpen, setIsFullscreenPromptOpen] = React.useState(
        SHOW_WELCOME1_FULLSCREEN_PROMPT && !isFullscreen
    );
    const [showCursor, setShowCursor] = React.useState(false);

    useEffect(() => {
        if (!hasFullscreenDecision) return;
        const timer = setTimeout(() => {
            onNext();
        }, ONBOARDING_SPLASH_MS);

        return () => clearTimeout(timer);
    }, [hasFullscreenDecision, onNext]);

    useEffect(() => {
        if (!SHOW_WELCOME1_FULLSCREEN_PROMPT) {
            setIsFullscreenPromptOpen(false);
            setHasFullscreenDecision(true);
            return;
        }
        if (isFullscreen) {
            setIsFullscreenPromptOpen(false);
            setHasFullscreenDecision(true);
        }
    }, [isFullscreen]);

    useEffect(() => {
        const timer = setTimeout(() => {
            setShowCursor(true);
        }, CURSOR_DELAY_MS);

        return () => clearTimeout(timer);
    }, []);

    const handleActivateFullscreen = React.useCallback(() => {
        enterFullscreen()
            .catch((e: unknown) => {
                console.warn('[welcome1] Fullscreen activation blocked:', e);
            })
            .finally(() => {
                setIsFullscreenPromptOpen(false);
                setHasFullscreenDecision(true);
            });
    }, [enterFullscreen]);

    const handleStayWindowed = React.useCallback(() => {
        setIsFullscreenPromptOpen(false);
        setHasFullscreenDecision(true);
    }, []);

    return (
        <div style={ROOT_STYLE}>
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
                    {showCursor ? (
                        <TypingCursor
                            mode="normal"
                            heightEm={1.8}
                            style={CURSOR_STYLE}
                        />
                    ) : null}
                </div>
            </div>
            {SHOW_WELCOME1_FULLSCREEN_PROMPT && isFullscreenPromptOpen ? (
                <div style={FULLSCREEN_PROMPT_BACKDROP_STYLE} onPointerDown={(e) => e.stopPropagation()}>
                    <div style={FULLSCREEN_PROMPT_CARD_STYLE} onPointerDown={(e) => e.stopPropagation()}>
                        <div style={FULLSCREEN_PROMPT_TITLE_STYLE}>Activate interface in full-screen mode?</div>
                        <div style={FULLSCREEN_PROMPT_TEXT_STYLE}>
                            Full-screen keeps the onboarding view stable and immersive.
                        </div>
                        <div style={FULLSCREEN_PROMPT_BUTTON_ROW_STYLE}>
                            <button
                                type="button"
                                style={FULLSCREEN_PROMPT_PRIMARY_BUTTON_STYLE}
                                onPointerDown={(e) => e.stopPropagation()}
                                onClick={handleActivateFullscreen}
                            >
                                Yes, activate
                            </button>
                            <button
                                type="button"
                                style={FULLSCREEN_PROMPT_SECONDARY_BUTTON_STYLE}
                                onPointerDown={(e) => e.stopPropagation()}
                                onClick={handleStayWindowed}
                            >
                                No, stay in same screen
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
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
    position: 'relative',
};

const SUBTITLE_TEXT_STYLE: React.CSSProperties = {
    fontSize: '27px',
    fontWeight: 400,
    letterSpacing: '0.3px',
    fontFamily: 'var(--font-ui)',
    color: '#b9bcc5',
};

const CURSOR_STYLE: React.CSSProperties = {
    position: 'absolute',
    right: '-12px',
    top: '50%',
    transform: 'translateY(-50%)',
};

const FULLSCREEN_PROMPT_BACKDROP_STYLE: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(3, 4, 8, 0.58)',
    zIndex: 20,
};

const FULLSCREEN_PROMPT_BASE_FONT_SIZE_PX = 14;
const FULLSCREEN_PROMPT_UNIFIED_FONT_SIZE_PX = FULLSCREEN_PROMPT_BASE_FONT_SIZE_PX * 1.2;
const FULLSCREEN_PROMPT_BUTTON_FONT_SIZE_PX = FULLSCREEN_PROMPT_UNIFIED_FONT_SIZE_PX * 0.9;
const FULLSCREEN_PROMPT_CARD_PADDING_PX = 24;
const FULLSCREEN_PROMPT_BUTTON_TO_TEXT_GAP_PX = 14;

const FULLSCREEN_PROMPT_CARD_STYLE: React.CSSProperties = {
    width: 'min(560px, calc(100vw - 48px))',
    background: '#06060A',
    border: '1px solid rgba(120, 145, 189, 0.34)',
    borderRadius: '14px',
    padding: `${FULLSCREEN_PROMPT_CARD_PADDING_PX}px`,
    boxShadow: '0 18px 52px rgba(0, 0, 0, 0.62), inset 0 0 0 1px rgba(99, 171, 255, 0.08)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
    color: '#ffffff',
    textAlign: 'center',
    fontFamily: 'var(--font-ui)',
};

const FULLSCREEN_PROMPT_TITLE_STYLE: React.CSSProperties = {
    fontSize: `${FULLSCREEN_PROMPT_UNIFIED_FONT_SIZE_PX}px`,
    fontWeight: 500,
    lineHeight: 1.45,
    color: '#ffffff',
};

const FULLSCREEN_PROMPT_TEXT_STYLE: React.CSSProperties = {
    fontSize: `${FULLSCREEN_PROMPT_UNIFIED_FONT_SIZE_PX}px`,
    lineHeight: 1.55,
    color: '#ffffff',
};

const FULLSCREEN_PROMPT_BUTTON_ROW_STYLE: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '10px',
    marginTop: `${FULLSCREEN_PROMPT_BUTTON_TO_TEXT_GAP_PX}px`,
};

const FULLSCREEN_PROMPT_PRIMARY_BUTTON_STYLE: React.CSSProperties = {
    padding: '10px 16px',
    borderRadius: '9px',
    border: '1px solid rgba(109, 166, 255, 0.58)',
    background: 'rgba(29, 64, 124, 0.55)',
    color: '#ffffff',
    fontSize: `${FULLSCREEN_PROMPT_BUTTON_FONT_SIZE_PX}px`,
    fontFamily: 'var(--font-ui)',
    cursor: 'pointer',
};

const FULLSCREEN_PROMPT_SECONDARY_BUTTON_STYLE: React.CSSProperties = {
    padding: '10px 16px',
    borderRadius: '9px',
    border: '1px solid rgba(122, 137, 170, 0.44)',
    background: 'rgba(21, 28, 45, 0.55)',
    color: '#ffffff',
    fontSize: `${FULLSCREEN_PROMPT_BUTTON_FONT_SIZE_PX}px`,
    fontFamily: 'var(--font-ui)',
    cursor: 'pointer',
};
