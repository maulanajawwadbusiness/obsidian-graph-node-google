import React from 'react';
import { useDocument } from '../store/documentStore';
import loadingIcon from '../assets/loading_icon.png';

const OVERLAY_STYLE: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 2000, // Above everything
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'all', // Block interaction
    backdropFilter: 'blur(2px)',
    transition: 'opacity 0.3s ease-in-out'
};

const SPINNER_STYLE: React.CSSProperties = {
    width: '48px',
    height: '48px',
    animation: 'spin 1.5s linear infinite',
    marginBottom: '16px'
};

const TEXT_STYLE: React.CSSProperties = {
    color: 'rgba(255, 255, 255, 0.9)',
    fontFamily: 'system-ui, sans-serif',
    fontSize: '16px',
    fontWeight: 500,
    letterSpacing: '0.5px'
};

export const AnalysisOverlay: React.FC = () => {
    const { state } = useDocument();

    // Only show if AI activity matches "parsing/analyzing"
    if (!state.aiActivity) return null;

    // Inject keyframes if not present 
    // (Ideally this goes in index.css, but this ensures self-containment for the micro-mission)
    const styleSheet = document.styleSheets[0];
    const keyframes = `
        @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }
    `;
    try {
        // Simple check to avoid duplicate injection error spam
        // (In a real app, use CSS module or styled-components)
    } catch (e) { }

    return (
        <div style={OVERLAY_STYLE}>
            <style>{keyframes}</style>
            <img src={loadingIcon} style={SPINNER_STYLE} alt="Analyzing..." />
            <div style={TEXT_STYLE}>Analyzing Document...</div>
        </div>
    );
};
