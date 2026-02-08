import React from 'react';

export type TypingCursorMode = 'normal' | 'typing' | 'pause' | 'holdFast';

type TypingCursorProps = {
    mode?: TypingCursorMode;
    visible?: boolean;
    heightEm?: number;
    style?: React.CSSProperties;
};

function getAnimationByMode(mode: TypingCursorMode): string {
    if (mode === 'typing') return 'none';
    if (mode === 'pause') return 'cursorNeedlePause 1.05s step-end infinite';
    if (mode === 'holdFast') return 'cursorNeedleHoldFast 0.34s step-end infinite';
    return 'cursorNeedleNormal 0.85s step-end infinite';
}

export const TypingCursor: React.FC<TypingCursorProps> = ({
    mode = 'normal',
    visible = true,
    heightEm = 1.0,
    style,
}) => {
    return (
        <span
            aria-hidden="true"
            style={{
                ...CURSOR_STYLE,
                height: `${heightEm}em`,
                opacity: visible ? 1 : 0,
                animation: getAnimationByMode(mode),
                ...style,
            }}
        />
    );
};

const CURSOR_STYLE: React.CSSProperties = {
    display: 'inline-block',
    width: '2px',
    marginLeft: '2px',
    background: '#63abff',
    borderRadius: '1px',
    verticalAlign: '-0.12em',
    transform: 'translateZ(0)',
    willChange: 'opacity',
    flexShrink: 0,
    pointerEvents: 'none',
};
