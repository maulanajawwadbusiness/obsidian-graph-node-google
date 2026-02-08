import React from 'react';
import { LoginOverlay } from '../auth/LoginOverlay';
import { useAuth } from '../auth/AuthProvider';
import { PromptCard } from '../components/PromptCard';
import { PaymentGopayPanel } from '../components/PaymentGopayPanel';
import { SHOW_ENTERPROMPT_PAYMENT_PANEL } from '../config/onboardingUiFlags';
import { t } from '../i18n/t';

type EnterPromptProps = {
    onEnter: () => void;
    onBack: () => void;
    onSkip: () => void;
    onOverlayOpenChange?: (open: boolean) => void;
};

export const EnterPrompt: React.FC<EnterPromptProps> = ({ onEnter, onBack, onSkip, onOverlayOpenChange }) => {
    const { user } = useAuth();
    const [isOverlayHidden, setIsOverlayHidden] = React.useState(false);
    const loginOverlayOpen = !user && !isOverlayHidden;

    React.useEffect(() => {
        onOverlayOpenChange?.(loginOverlayOpen);
    }, [loginOverlayOpen, onOverlayOpenChange]);

    React.useEffect(() => {
        return () => {
            onOverlayOpenChange?.(false);
        };
    }, [onOverlayOpenChange]);

    return (
        <div style={ROOT_STYLE}>
            <div style={SIDEBAR_STYLE}>
                <div style={SIDEBAR_CONTENT_STYLE}>
                    <div style={SIDEBAR_LABEL_STYLE}>{t('onboarding.enterprompt.sidebar_label')}</div>
                </div>
            </div>

            <PromptCard />
            {SHOW_ENTERPROMPT_PAYMENT_PANEL ? <PaymentGopayPanel /> : null}

            <LoginOverlay
                open={loginOverlayOpen}
                onContinue={onEnter}
                onBack={onBack}
                onSkip={onSkip}
                onHide={() => setIsOverlayHidden(true)}
            />
        </div>
    );
};

const ROOT_STYLE: React.CSSProperties = {
    display: 'flex',
    width: '100%',
    minHeight: '100vh',
    background: '#06060A',
    color: '#e7e7e7',
};

const SIDEBAR_STYLE: React.CSSProperties = {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: '35px',
    background: '#06060A',
    borderRight: '1px solid rgba(255, 255, 255, 0.1)',
    display: 'flex',
    flexDirection: 'column',
    zIndex: 50,
};

const SIDEBAR_CONTENT_STYLE: React.CSSProperties = {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
};

const SIDEBAR_LABEL_STYLE: React.CSSProperties = {
    fontSize: '11px',
    color: 'rgba(255, 255, 255, 0.15)',
    fontFamily: 'var(--font-ui)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
};
