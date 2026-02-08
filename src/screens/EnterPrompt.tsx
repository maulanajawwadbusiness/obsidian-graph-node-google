import React from 'react';
import { LoginOverlay } from '../auth/LoginOverlay';
import { useAuth } from '../auth/AuthProvider';
import { PromptCard } from '../components/PromptCard';
import { PaymentGopayPanel } from '../components/PaymentGopayPanel';
import { Sidebar } from '../components/Sidebar';
import { SHOW_ENTERPROMPT_PAYMENT_PANEL } from '../config/onboardingUiFlags';

type EnterPromptProps = {
    onEnter: () => void;
    onBack: () => void;
    onSkip: () => void;
    onOverlayOpenChange?: (open: boolean) => void;
};

export const EnterPrompt: React.FC<EnterPromptProps> = ({ onEnter, onBack, onSkip, onOverlayOpenChange }) => {
    const { user } = useAuth();
    const [isOverlayHidden, setIsOverlayHidden] = React.useState(false);
    const [isSidebarExpanded, setIsSidebarExpanded] = React.useState(false);
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
            <Sidebar
                isExpanded={isSidebarExpanded}
                onToggle={() => setIsSidebarExpanded(!isSidebarExpanded)}
            />

            <PromptCard />
            {SHOW_ENTERPROMPT_PAYMENT_PANEL ? <PaymentGopayPanel /> : null}

            {/* Login overlay disabled for now */}
            {false && <LoginOverlay
                open={loginOverlayOpen}
                onContinue={onEnter}
                onBack={onBack}
                onSkip={onSkip}
                onHide={() => setIsOverlayHidden(true)}
            />}
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
