import React from 'react';
import { AppScreen } from '../screenFlow/screenTypes';

type UseOnboardingOverlayStateArgs = {
    screen: AppScreen;
};

type UseOnboardingOverlayStateResult = {
    welcome1OverlayOpen: boolean;
    enterPromptOverlayOpen: boolean;
    isOnboardingOverlayOpen: boolean;
    setWelcome1OverlayOpen: React.Dispatch<React.SetStateAction<boolean>>;
    setEnterPromptOverlayOpen: React.Dispatch<React.SetStateAction<boolean>>;
};

export function useOnboardingOverlayState(
    args: UseOnboardingOverlayStateArgs
): UseOnboardingOverlayStateResult {
    const debug = import.meta.env.DEV;
    const { screen } = args;
    const [welcome1OverlayOpen, setWelcome1OverlayOpen] = React.useState(false);
    const [enterPromptOverlayOpen, setEnterPromptOverlayOpen] = React.useState(false);

    React.useEffect(() => {
        if (screen === 'welcome1') return;
        if (!welcome1OverlayOpen) return;
        setWelcome1OverlayOpen(false);
        if (debug) {
            console.log(
                '[OnboardingOverlay] forced_close overlay=welcome1 screen=%s',
                screen
            );
        }
    }, [debug, screen, welcome1OverlayOpen]);

    React.useEffect(() => {
        if (screen === 'prompt') return;
        if (!enterPromptOverlayOpen) return;
        setEnterPromptOverlayOpen(false);
        if (debug) {
            console.log(
                '[OnboardingOverlay] forced_close overlay=prompt screen=%s',
                screen
            );
        }
    }, [debug, enterPromptOverlayOpen, screen]);

    const effectiveWelcome1OverlayOpen = screen === 'welcome1' && welcome1OverlayOpen;
    const effectiveEnterPromptOverlayOpen = screen === 'prompt' && enterPromptOverlayOpen;

    return {
        welcome1OverlayOpen: effectiveWelcome1OverlayOpen,
        enterPromptOverlayOpen: effectiveEnterPromptOverlayOpen,
        isOnboardingOverlayOpen: effectiveWelcome1OverlayOpen || effectiveEnterPromptOverlayOpen,
        setWelcome1OverlayOpen,
        setEnterPromptOverlayOpen,
    };
}
