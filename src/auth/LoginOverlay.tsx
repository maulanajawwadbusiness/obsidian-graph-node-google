import React from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from './AuthProvider';
import { GoogleLoginButton } from '../components/GoogleLoginButton';
import { SHOW_ONBOARDING_AUX_BUTTONS } from '../config/onboardingUiFlags';
import { t } from '../i18n/t';
import { LAYER_OVERLAY_LOGIN } from '../ui/layers';
import { usePortalRootEl, usePortalScopeMode } from '../components/portalScope/PortalScopeContext';
import {
    isOverlayFadeEnabledForScreen,
    ONBOARDING_FADE_EASING,
    ONBOARDING_FADE_MS,
} from '../screens/appshell/transitions/transitionContract';

const SHOW_LOGIN_DEBUG_ERRORS =
    import.meta.env.VITE_SHOW_LOGIN_DEBUG_ERRORS === '1' || !import.meta.env.DEV;

type LoginOverlayProps = {
    open: boolean;
    mode?: 'prompt';
    onContinue?: () => void;
    onBack?: () => void;
    onSkip?: () => void;
    onHide?: () => void;
};

export const LoginOverlay: React.FC<LoginOverlayProps> = ({
    open,
    onContinue: _onContinue,
    onBack,
    onSkip,
    onHide,
}) => {
    const { user, loading, error } = useAuth();
    const portalRoot = usePortalRootEl();
    const portalMode = usePortalScopeMode();
    const overlayFadeEnabled = isOverlayFadeEnabledForScreen('prompt');
    const [prefersReducedMotion, setPrefersReducedMotion] = React.useState(false);
    const [fadeInReady, setFadeInReady] = React.useState(false);
    const fadeRafRef = React.useRef<number | null>(null);

    React.useEffect(() => {
        if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
        const media = window.matchMedia('(prefers-reduced-motion: reduce)');
        const applyMatch = () => setPrefersReducedMotion(media.matches);
        applyMatch();
        const listener = () => applyMatch();
        if (typeof media.addEventListener === 'function') {
            media.addEventListener('change', listener);
            return () => media.removeEventListener('change', listener);
        }
        media.addListener(listener);
        return () => media.removeListener(listener);
    }, []);

    React.useEffect(() => {
        if (!open || portalMode === 'container') return;
        const previous = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = previous;
        };
    }, [open, portalMode]);

    React.useEffect(() => {
        if (fadeRafRef.current !== null) {
            window.cancelAnimationFrame(fadeRafRef.current);
            fadeRafRef.current = null;
        }
        if (!open) {
            setFadeInReady(false);
            return;
        }
        if (prefersReducedMotion) {
            setFadeInReady(true);
            return;
        }
        setFadeInReady(false);
        fadeRafRef.current = window.requestAnimationFrame(() => {
            fadeRafRef.current = null;
            setFadeInReady(true);
        });
        return () => {
            if (fadeRafRef.current !== null) {
                window.cancelAnimationFrame(fadeRafRef.current);
                fadeRafRef.current = null;
            }
        };
    }, [open, prefersReducedMotion]);

    if (!open) return null;

    const overlay = (
        <div
            style={{
                ...BACKDROP_STYLE,
                ...(portalMode === 'container' ? BACKDROP_STYLE_CONTAINER : null),
                opacity: fadeInReady ? 1 : 0,
                transition: prefersReducedMotion || !overlayFadeEnabled
                    ? 'none'
                    : `opacity ${ONBOARDING_FADE_MS}ms ${ONBOARDING_FADE_EASING}`,
                willChange: 'opacity',
            }}
            onPointerDown={(e) => e.stopPropagation()}
            onWheel={(e) => e.stopPropagation()}
        >
            <div style={CARD_STYLE} onPointerDown={(e) => e.stopPropagation()}>
                <div style={TITLE_STYLE}>{t('onboarding.enterprompt.login.title')}</div>
                <div style={SUBTEXT_STYLE}>{t('onboarding.enterprompt.login.desc')}</div>

                {loading && (
                    <div style={STATUS_STYLE}>{t('onboarding.enterprompt.login.status_checking')}</div>
                )}

                {!loading && !user && (
                    <GoogleLoginButton />
                )}

                {!loading && user && (
                    <div style={SIGNED_IN_STYLE}>
                        {user.picture ? (
                            <img
                                src={user.picture as string}
                                alt="avatar"
                                style={AVATAR_STYLE}
                            />
                        ) : null}
                        <div style={SIGNED_IN_TEXT_STYLE}>
                            <div style={SIGNED_IN_LABEL_STYLE}>{t('onboarding.enterprompt.login.signed_in_label')}</div>
                            <div>{user.name || user.email || t('onboarding.enterprompt.login.user_unknown')}</div>
                        </div>
                    </div>
                )}

                {SHOW_LOGIN_DEBUG_ERRORS && error && (
                    <div style={ERROR_STYLE}>{error}</div>
                )}

                <div style={BUTTON_ROW_STYLE}>
                    {SHOW_ONBOARDING_AUX_BUTTONS && onHide && (
                        <button
                            type="button"
                            style={SECONDARY_BUTTON_STYLE}
                            onClick={onHide}
                        >
                            {t('onboarding.enterprompt.login.button_hide')}
                        </button>
                    )}
                    {SHOW_ONBOARDING_AUX_BUTTONS && onBack && (
                        <button
                            type="button"
                            style={SECONDARY_BUTTON_STYLE}
                            onClick={onBack}
                        >
                            {t('onboarding.enterprompt.login.button_back')}
                        </button>
                    )}
                    <button
                        type="button"
                        style={PRIMARY_BUTTON_STYLE}
                        aria-disabled={true}
                        tabIndex={-1}
                    >
                        {t('onboarding.enterprompt.login.button_continue')}
                    </button>
                    {SHOW_ONBOARDING_AUX_BUTTONS && onSkip && (
                        <button
                            type="button"
                            style={SECONDARY_BUTTON_STYLE}
                            onClick={onSkip}
                        >
                            {t('onboarding.enterprompt.login.button_skip')}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );

    if (typeof document === 'undefined') {
        return overlay;
    }
    return createPortal(overlay, portalRoot);
};

const BACKDROP_STYLE: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(8, 10, 14, 0.72)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: LAYER_OVERLAY_LOGIN,
    pointerEvents: 'auto',
};

const CARD_STYLE: React.CSSProperties = {
    width: '100%',
    maxWidth: '420px',
    background: '#06060A',
    border: '1px solid #242a36',
    borderRadius: '12px',
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    color: '#e7e7e7',
    textAlign: 'center',
};

const TITLE_STYLE: React.CSSProperties = {
    fontSize: '20px',
    fontWeight: 300,
};

const BACKDROP_STYLE_CONTAINER: React.CSSProperties = {
    position: 'absolute',
};

const SUBTEXT_STYLE: React.CSSProperties = {
    fontSize: '14px',
    color: '#b9bcc5',
};

const STATUS_STYLE: React.CSSProperties = {
    fontSize: '13px',
    color: '#9aa0ad',
};

const ERROR_STYLE: React.CSSProperties = {
    fontSize: '12px',
    color: '#ff6b6b',
};

const SIGNED_IN_STYLE: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    padding: '10px',
    borderRadius: '8px',
    background: '#141923',
    border: '1px solid #2b2f3a',
};

const SIGNED_IN_TEXT_STYLE: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    textAlign: 'left',
};

const SIGNED_IN_LABEL_STYLE: React.CSSProperties = {
    fontSize: '11px',
    color: '#9aa0ad',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
};

const AVATAR_STYLE: React.CSSProperties = {
    width: '32px',
    height: '32px',
    borderRadius: '16px',
};

const BUTTON_ROW_STYLE: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'center',
    gap: '10px',
    flexWrap: 'wrap',
    marginTop: '6px',
    marginBottom: '6px',
};

const PRIMARY_BUTTON_STYLE: React.CSSProperties = {
    padding: '10px 16px',
    borderRadius: '8px',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    background: '#06060A',
    color: '#f2f2f2',
    cursor: 'pointer',
    opacity: 1,
    pointerEvents: 'auto',
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
