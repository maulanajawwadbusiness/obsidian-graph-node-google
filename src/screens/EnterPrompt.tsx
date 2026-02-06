import React from 'react';
import { LoginOverlay } from '../auth/LoginOverlay';
import { useAuth } from '../auth/AuthProvider';
import { PromptCard } from '../components/PromptCard';

type EnterPromptProps = {
    onEnter: () => void;
    onBack: () => void;
    onSkip: () => void;
};

export const EnterPrompt: React.FC<EnterPromptProps> = ({ onEnter, onBack, onSkip }) => {
    const { user } = useAuth();

    return (
        <div style={ROOT_STYLE}>
            <div style={SIDEBAR_STYLE}>
                <div style={SIDEBAR_CONTENT_STYLE}>
                    <div style={SIDEBAR_LABEL_STYLE}>Sidebar</div>
                </div>
            </div>

            <PromptCard lang="id" />

            <LoginOverlay
                open={!user}
                onContinue={onEnter}
                onBack={onBack}
                onSkip={onSkip}
            />
        </div>
    );
};

const ROOT_STYLE: React.CSSProperties = {
    display: 'flex',
    width: '100%',
    minHeight: '100vh',
    background: '#0D0D16',
    color: '#e7e7e7',
};

const SIDEBAR_STYLE: React.CSSProperties = {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: '280px',
    background: '#0D0D16',
    borderRight: '1px solid #1e2330',
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
    fontSize: '14px',
    color: '#5a6070',
    fontFamily: 'var(--font-ui)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
};
