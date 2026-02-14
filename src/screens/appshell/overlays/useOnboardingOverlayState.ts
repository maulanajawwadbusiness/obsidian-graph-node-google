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
    const { screen } = args;
    const [welcome1OverlayOpen, setWelcome1OverlayOpen] = React.useState(false);
    const [enterPromptOverlayOpen, setEnterPromptOverlayOpen] = React.useState(false);

    React.useEffect(() => {
        if (screen === 'prompt') return;
        if (!enterPromptOverlayOpen) return;
        setEnterPromptOverlayOpen(false);
    }, [enterPromptOverlayOpen, screen]);

    return {
        welcome1OverlayOpen,
        enterPromptOverlayOpen,
        isOnboardingOverlayOpen: welcome1OverlayOpen || enterPromptOverlayOpen,
        setWelcome1OverlayOpen,
        setEnterPromptOverlayOpen,
    };
}
