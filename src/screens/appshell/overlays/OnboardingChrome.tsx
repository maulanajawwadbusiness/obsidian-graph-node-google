import React from 'react';
import { FullscreenButton } from '../../../components/FullscreenButton';
import { LAYER_ONBOARDING_FULLSCREEN_BUTTON } from '../../../ui/layers';
import { AppScreen, isOnboardingScreen } from '../screenFlow/screenTypes';

type OnboardingChromeProps = {
    screen: AppScreen;
    isOnboardingOverlayOpen: boolean;
};

export function OnboardingChrome(props: OnboardingChromeProps): React.ReactElement | null {
    const { screen, isOnboardingOverlayOpen } = props;
    if (!isOnboardingScreen(screen)) return null;

    const iconScale = (screen === 'welcome1' || screen === 'welcome2')
        ? WELCOME_FULLSCREEN_ICON_SCALE
        : 1;
    const style: React.CSSProperties = screen === 'prompt'
        ? {
            ...ONBOARDING_FULLSCREEN_BUTTON_STYLE,
            width: '30px',
            height: '30px',
            padding: '6px',
        }
        : ONBOARDING_FULLSCREEN_BUTTON_STYLE;

    return (
        <FullscreenButton
            style={style}
            blocked={isOnboardingOverlayOpen}
            iconScale={iconScale}
        />
    );
}

const ONBOARDING_FULLSCREEN_BUTTON_STYLE: React.CSSProperties = {
    position: 'fixed',
    top: '24px',
    right: '24px',
    zIndex: LAYER_ONBOARDING_FULLSCREEN_BUTTON,
};

const WELCOME_FULLSCREEN_ICON_SCALE = 0.8;
