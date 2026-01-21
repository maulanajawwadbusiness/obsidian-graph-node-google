import React from 'react';
import { useDocument } from '../../store/documentStore';

/**
 * Document Dock Strip - Permanent 12px left edge presence
 * The viewer​ is an organ, not a modal. It never fully disappears.
 */

const stopPropagation = (e: React.MouseEvent) => e.stopPropagation();

const DOCK_STRIP_STYLE: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: '12px',
    backgroundColor: 'rgba(var(--panel-bg-rgb), var(--panel-bg-opacity))',
    cursor: 'ew-resize',
    zIndex: 200,
    transition: 'filter 120ms ease-out',
    borderRight: '1px solid rgba(99, 171, 255, 0.15)',
};

export const DocumentDockStrip: React.FC = () => {
    const { toggleViewer } = useDocument();
    const [isHovered, setIsHovered] = React.useState(false);

    const style: React.CSSProperties = {
        ...DOCK_STRIP_STYLE,
        filter: isHovered ? 'brightness(1.4)' : 'brightness(1)',
    };

    return (
        <div
            style={style}
            onClick={(e) => {
                stopPropagation(e);
                toggleViewer();
            }}
            onMouseDown={stopPropagation}
            onMouseMove={stopPropagation}
            onMouseUp={stopPropagation}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            aria-label="Toggle document viewer"
            title="Click to toggle document viewer (Ctrl+\)"
        />
    );
};
