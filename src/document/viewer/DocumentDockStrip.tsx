import React, { useState } from 'react';
import { useDocument } from '../../store/documentStore';

/**
 * Document Dock Strip - Three-Layer Left Presence Strip
 * Layer 1: Spine (12px gradient) - always visible
 * Layer 2: Handle pill (22px × 64px) - always visible, toggles viewer
 * Layer 3: Peek sliver (32px) - only when doc loaded + peek mode
 * 
 * The viewer is an organ, not a modal. It never fully disappears.
 */

const stopPropagation = (e: React.MouseEvent) => e.stopPropagation();

export const DocumentDockStrip: React.FC = () => {
    const { state, toggleViewer } = useDocument();
    const [isSpineHovered, setIsSpineHovered] = useState(false);
    const [isHandleHovered, setIsHandleHovered] = useState(false);

    const isPeek = state.viewerMode === 'peek';
    const hasDocument = !!state.activeDocument;

    // Spine (Layer 1) - 12px, always visible
    const spineStyle: React.CSSProperties = {
        position: 'absolute',
        top: 0,
        left: 0,
        bottom: 0,
        width: '12px',
        background: 'linear-gradient(to right, rgba(var(--panel-bg-rgb), 0.0), rgba(var(--panel-bg-rgb), 0.42))',
        borderRight: '1px solid rgba(99, 171, 255, 0.22)',
        cursor: 'ew-resize',
        zIndex: 200,
        transition: 'filter 120ms ease-out',
        filter: isSpineHovered ? 'brightness(1.4)' : 'brightness(1)',
        // Subtle inner glow on right edge
        boxShadow: isSpineHovered
            ? 'inset -1px 0 2px rgba(99, 171, 255, 0.15)'
            : 'inset -1px 0 1px rgba(99, 171, 255, 0.08)',
    };

    // Handle pill (Layer 2) - 22px × 64px, always visible
    const handleStyle: React.CSSProperties = {
        position: 'absolute',
        top: '50%',
        left: '2px',
        transform: 'translateY(-50%)',
        width: '22px',
        height: '64px',
        borderRadius: '999px',
        background: isHandleHovered ? 'rgba(255, 255, 255, 0.10)' : 'rgba(255, 255, 255, 0.06)',
        border: isHandleHovered ? '1px solid rgba(255, 255, 255, 0.16)' : '1px solid rgba(255, 255, 255, 0.10)',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '2px',
        transition: 'all 120ms ease-out',
        boxShadow: isHandleHovered
            ? '0 2px 8px rgba(0, 0, 0, 0.25), 0 1px 3px rgba(0, 0, 0, 0.35)'
            : '0 1px 4px rgba(0, 0, 0, 0.20), 0 0.5px 2px rgba(0, 0, 0, 0.25)',
        zIndex: 201,
    };

    // Chevron icon - points right (peek) or left (open)
    const chevronStyle: React.CSSProperties = {
        width: '10px',
        height: '10px',
        borderTop: '1.5px solid rgba(255, 255, 255, 0.6)',
        borderRight: '1.5px solid rgba(255, 255, 255, 0.6)',
        transform: isPeek ? 'rotate(45deg)' : 'rotate(-135deg)',
        transition: 'transform 180ms ease-out',
        marginLeft: isPeek ? '-2px' : '2px',
    };

    // Loaded indicator dot - 6px, shows when doc loaded
    const dotStyle: React.CSSProperties = {
        position: 'absolute',
        top: '8px',
        right: '4px',
        width: '6px',
        height: '6px',
        borderRadius: '50%',
        background: hasDocument ? 'rgba(99, 171, 255, 0.85)' : 'rgba(255, 255, 255, 0.15)',
        opacity: hasDocument ? 1 : 0.4,
        transition: 'all 180ms ease-out',
        pointerEvents: 'none',
    };

    return (
        <>
            {/* Spine (Layer 1) */}
            <div
                style={spineStyle}
                onClick={(e) => {
                    stopPropagation(e);
                    toggleViewer();
                }}
                onMouseDown={stopPropagation}
                onMouseMove={stopPropagation}
                onMouseUp={stopPropagation}
                onMouseEnter={() => setIsSpineHovered(true)}
                onMouseLeave={() => setIsSpineHovered(false)}
                aria-label="Document viewer dock"
            />

            {/* Handle pill (Layer 2) */}
            <div
                style={handleStyle}
                onClick={(e) => {
                    stopPropagation(e);
                    toggleViewer();
                }}
                onMouseDown={stopPropagation}
                onMouseMove={stopPropagation}
                onMouseUp={stopPropagation}
                onMouseEnter={() => setIsHandleHovered(true)}
                onMouseLeave={() => setIsHandleHovered(false)}
                aria-label={`Toggle document viewer (currently ${isPeek ? 'closed' : 'open'})`}
                title={`Click to ${isPeek ? 'open' : 'close'} document viewer (Ctrl+\\)`}
            >
                {/* Loaded indicator dot */}
                <div style={dotStyle} />

                {/* Chevron icon */}
                <div style={chevronStyle} />
            </div>
        </>
    );
};
