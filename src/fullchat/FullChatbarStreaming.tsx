import React, { memo } from 'react';

const STREAMING_DOTS_STYLE: React.CSSProperties = {
    display: 'inline-flex',
    gap: '3px',
    marginLeft: '4px',
    opacity: 0.35,
};

const DOT_STYLE: React.CSSProperties = {
    fontSize: '16px',
    lineHeight: 1,
};

export const StreamingDots: React.FC = memo(() => (
    <span style={STREAMING_DOTS_STYLE}>
        <span style={DOT_STYLE}>.</span>
        <span style={DOT_STYLE}>.</span>
        <span style={DOT_STYLE}>.</span>
    </span>
));
