import React from 'react';
import { useFullscreen } from '../hooks/useFullscreen';
import fullscreenOpenIcon from '../assets/fullscreen_open_icon.png';
import fullscreenCloseIcon from '../assets/fullscreen_close_icon.png';

type FullscreenButtonProps = {
    className?: string;
    style?: React.CSSProperties;
    blocked?: boolean;
};

export const FullscreenButton: React.FC<FullscreenButtonProps> = ({ className, style, blocked = false }) => {
    const { isFullscreen, toggleFullscreen } = useFullscreen();
    const [isHovered, setIsHovered] = React.useState(false);

    const handleClick = React.useCallback(() => {
        if (blocked) return;
        toggleFullscreen().catch((e: unknown) => {
            console.warn('[fullscreen] Toggle failed:', e);
        });
    }, [blocked, toggleFullscreen]);

    return (
        <button
            type="button"
            className={className}
            style={{
                ...BUTTON_STYLE,
                ...style,
                pointerEvents: blocked ? 'none' : 'auto',
            }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onClick={(e) => {
                e.stopPropagation();
                handleClick();
            }}
            onPointerDown={(e) => e.stopPropagation()}
            aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            aria-disabled={blocked}
        >
            <span
                aria-hidden="true"
                style={{
                    ...ICON_STYLE,
                    backgroundColor: '#D7F5FF',
                    WebkitMaskImage: `url(${isFullscreen ? fullscreenCloseIcon : fullscreenOpenIcon})`,
                    maskImage: `url(${isFullscreen ? fullscreenCloseIcon : fullscreenOpenIcon})`,
                    opacity: isHovered ? 0.6 : 0.3,
                }}
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
    background: 'transparent',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s ease',
    zIndex: 100,
};

const ICON_STYLE: React.CSSProperties = {
    width: '100%',
    height: '100%',
    display: 'inline-block',
    WebkitMaskRepeat: 'no-repeat',
    maskRepeat: 'no-repeat',
    WebkitMaskPosition: 'center',
    maskPosition: 'center',
    WebkitMaskSize: 'contain',
    maskSize: 'contain',
    opacity: 0.3,
    transition: 'opacity 0.2s ease',
};
