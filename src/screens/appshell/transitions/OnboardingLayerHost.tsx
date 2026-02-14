import React from 'react';

type OnboardingLayerHostProps<Screen extends string> = {
    screen: Screen;
    screenTransitionFrom: Screen | null;
    screenTransitionReady: boolean;
    isScreenTransitioning: boolean;
    effectiveScreenFadeMs: number;
    fadeEasing: string;
    renderScreenContent: (targetScreen: Screen) => React.ReactNode;
};

export function OnboardingLayerHost<Screen extends string>(
    props: OnboardingLayerHostProps<Screen>
): React.ReactElement {
    const {
        screen,
        screenTransitionFrom,
        screenTransitionReady,
        isScreenTransitioning,
        effectiveScreenFadeMs,
        fadeEasing,
        renderScreenContent,
    } = props;

    return (
        <div style={SCREEN_TRANSITION_CONTAINER_STYLE}>
            {isScreenTransitioning && screenTransitionFrom ? (
                <div
                    key={`transition-from-${screenTransitionFrom}`}
                    style={{
                        ...SCREEN_TRANSITION_LAYER_STYLE,
                        opacity: screenTransitionReady ? 0 : 1,
                        transition: `opacity ${effectiveScreenFadeMs}ms ${fadeEasing}`,
                        zIndex: 1,
                    }}
                >
                    {renderScreenContent(screenTransitionFrom)}
                </div>
            ) : null}
            <div
                key={`active-screen-${screen}`}
                style={{
                    ...SCREEN_TRANSITION_ACTIVE_LAYER_STYLE,
                    ...(isScreenTransitioning ? SCREEN_TRANSITION_ACTIVE_LAYER_TRANSITIONING_STYLE : null),
                    opacity: isScreenTransitioning ? (screenTransitionReady ? 1 : 0) : 1,
                    transition: isScreenTransitioning
                        ? `opacity ${effectiveScreenFadeMs}ms ${fadeEasing}`
                        : 'none',
                    zIndex: 0,
                }}
            >
                {renderScreenContent(screen)}
            </div>
            {isScreenTransitioning ? (
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
