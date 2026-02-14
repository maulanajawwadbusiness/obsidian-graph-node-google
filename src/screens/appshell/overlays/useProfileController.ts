import React from 'react';
import { updateProfile } from '../../../api';

const PROFILE_DISPLAY_NAME_MAX = 80;
const PROFILE_USERNAME_MAX = 32;
const PROFILE_USERNAME_REGEX = /^[A-Za-z0-9_.-]+$/;

type ProfileUser = {
    displayName?: string | null;
    name?: string | null;
    username?: string | null;
};

type UseProfileControllerArgs = {
    user: ProfileUser | null;
    applyUserPatch: (user: any) => void;
    refreshMe: () => Promise<unknown>;
    isDev: boolean;
};

type UseProfileControllerResult = {
    profileDraftDisplayName: string;
    profileDraftUsername: string;
    profileError: string | null;
    profileSaving: boolean;
    setProfileDraftDisplayName: React.Dispatch<React.SetStateAction<string>>;
    setProfileDraftUsername: React.Dispatch<React.SetStateAction<string>>;
    setProfileError: React.Dispatch<React.SetStateAction<string | null>>;
    openProfileOverlay: (openOverlay: () => boolean) => void;
    closeProfileOverlay: (closeOverlay: () => boolean) => void;
    onProfileSave: (forceCloseOverlay: () => void) => Promise<void>;
};

export function useProfileController(args: UseProfileControllerArgs): UseProfileControllerResult {
    const { user, applyUserPatch, refreshMe, isDev } = args;
    const [profileDraftDisplayName, setProfileDraftDisplayName] = React.useState('');
    const [profileDraftUsername, setProfileDraftUsername] = React.useState('');
    const [profileError, setProfileError] = React.useState<string | null>(null);
    const [profileSaving, setProfileSaving] = React.useState(false);

    const openProfileOverlay = React.useCallback((openOverlay: () => boolean) => {
        const opened = openOverlay();
        if (!opened || !user) return;
        const nextDisplayName = typeof user.displayName === 'string' && user.displayName.trim()
            ? user.displayName.trim()
            : (typeof user.name === 'string' && user.name.trim() ? user.name.trim() : '');
        const nextUsername = typeof user.username === 'string' && user.username.trim() ? user.username.trim() : '';
        setProfileDraftDisplayName(nextDisplayName);
        setProfileDraftUsername(nextUsername);
        setProfileError(null);
    }, [user]);

    const closeProfileOverlay = React.useCallback((closeOverlay: () => boolean) => {
        const closed = closeOverlay();
        if (!closed) return;
        setProfileError(null);
    }, []);

    const onProfileSave = React.useCallback(async (forceCloseOverlay: () => void) => {
        if (profileSaving) return;
        const displayName = profileDraftDisplayName.replace(/\s+/g, ' ').trim();
        const username = profileDraftUsername.trim();

        if (displayName.length > PROFILE_DISPLAY_NAME_MAX) {
            setProfileError(`Display Name max length is ${PROFILE_DISPLAY_NAME_MAX}.`);
            return;
        }
        if (username.length > PROFILE_USERNAME_MAX) {
            setProfileError(`Username max length is ${PROFILE_USERNAME_MAX}.`);
            return;
        }
        if (username.length > 0 && !PROFILE_USERNAME_REGEX.test(username)) {
            setProfileError('Username may only contain letters, numbers, dot, underscore, and dash.');
            return;
        }

        setProfileSaving(true);
        setProfileError(null);
        try {
            const updatedUser = await updateProfile({ displayName, username });
            applyUserPatch(updatedUser);
            forceCloseOverlay();
            void refreshMe().catch((error) => {
                if (isDev) {
                    console.warn('[appshell] profile_refresh_after_save_failed error=%s', String(error));
                }
            });
        } catch (error) {
            setProfileError('Failed to save profile. Please try again.');
            if (isDev) {
                console.warn('[appshell] profile_save_failed error=%s', String(error));
            }
        } finally {
            setProfileSaving(false);
        }
    }, [applyUserPatch, isDev, profileDraftDisplayName, profileDraftUsername, profileSaving, refreshMe]);

    return {
        profileDraftDisplayName,
        profileDraftUsername,
        profileError,
        profileSaving,
        setProfileDraftDisplayName,
        setProfileDraftUsername,
        setProfileError,
        openProfileOverlay,
        closeProfileOverlay,
        onProfileSave,
    };
}
