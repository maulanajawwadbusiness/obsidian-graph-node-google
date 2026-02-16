import React from 'react';

type OnboardingLayerHostProps<Screen extends string> = {
    screen: Screen;
    fromScreen: Screen | null;
    isFadeArmed: boolean;
    isCrossfading: boolean;
    fadeMs: number;
    fadeEasing: string;
    renderScreenContent: (targetScreen: Screen) => React.ReactNode;
};

export function OnboardingLayerHost<Screen extends string>(
    props: OnboardingLayerHostProps<Screen>
): React.ReactElement {
    const {
        screen,
        fromScreen,
        isFadeArmed,
        isCrossfading,
        fadeMs,
        fadeEasing,
        renderScreenContent,
    } = props;
    const { fromOpacity, toOpacity } = getLayerOpacityState({ isCrossfading, isFadeArmed });
    const fadeTransition = fadeMs > 0 ? `opacity ${fadeMs}ms ${fadeEasing}` : 'none';

    return (
        <div style={SCREEN_TRANSITION_CONTAINER_STYLE}>
            {isCrossfading && fromScreen ? (
                <div
                    key={`transition-from-${fromScreen}`}
                    style={{
                        ...SCREEN_TRANSITION_LAYER_STYLE,
                        opacity: fromOpacity,
                        transition: fadeTransition,
                        zIndex: 1,
                    }}
                >
                    {renderScreenContent(fromScreen)}
                </div>
            ) : null}
            <div
                key={`active-screen-${screen}`}
                style={{
                    ...SCREEN_TRANSITION_ACTIVE_LAYER_STYLE,
                    ...(isCrossfading ? SCREEN_TRANSITION_ACTIVE_LAYER_TRANSITIONING_STYLE : null),
                    opacity: toOpacity,
                    transition: isCrossfading ? fadeTransition : 'none',
                    zIndex: 0,
                }}
            >
                {renderScreenContent(screen)}
            </div>
            {isCrossfading ? (
                <div
                    style={SCREEN_TRANSITION_INPUT_SHIELD_STYLE}
                    onPointerDown={(event) => event.stopPropagation()}
                    onPointerUp={(event) => event.stopPropagation()}
                    onWheel={(event) => event.stopPropagation()}
                    onWheelCapture={(event) => event.stopPropagation()}
                />
            ) : null}
        </div>
    );
}

function getLayerOpacityState(args: { isCrossfading: boolean; isFadeArmed: boolean }): {
    fromOpacity: number;
    toOpacity: number;
} {
    const { isCrossfading, isFadeArmed } = args;
    if (!isCrossfading) {
        return { fromOpacity: 0, toOpacity: 1 };
    }
    return {
        fromOpacity: isFadeArmed ? 0 : 1,
        toOpacity: isFadeArmed ? 1 : 0,
    };
}

const SCREEN_TRANSITION_CONTAINER_STYLE: React.CSSProperties = {
    position: 'relative',
    width: '100%',
    minHeight: '100vh',
    overflow: 'hidden',
};

const SCREEN_TRANSITION_LAYER_STYLE: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    width: '100%',
    minHeight: '100%',
    willChange: 'opacity',
};

const SCREEN_TRANSITION_ACTIVE_LAYER_STYLE: React.CSSProperties = {
    position: 'relative',
    width: '100%',
    minHeight: '100vh',
    willChange: 'opacity',
};

const SCREEN_TRANSITION_ACTIVE_LAYER_TRANSITIONING_STYLE: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    width: '100%',
    minHeight: '100%',
};

const SCREEN_TRANSITION_INPUT_SHIELD_STYLE: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    pointerEvents: 'auto',
    zIndex: 2,
};
