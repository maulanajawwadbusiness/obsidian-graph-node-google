import React from 'react';

// Loading surfaces must use lightweight typography consistently.
export const LOADING_TEXT_FONT_WEIGHT = 300;
export const LOADING_TEXT_FONT_FAMILY = 'var(--font-ui)';

export function withLoadingTypography(style: React.CSSProperties): React.CSSProperties {
    return {
        ...style,
        fontFamily: LOADING_TEXT_FONT_FAMILY,
        fontWeight: LOADING_TEXT_FONT_WEIGHT,
    };
}
