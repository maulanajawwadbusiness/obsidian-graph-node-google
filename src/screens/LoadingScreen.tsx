import React, { useEffect } from 'react';
import loadingIcon from '../assets/loading_icon.png';

type LoadingScreenProps = {
    errorMessage?: string | null;
};

const ROOT_STYLE: React.CSSProperties = {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#0f1115',
    color: '#e7e7e7',
};

const SPINNER_STYLE: React.CSSProperties = {
    width: '56px',
    height: '56px',
    animation: 'spin 1.5s linear infinite',
    marginBottom: '16px',
};

const TEXT_STYLE: React.CSSProperties = {
    color: 'rgba(255, 255, 255, 0.9)',
    fontFamily: 'var(--font-ui)',
    fontSize: '16px',
    fontWeight: 500,
    letterSpacing: '0.5px',
};

const STYLE_TAG_ID = 'loading-screen-styles';

export const LoadingScreen: React.FC<LoadingScreenProps> = ({ errorMessage }) => {
    useEffect(() => {
        if (typeof document === 'undefined') return;
        if (document.getElementById(STYLE_TAG_ID)) return;
        const style = document.createElement('style');
        style.id = STYLE_TAG_ID;
        style.textContent = `
            @keyframes spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
            }
        `;
        document.head.appendChild(style);
    }, []);

    return (
        <div style={ROOT_STYLE} data-font="ui">
            {errorMessage ? null : <img src={loadingIcon} style={SPINNER_STYLE} alt="Loading" />}
            <div style={TEXT_STYLE}>
                {errorMessage ? errorMessage : 'Preparing your graph...'}
            </div>
        </div>
    );
};
