import React from 'react';
import { useAuth } from './AuthProvider';
import { GoogleLoginButton } from '../components/GoogleLoginButton';

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
    onContinue,
    onBack,
    onSkip,
    onHide,
}) => {
    const { user, loading, error } = useAuth();

    React.useEffect(() => {
        if (!open) return;
        const previous = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = previous;
        };
    }, [open]);

    if (!open) return null;

    return (
        <div
            style={BACKDROP_STYLE}
            onPointerDown={(e) => e.stopPropagation()}
            onWheel={(e) => e.stopPropagation()}
        >
            <div style={CARD_STYLE} onPointerDown={(e) => e.stopPropagation()}>
                <div style={TITLE_STYLE}>Sign In</div>
                <div style={SUBTEXT_STYLE}>You'll be able to use a smart knowledge interface.</div>

                {loading && (
                    <div style={STATUS_STYLE}>Checking session...</div>
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
                            <div style={SIGNED_IN_LABEL_STYLE}>Signed in</div>
                            <div>{user.name || user.email || 'unknown'}</div>
                        </div>
                    </div>
                )}

                {error && (
                    <div style={ERROR_STYLE}>{error}</div>
                )}

                <div style={BUTTON_ROW_STYLE}>
                    {onHide && (
                        <button
                            type="button"
                            style={SECONDARY_BUTTON_STYLE}
                            onClick={onHide}
                        >
                            Hide
                        </button>
                    )}
                    {onBack && (
                        <button
                            type="button"
                            style={SECONDARY_BUTTON_STYLE}
                            onClick={onBack}
                        >
                            Back
                        </button>
                    )}
                    <button
                        type="button"
                        style={PRIMARY_BUTTON_STYLE}
                        onClick={onContinue}
                        disabled={!user}
                    >
                        Continue
                    </button>
                    {onSkip && (
                        <button
                            type="button"
                            style={SECONDARY_BUTTON_STYLE}
                            onClick={onSkip}
                        >
                            Skip
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

const BACKDROP_STYLE: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(8, 10, 14, 0.72)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2000,
    pointerEvents: 'auto',
};

const CARD_STYLE: React.CSSProperties = {
    width: '100%',
    maxWidth: '420px',
    background: '#0f1115',
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
    fontSize: '22px',
    fontWeight: 700,
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
