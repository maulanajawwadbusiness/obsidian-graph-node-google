import React from 'react';
import { useFullscreen } from '../hooks/useFullscreen';
import fullscreenOpenIcon from '../assets/fullscreen_open_icon.png';
import fullscreenCloseIcon from '../assets/fullscreen_close_icon.png';

type FullscreenButtonProps = {
    className?: string;
    style?: React.CSSProperties;
};

export const FullscreenButton: React.FC<FullscreenButtonProps> = ({ className, style }) => {
    const { isFullscreen, toggleFullscreen } = useFullscreen();

    const handleClick = React.useCallback(() => {
        toggleFullscreen().catch((e) => {
            console.warn('[fullscreen] Toggle failed:', e);
        });
    }, [toggleFullscreen]);

    return (
        <button
            type="button"
            className={className}
            style={{
                ...BUTTON_STYLE,
                ...style,
            }}
            onClick={(e) => {
                e.stopPropagation();
                handleClick();
            }}
            onPointerDown={(e) => e.stopPropagation()}
            aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
        >
            <img
                src={isFullscreen ? fullscreenCloseIcon : fullscreenOpenIcon}
                alt={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                style={ICON_STYLE}
            />
        </button>
    );
};

const BUTTON_STYLE: React.CSSProperties = {
    position: 'absolute',
    top: '24px',
    right: '24px',
    width: '40px',
    height: '40px',
    padding: '8px',
    borderRadius: '8px',
    border: 'none',
    background: 'rgba(15, 17, 21, 0.8)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s ease',
    zIndex: 100,
};

const ICON_STYLE: React.CSSProperties = {
    width: '24px',
    height: '24px',
    objectFit: 'contain',
    opacity: 0.7,
};
