import React, { useState } from 'react';
import { useDocument } from '../../store/documentStore';
import { t } from '../../i18n/t';
import documentIcon from '../../assets/document_icon.png';
import { useTooltip } from '../../ui/tooltip/useTooltip';

/**
 * Bottom-left button to toggle the left viewer window.
 * Must work even with no document loaded (opens empty state).
 */

type TextPreviewButtonProps = {
    onToggle?: () => void;
};

const stopPropagation = (e: React.MouseEvent) => e.stopPropagation();

const BUTTON_STYLE: React.CSSProperties = {
    position: 'absolute',
    bottom: '30px',
    left: '28px',
    width: '28px',
    height: '30px',
    padding: 0,
    backgroundColor: 'transparent',
    border: 'none',
    cursor: 'pointer',
    opacity: 0.35,
    transition: 'opacity 0.2s ease',
    zIndex: 100,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
};

const IMG_STYLE: React.CSSProperties = {
    width: '28px',
    height: '28px',
    objectFit: 'contain',
};

export const TextPreviewButton: React.FC<TextPreviewButtonProps> = ({ onToggle }) => {
    const { state, togglePreview } = useDocument();
    const open = state.previewOpen;
    const [isHovered, setIsHovered] = useState(false);
    const previewTooltip = useTooltip(open ? t('tooltip.closeViewer') : t('tooltip.openViewer'));

    return (
        <button
            {...previewTooltip.getAnchorProps({
                type: 'button',
                style: {
                    ...BUTTON_STYLE,
                    opacity: isHovered ? 0.65 : 0.35,
                },
                onMouseDown: stopPropagation,
                onMouseMove: stopPropagation,
                onMouseUp: stopPropagation,
                onPointerDown: stopPropagation,
                onMouseEnter: () => setIsHovered(true),
                onMouseLeave: () => setIsHovered(false),
                onClick: (e) => {
                    stopPropagation(e);
                    (onToggle ?? togglePreview)();
                },
                'aria-label': open ? t('tooltip.closeViewer') : t('tooltip.openViewer'),
            })}
        >
            <img src={documentIcon} alt="Document" style={IMG_STYLE} />
        </button>
    );
};
