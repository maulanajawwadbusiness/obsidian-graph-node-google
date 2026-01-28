import React from 'react';

const BRAND_STYLE: React.CSSProperties = {
    position: 'absolute',
    top: '24px',
    left: '28px',
    zIndex: 100, // Below overlays but above canvas
    pointerEvents: 'none',
    userSelect: 'none',
    color: 'rgba(212, 245, 255, 0.5)', // Brighter bluish white, semi-transparent
    fontSize: '16px',
    fontWeight: 200,
    letterSpacing: '0.5px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    textShadow: '0 2px 10px rgba(0,0,0,0.2)'
};

export const BrandLabel: React.FC = () => {
    return (
        <div style={BRAND_STYLE}>
            Arnvoid
        </div>
    );
};
