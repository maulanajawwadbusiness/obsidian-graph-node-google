import React, { useEffect, useState, useMemo } from 'react';
import { useFullscreen } from '../hooks/useFullscreen';
import { ONBOARDING_SPLASH_MS } from '../config/env';
import { SHOW_WELCOME1_FULLSCREEN_PROMPT } from '../config/onboardingUiFlags';
import { TypingCursor } from '../components/TypingCursor';
import { t } from '../i18n/t';

// ===========================================================================
// Responsive hook for screen width detection
// ===========================================================================
const WIDE_SCREEN_BREAKPOINT = 768; // px - screens wider than this use large card

function useIsWideScreen(): boolean {
    const [isWide, setIsWide] = useState(() => window.innerWidth > WIDE_SCREEN_BREAKPOINT);

    useEffect(() => {
        const handleResize = () => setIsWide(window.innerWidth > WIDE_SCREEN_BREAKPOINT);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    return isWide;
}

const WELCOME1_FULLSCREEN_PROMPT_SEEN_KEY = 'arnvoid_welcome1_fullscreen_prompt_seen_v1';

function canUseBrowserStorage(): boolean {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function hasSeenWelcome1FullscreenPrompt(): boolean {
    if (!canUseBrowserStorage()) return false;
    try {
        return window.localStorage.getItem(WELCOME1_FULLSCREEN_PROMPT_SEEN_KEY) === '1';
    } catch {
        return false;
    }
}

function markWelcome1FullscreenPromptSeen(): void {
    if (!canUseBrowserStorage()) return;
    try {
        window.localStorage.setItem(WELCOME1_FULLSCREEN_PROMPT_SEEN_KEY, '1');
    } catch {
        // Ignore storage failures. Prompt behavior falls back safely.
    }
}

type Welcome1Props = {
    onNext: () => void;
    onSkip: () => void;
    onOverlayOpenChange?: (open: boolean) => void;
};

export const Welcome1: React.FC<Welcome1Props> = ({ onNext, onSkip, onOverlayOpenChange }) => {
    void onSkip;
    const { enterFullscreen, isFullscreen } = useFullscreen();
    const isWideScreen = useIsWideScreen();
    const shouldShowFullscreenPrompt = React.useMemo(() => {
        if (!SHOW_WELCOME1_FULLSCREEN_PROMPT) return false;
        if (isFullscreen) return false;
        return !hasSeenWelcome1FullscreenPrompt();
    }, [isFullscreen]);

    const TITLE_LINE_1 = t('onboarding.welcome1.brand_title_line1');
    const TITLE_LINE_2 = t('onboarding.welcome1.brand_title_line2');
    const CURSOR_DELAY_MS = 500;
    const [hasFullscreenDecision, setHasFullscreenDecision] = React.useState(!shouldShowFullscreenPrompt);
    const [isFullscreenPromptOpen, setIsFullscreenPromptOpen] = React.useState(shouldShowFullscreenPrompt);
    const [showCursor, setShowCursor] = React.useState(false);

    // Responsive card width
    const cardBaseWidth = isWideScreen ? 180 * 3 : 180;
    const cardStyle = useMemo(() => getCardStyle(cardBaseWidth), [cardBaseWidth]);

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

    useEffect(() => {
        onOverlayOpenChange?.(SHOW_WELCOME1_FULLSCREEN_PROMPT && isFullscreenPromptOpen);
    }, [isFullscreenPromptOpen, onOverlayOpenChange]);

    useEffect(() => {
        return () => {
            onOverlayOpenChange?.(false);
        };
    }, [onOverlayOpenChange]);

    const handleActivateFullscreen = React.useCallback(() => {
        markWelcome1FullscreenPromptSeen();
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
        markWelcome1FullscreenPromptSeen();
        setIsFullscreenPromptOpen(false);
        setHasFullscreenDecision(true);
    }, []);

    return (
        <div style={ROOT_STYLE}>
            <div style={CONTENT_STYLE}>
                <div style={TITLE_STYLE}>{TITLE_LINE_1}</div>

                <div style={SUBTITLE_WRAPPER_STYLE}>
                    <span
                        id="welcome1-subtitle-text"
                        className="welcome1-typable-text"
                        style={SUBTITLE_TEXT_STYLE}
                    >
                        {TITLE_LINE_2}
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
                    <div style={cardStyle} onPointerDown={(e) => e.stopPropagation()}>
                        <div style={FULLSCREEN_PROMPT_TITLE_STYLE}>{t('onboarding.welcome1.fullscreen_prompt.title')}</div>
                        <div style={FULLSCREEN_PROMPT_TEXT_STYLE}>
                            {t('onboarding.welcome1.fullscreen_prompt.desc')}
                        </div>
                        <div style={FULLSCREEN_PROMPT_BUTTON_ROW_STYLE}>
                            <button
                                type="button"
                                style={FULLSCREEN_PROMPT_PRIMARY_BUTTON_STYLE}
                                onPointerDown={(e) => e.stopPropagation()}
                                onClick={handleActivateFullscreen}
                            >
                                {t('onboarding.welcome1.fullscreen_prompt.cta_yes')}
                            </button>
                            <button
                                type="button"
                                style={FULLSCREEN_PROMPT_SECONDARY_BUTTON_STYLE}
                                onPointerDown={(e) => e.stopPropagation()}
                                onClick={handleStayWindowed}
                            >
                                {t('onboarding.welcome1.fullscreen_prompt.cta_no')}
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
    position: 'fixed',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(3, 4, 8, 0.58)',
    zIndex: 3000,
    pointerEvents: 'auto',
};

// ===========================================================================
// TUNING KNOBS - Adjust these to fine-tune the card appearance
// ===========================================================================
const CARD_SCALE = 1.2;           // Scale entire card (1.0 = base size)
const CONTENT_SCALE = 0.9;        // Scale inner elements (1.0 = normal, 0.8 = 20% smaller)
const CARD_PADDING_H = 35;        // Horizontal padding in px (left/right)
const CARD_PADDING_V = 72;        // Vertical padding in px (top/bottom)
// CARD_BASE_WIDTH is now responsive: 540 on wide screens, 180 on narrow (set in component)
const CARD_RADIUS = 12;           // Card corner radius in px
const BUTTON_RADIUS = 8;          // Button corner radius in px
const BUTTON_PADDING_V = 9;       // Button vertical padding in px
const BUTTON_PADDING_H = 20;      // Button horizontal padding in px
const BUTTON_FONT_SIZE = 12;      // Button font size in px
// --- Spacing tuning ---
const TITLE_DESC_GAP = 12;        // Gap between title and description in px
const BUTTON_GAP = 16;            // Gap between buttons in px
// ===========================================================================

function getCardStyle(cardBaseWidth: number): React.CSSProperties {
    return {
        width: `min(${cardBaseWidth * CARD_SCALE}px, calc(100vw - 48px))`,
        background: '#06060A',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: `${CARD_RADIUS * CARD_SCALE}px`,
        padding: `${CARD_PADDING_V * CARD_SCALE}px ${CARD_PADDING_H * CARD_SCALE}px`,
        boxShadow: '0 24px 64px rgba(0, 0, 0, 0.7)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        color: '#ffffff',
        textAlign: 'center',
        fontFamily: 'var(--font-ui)',
    };
}

const FULLSCREEN_PROMPT_TITLE_STYLE: React.CSSProperties = {
    fontSize: `${15 * CARD_SCALE * CONTENT_SCALE}px`,
    fontWeight: 600,
    letterSpacing: `${0.5 * CARD_SCALE * CONTENT_SCALE}px`,
    lineHeight: 1.45,
    color: '#e7e7e7',
};

const FULLSCREEN_PROMPT_TEXT_STYLE: React.CSSProperties = {
    fontSize: `${13 * CARD_SCALE * CONTENT_SCALE}px`,
    lineHeight: 1.55,
    marginTop: `${TITLE_DESC_GAP * CARD_SCALE * CONTENT_SCALE}px`,
    color: 'rgba(255, 255, 255, 0.55)',
};

const FULLSCREEN_PROMPT_BUTTON_ROW_STYLE: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: `${BUTTON_GAP * CARD_SCALE * CONTENT_SCALE}px`,
    marginTop: 'auto',
    paddingTop: `${24 * CARD_SCALE * CONTENT_SCALE}px`,
    width: '100%',
};

const FULLSCREEN_PROMPT_PRIMARY_BUTTON_STYLE: React.CSSProperties = {
    width: '100%',
    padding: `${BUTTON_PADDING_V * CARD_SCALE * CONTENT_SCALE}px ${BUTTON_PADDING_H * CARD_SCALE * CONTENT_SCALE}px`,
    borderRadius: `${BUTTON_RADIUS * CARD_SCALE * CONTENT_SCALE}px`,
    border: '1px solid #63acffff',
    background: 'transparent',
    color: '#ffffff',
    fontSize: `${BUTTON_FONT_SIZE * CARD_SCALE * CONTENT_SCALE}px`,
    fontFamily: 'var(--font-ui)',
    cursor: 'pointer',
};

const FULLSCREEN_PROMPT_SECONDARY_BUTTON_STYLE: React.CSSProperties = {
    width: '100%',
    padding: `${BUTTON_PADDING_V * CARD_SCALE * CONTENT_SCALE}px ${BUTTON_PADDING_H * CARD_SCALE * CONTENT_SCALE}px`,
    borderRadius: `${BUTTON_RADIUS * CARD_SCALE * CONTENT_SCALE}px`,
    border: '1px solid rgba(255, 255, 255, 0.1)',
    background: 'transparent',
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: `${BUTTON_FONT_SIZE * CARD_SCALE * CONTENT_SCALE}px`,
    fontFamily: 'var(--font-ui)',
    cursor: 'pointer',
};
