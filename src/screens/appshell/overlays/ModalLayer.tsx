import React from 'react';
import {
    LAYER_MODAL_DELETE,
    LAYER_MODAL_LOGOUT_CONFIRM,
    LAYER_MODAL_PROFILE,
    LAYER_MODAL_SEARCH,
} from '../../../ui/layers';

type ModalSearchResult = {
    id: string;
    title: string;
};

export type ModalLayerProfileModel = {
    isProfileOpen: boolean;
    sidebarAccountImageUrl?: string;
    profileDraftDisplayName: string;
    profileDraftUsername: string;
    profileError: string | null;
    profileSaving: boolean;
    setProfileDraftDisplayName: React.Dispatch<React.SetStateAction<string>>;
    setProfileDraftUsername: React.Dispatch<React.SetStateAction<string>>;
    setProfileError: React.Dispatch<React.SetStateAction<string | null>>;
    closeProfileOverlay: () => void;
    onProfileSave: () => void;
};

export type ModalLayerLogoutModel = {
    isLogoutConfirmOpen: boolean;
    logoutConfirmError: string | null;
    logoutConfirmBusy: boolean;
    closeLogoutConfirm: () => void;
    confirmLogout: () => void;
};

export type ModalLayerDeleteConfirmModel = {
    pendingDeleteId: string | null;
    pendingDeleteTitle: string | null;
    closeDeleteConfirm: () => void;
    confirmDelete: () => void;
};

export type ModalLayerSearchModel = {
    isSearchInterfacesOpen: boolean;
    closeSearchInterfaces: () => void;
    searchInterfacesQuery: string;
    setSearchInterfacesQuery: (next: string) => void;
    searchInputFocused: boolean;
    setSearchInputFocused: React.Dispatch<React.SetStateAction<boolean>>;
    searchHighlightedIndex: number;
    setSearchHighlightedIndex: React.Dispatch<React.SetStateAction<number>>;
    filteredSearchResults: ModalSearchResult[];
    selectSearchResultById: (id: string) => void;
    searchInputRef: React.MutableRefObject<HTMLInputElement | null>;
};

type ModalLayerProps = {
    profile: ModalLayerProfileModel;
    logout: ModalLayerLogoutModel;
    deleteConfirm: ModalLayerDeleteConfirmModel;
    search: ModalLayerSearchModel;
};

function normalizeSearchText(raw: string): string {
    return raw.toLowerCase().replace(/\s+/g, ' ').trim();
}

function truncateDisplayTitle(raw: string, maxChars = 75): string {
    if (raw.length <= maxChars) return raw;
    return `${raw.slice(0, maxChars).trimEnd()}...`;
}

export function ModalLayer(props: ModalLayerProps): React.ReactElement | null {
    const {
        profile,
        logout,
        deleteConfirm,
        search,
    } = props;
    const {
        isProfileOpen,
        sidebarAccountImageUrl,
        profileDraftDisplayName,
        profileDraftUsername,
        profileError,
        profileSaving,
        setProfileDraftDisplayName,
        setProfileDraftUsername,
        setProfileError,
        closeProfileOverlay,
        onProfileSave,
    } = profile;
    const {
        isLogoutConfirmOpen,
        logoutConfirmError,
        logoutConfirmBusy,
        closeLogoutConfirm,
        confirmLogout,
    } = logout;
    const {
        pendingDeleteId,
        pendingDeleteTitle,
        closeDeleteConfirm,
        confirmDelete,
    } = deleteConfirm;
    const {
        isSearchInterfacesOpen,
        closeSearchInterfaces,
        searchInterfacesQuery,
        setSearchInterfacesQuery,
        searchInputFocused,
        setSearchInputFocused,
        searchHighlightedIndex,
        setSearchHighlightedIndex,
        filteredSearchResults,
        selectSearchResultById,
        searchInputRef,
    } = search;
    const stopEventPropagation = React.useCallback((e: React.SyntheticEvent) => {
        e.stopPropagation();
    }, []);
    const hardShieldInput = React.useMemo(
        () => ({
            onPointerDown: stopEventPropagation,
            onPointerUp: stopEventPropagation,
            onClick: stopEventPropagation,
            onWheelCapture: stopEventPropagation,
            onWheel: stopEventPropagation,
        }),
        [stopEventPropagation]
    );

    if (!isProfileOpen && !isLogoutConfirmOpen && !pendingDeleteId && !isSearchInterfacesOpen) {
        return null;
    }

    return (
        <div
            data-modal-layer-root="1"
            onPointerDownCapture={(event) => event.stopPropagation()}
            onWheelCapture={(event) => event.stopPropagation()}
        >
            {isProfileOpen ? (
                <div
                    {...hardShieldInput}
                    data-profile-backdrop="1"
                    style={PROFILE_OVERLAY_BACKDROP_STYLE}
                    onClick={(e) => {
                        e.stopPropagation();
                        closeProfileOverlay();
                    }}
                >
                    <div
                        {...hardShieldInput}
                        data-profile-modal="1"
                        style={PROFILE_OVERLAY_CARD_STYLE}
                    >
                        <div style={PROFILE_TITLE_STYLE}>Profile</div>
                        <div style={PROFILE_AVATAR_ROW_STYLE}>
                            {sidebarAccountImageUrl ? (
                                <img src={sidebarAccountImageUrl} alt="avatar" style={PROFILE_AVATAR_IMAGE_STYLE} />
                            ) : (
                                <div style={PROFILE_AVATAR_FALLBACK_STYLE}>BA</div>
                            )}
                        </div>
                        <label style={PROFILE_FIELD_STYLE}>
                            <span style={PROFILE_LABEL_STYLE}>Display Name</span>
                            <input
                                {...hardShieldInput}
                                type="text"
                                value={profileDraftDisplayName}
                                disabled={profileSaving}
                                onChange={(e) => {
                                    setProfileDraftDisplayName(e.target.value);
                                    setProfileError(null);
                                }}
                                placeholder="Display Name"
                                style={PROFILE_INPUT_STYLE}
                            />
                        </label>
                        <label style={PROFILE_FIELD_STYLE}>
                            <span style={PROFILE_LABEL_STYLE}>Username</span>
                            <input
                                {...hardShieldInput}
                                className="profile-username-input"
                                type="text"
                                value={profileDraftUsername}
                                disabled={profileSaving}
                                onChange={(e) => {
                                    setProfileDraftUsername(e.target.value);
                                    setProfileError(null);
                                }}
                                placeholder="Username"
                                style={PROFILE_INPUT_STYLE}
                            />
                        </label>
                        {profileError ? <div style={PROFILE_ERROR_STYLE}>{profileError}</div> : null}
                        <div style={PROFILE_BUTTON_ROW_STYLE}>
                            <button
                                {...hardShieldInput}
                                type="button"
                                style={PROFILE_CANCEL_STYLE}
                                disabled={profileSaving}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    closeProfileOverlay();
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                {...hardShieldInput}
                                type="button"
                                style={{
                                    ...PROFILE_PRIMARY_STYLE,
                                    opacity: profileSaving ? 0.75 : 1,
                                }}
                                disabled={profileSaving}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    void onProfileSave();
                                }}
                            >
                                {profileSaving ? 'Saving...' : 'Save'}
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
            {isLogoutConfirmOpen ? (
                <div
                    {...hardShieldInput}
                    data-logout-confirm-backdrop="1"
                    style={LOGOUT_CONFIRM_BACKDROP_STYLE}
                    onClick={(e) => {
                        e.stopPropagation();
                        closeLogoutConfirm();
                    }}
                >
                    <div
                        {...hardShieldInput}
                        data-logout-confirm-modal="1"
                        style={LOGOUT_CONFIRM_CARD_STYLE}
                    >
                        <div style={LOGOUT_CONFIRM_TITLE_STYLE}>Log out?</div>
                        <div style={LOGOUT_CONFIRM_TEXT_STYLE}>
                            You will be signed out from this account on this device.
                        </div>
                        {logoutConfirmError ? <div style={LOGOUT_CONFIRM_ERROR_STYLE}>{logoutConfirmError}</div> : null}
                        <div style={LOGOUT_CONFIRM_BUTTON_ROW_STYLE}>
                            <button
                                {...hardShieldInput}
                                type="button"
                                style={LOGOUT_CONFIRM_CANCEL_STYLE}
                                disabled={logoutConfirmBusy}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    closeLogoutConfirm();
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                {...hardShieldInput}
                                type="button"
                                style={{
                                    ...LOGOUT_CONFIRM_PRIMARY_STYLE,
                                    opacity: logoutConfirmBusy ? 0.75 : 1,
                                }}
                                disabled={logoutConfirmBusy}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    void confirmLogout();
                                }}
                            >
                                {logoutConfirmBusy ? 'Logging out...' : 'Log Out'}
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
            {pendingDeleteId ? (
                <div
                    data-delete-backdrop="1"
                    style={DELETE_CONFIRM_BACKDROP_STYLE}
                    onPointerDown={(e) => e.stopPropagation()}
                    onPointerUp={(e) => e.stopPropagation()}
                    onClick={(e) => {
                        e.stopPropagation();
                        closeDeleteConfirm();
                    }}
                    onWheelCapture={(e) => e.stopPropagation()}
                    onWheel={(e) => e.stopPropagation()}
                >
                    <div
                        data-delete-modal="1"
                        style={DELETE_CONFIRM_CARD_STYLE}
                        onPointerDown={(e) => e.stopPropagation()}
                        onPointerUp={(e) => e.stopPropagation()}
                        onClick={(e) => e.stopPropagation()}
                        onWheelCapture={(e) => e.stopPropagation()}
                        onWheel={(e) => e.stopPropagation()}
                    >
                        <div style={DELETE_CONFIRM_TITLE_STYLE}>
                            Delete saved interface?
                        </div>
                        <div style={DELETE_CONFIRM_TEXT_STYLE}>
                            This will permanently remove "{pendingDeleteTitle ?? pendingDeleteId}" from this device.
                            This action cannot be undone.
                        </div>
                        <div style={DELETE_CONFIRM_BUTTON_ROW_STYLE}>
                            <button
                                type="button"
                                style={DELETE_CONFIRM_CANCEL_STYLE}
                                onPointerDown={(e) => e.stopPropagation()}
                                onPointerUp={(e) => e.stopPropagation()}
                                onWheelCapture={(e) => e.stopPropagation()}
                                onWheel={(e) => e.stopPropagation()}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    closeDeleteConfirm();
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                style={DELETE_CONFIRM_PRIMARY_STYLE}
                                onPointerDown={(e) => e.stopPropagation()}
                                onPointerUp={(e) => e.stopPropagation()}
                                onWheelCapture={(e) => e.stopPropagation()}
                                onWheel={(e) => e.stopPropagation()}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    confirmDelete();
                                }}
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
            {isSearchInterfacesOpen ? (
                <div
                    {...hardShieldInput}
                    data-search-interfaces-backdrop="1"
                    data-search-backdrop="1"
                    style={SEARCH_OVERLAY_BACKDROP_STYLE}
                    onClick={(e) => {
                        e.stopPropagation();
                        closeSearchInterfaces();
                    }}
                >
                    <div
                        {...hardShieldInput}
                        data-search-interfaces-modal="1"
                        data-search-modal="1"
                        style={{
                            ...SEARCH_OVERLAY_CARD_STYLE,
                            boxShadow: searchInputFocused
                                ? '0 0 0 1px rgba(231, 231, 231, 0.08), 0 18px 56px rgba(0, 0, 0, 0.45)'
                                : SEARCH_OVERLAY_CARD_STYLE.boxShadow,
                        }}
                        onKeyDown={(e) => {
                            e.stopPropagation();
                            if (e.key !== 'Escape') return;
                            e.preventDefault();
                            closeSearchInterfaces();
                        }}
                    >
                        <button
                            {...hardShieldInput}
                            type="button"
                            aria-label="Close search"
                            style={SEARCH_CLOSE_BUTTON_STYLE}
                            onClick={(e) => {
                                e.stopPropagation();
                                closeSearchInterfaces();
                            }}
                        >
                            x
                        </button>
                        <input
                            {...hardShieldInput}
                            ref={searchInputRef}
                            className="search-interfaces-input"
                            autoFocus
                            value={searchInterfacesQuery}
                            placeholder="Search interfaces..."
                            style={SEARCH_INPUT_STYLE}
                            onChange={(e) => setSearchInterfacesQuery(e.target.value)}
                            onFocus={() => setSearchInputFocused(true)}
                            onBlur={() => setSearchInputFocused(false)}
                            onKeyDown={(e) => {
                                e.stopPropagation();
                                if (e.key === 'Escape') {
                                    e.preventDefault();
                                    closeSearchInterfaces();
                                    return;
                                }
                                if (e.key === 'Enter') {
                                    if (searchHighlightedIndex < 0) return;
                                    const picked = filteredSearchResults[searchHighlightedIndex] ?? filteredSearchResults[0];
                                    if (!picked) return;
                                    e.preventDefault();
                                    selectSearchResultById(picked.id);
                                    return;
                                }
                                if (e.key === 'ArrowDown') {
                                    e.preventDefault();
                                    setSearchHighlightedIndex((curr) => {
                                        if (filteredSearchResults.length === 0) return -1;
                                        if (curr < 0) return 0;
                                        return Math.min(filteredSearchResults.length - 1, curr + 1);
                                    });
                                    return;
                                }
                                if (e.key === 'ArrowUp') {
                                    e.preventDefault();
                                    setSearchHighlightedIndex((curr) => {
                                        if (curr < 0) return -1;
                                        return Math.max(0, curr - 1);
                                    });
                                }
                            }}
                        />
                        <div
                            {...hardShieldInput}
                            className="search-interfaces-scroll"
                            data-search-interfaces-results="1"
                            style={SEARCH_RESULTS_STYLE}
                        >
                            {normalizeSearchText(searchInterfacesQuery).length === 0 ? (
                                <div style={SEARCH_SECTION_LABEL_STYLE}>Recent</div>
                            ) : null}
                            {filteredSearchResults.length === 0 ? (
                                <div style={SEARCH_EMPTY_STYLE}>
                                    <span style={SEARCH_EMPTY_TITLE_STYLE}>No interfaces found.</span>
                                    <span style={SEARCH_EMPTY_HINT_STYLE}>Try a different keyword.</span>
                                </div>
                            ) : (
                                filteredSearchResults.map((item, index) => {
                                    const isHighlighted = normalizeSearchText(searchInterfacesQuery).length > 0
                                        && index === searchHighlightedIndex;
                                    return (
                                        <button
                                            {...hardShieldInput}
                                            key={item.id}
                                            type="button"
                                            style={{
                                                ...SEARCH_RESULT_ROW_STYLE,
                                                borderColor: isHighlighted ? 'rgba(99, 171, 255, 0.5)' : SEARCH_RESULT_ROW_STYLE.borderColor,
                                                background: isHighlighted ? 'rgba(171, 210, 255, 0.11)' : SEARCH_RESULT_ROW_STYLE.background,
                                            }}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                selectSearchResultById(item.id);
                                            }}
                                            onMouseEnter={() => setSearchHighlightedIndex(index)}
                                        >
                                            <span style={SEARCH_RESULT_TITLE_STYLE}>{truncateDisplayTitle(item.title)}</span>
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
}

const PROFILE_OVERLAY_BACKDROP_STYLE: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(6, 8, 12, 0.64)',
    zIndex: LAYER_MODAL_PROFILE,
    pointerEvents: 'auto',
};

const PROFILE_OVERLAY_CARD_STYLE: React.CSSProperties = {
    width: '100%',
    maxWidth: '300px',
    margin: '0 16px',
    borderRadius: '12px',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    background: '#0d0d18',
    boxShadow: '0 18px 56px rgba(0, 0, 0, 0.45)',
    padding: '20px 15px',
    color: '#f1f4fb',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
};

const PROFILE_TITLE_STYLE: React.CSSProperties = {
    fontFamily: 'var(--font-ui)',
    fontWeight: 400,
    fontSize: '14px',
    lineHeight: 1.2,
    color: '#f3f7ff',
};

const PROFILE_AVATAR_ROW_STYLE: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'center',
    padding: '4px 0 2px',
};

const PROFILE_AVATAR_IMAGE_STYLE: React.CSSProperties = {
    width: '65px',
    height: '65px',
    borderRadius: '50%',
    objectFit: 'cover',
    display: 'block',
};

const PROFILE_AVATAR_FALLBACK_STYLE: React.CSSProperties = {
    width: '65px',
    height: '65px',
    borderRadius: '50%',
    background: '#2dd4bf',
    color: '#000',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'var(--font-ui)',
    fontWeight: 300,
    fontSize: '12px',
};

const PROFILE_FIELD_STYLE: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
};

const PROFILE_LABEL_STYLE: React.CSSProperties = {
    fontSize: '12px',
    lineHeight: 1.2,
    color: '#ffffff',
    fontFamily: 'var(--font-ui)',
    fontWeight: 300,
};

const PROFILE_INPUT_STYLE: React.CSSProperties = {
    width: '100%',
    borderRadius: '10px',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    background: 'rgba(12, 15, 22, 0.95)',
    color: '#ffffff',
    fontFamily: 'var(--font-ui)',
    fontWeight: 300,
    fontSize: '13px',
    lineHeight: 1.4,
    padding: '9px 10px',
    outline: 'none',
    boxSizing: 'border-box',
};

const PROFILE_ERROR_STYLE: React.CSSProperties = {
    fontSize: '12px',
    color: '#ff6b6b',
    fontFamily: 'var(--font-ui)',
    fontWeight: 300,
};

const PROFILE_BUTTON_ROW_STYLE: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '8px',
    marginTop: '2px',
};

const PROFILE_CANCEL_STYLE: React.CSSProperties = {
    border: '1px solid rgba(255, 255, 255, 0.24)',
    background: 'rgba(255, 255, 255, 0.04)',
    color: '#f1f4fb',
    borderRadius: '7px',
    padding: '7px 12px',
    fontSize: '12px',
    cursor: 'pointer',
    fontWeight: 300,
    fontFamily: 'var(--font-ui)',
};

const PROFILE_PRIMARY_STYLE: React.CSSProperties = {
    border: '1px solid #63abff',
    background: '#63abff',
    color: '#0b1220',
    borderRadius: '7px',
    padding: '7px 12px',
    fontSize: '12px',
    cursor: 'pointer',
    fontWeight: 300,
    fontFamily: 'var(--font-ui)',
};

const LOGOUT_CONFIRM_BACKDROP_STYLE: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(6, 8, 12, 0.64)',
    zIndex: LAYER_MODAL_LOGOUT_CONFIRM,
    pointerEvents: 'auto',
};

const LOGOUT_CONFIRM_CARD_STYLE: React.CSSProperties = {
    width: '100%',
    maxWidth: '360px',
    margin: '0 16px',
    borderRadius: '12px',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    background: '#0d0d18',
    boxShadow: '0 18px 56px rgba(0, 0, 0, 0.45)',
    padding: '18px',
    color: '#f1f4fb',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
};

const LOGOUT_CONFIRM_TITLE_STYLE: React.CSSProperties = {
    fontFamily: 'var(--font-ui)',
    fontWeight: 300,
    fontSize: '16px',
    lineHeight: 1.2,
    color: '#f3f7ff',
};

const LOGOUT_CONFIRM_TEXT_STYLE: React.CSSProperties = {
    fontFamily: 'var(--font-ui)',
    fontWeight: 300,
    fontSize: '12px',
    lineHeight: 1.5,
    color: 'rgba(231, 231, 231, 0.74)',
};

const LOGOUT_CONFIRM_ERROR_STYLE: React.CSSProperties = {
    fontFamily: 'var(--font-ui)',
    fontWeight: 300,
    fontSize: '12px',
    lineHeight: 1.4,
    color: '#ff6b6b',
};

const LOGOUT_CONFIRM_BUTTON_ROW_STYLE: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '8px',
    marginTop: '2px',
};

const LOGOUT_CONFIRM_CANCEL_STYLE: React.CSSProperties = {
    border: '1px solid rgba(255, 255, 255, 0.24)',
    background: 'rgba(255, 255, 255, 0.04)',
    color: '#f1f4fb',
    borderRadius: '7px',
    padding: '7px 12px',
    fontSize: '12px',
    cursor: 'pointer',
    fontWeight: 300,
    fontFamily: 'var(--font-ui)',
};

const LOGOUT_CONFIRM_PRIMARY_STYLE: React.CSSProperties = {
    border: '1px solid #ff4b4e',
    background: '#ff4b4e',
    color: '#ffffff',
    borderRadius: '7px',
    padding: '7px 12px',
    fontSize: '12px',
    cursor: 'pointer',
    fontWeight: 300,
    fontFamily: 'var(--font-ui)',
};

const DELETE_CONFIRM_BACKDROP_STYLE: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(6, 8, 12, 0.64)',
    zIndex: LAYER_MODAL_DELETE,
    pointerEvents: 'auto',
};

const DELETE_CONFIRM_CARD_STYLE: React.CSSProperties = {
    width: '100%',
    maxWidth: '420px',
    margin: '0 16px',
    borderRadius: '11.9px',
    border: 'none',
    background: '#0d0d18',
    boxShadow: '0 18px 56px rgba(0, 0, 0, 0.45)',
    padding: '20px',
    color: '#06060A',
    fontWeight: 300,
    display: 'flex',
    flexDirection: 'column',
    gap: '8.5px',
};

const DELETE_CONFIRM_TITLE_STYLE: React.CSSProperties = {
    fontSize: '11.9px',
    lineHeight: 1.25,
    fontWeight: 300,
    color: '#f3f7ff',
};

const DELETE_CONFIRM_TEXT_STYLE: React.CSSProperties = {
    fontSize: '11.9px',
    lineHeight: 1.5,
    color: 'rgba(231, 231, 231, 0.7)',
};

const DELETE_CONFIRM_BUTTON_ROW_STYLE: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '6.8px',
    marginTop: '3.4px',
};

const DELETE_CONFIRM_CANCEL_STYLE: React.CSSProperties = {
    border: '1px solid rgba(255, 255, 255, 0.26)',
    background: 'rgba(255, 255, 255, 0.04)',
    color: '#f1f4fb',
    borderRadius: '6.8px',
    padding: '6.8px 11.9px',
    fontSize: '11.9px',
    cursor: 'pointer',
    fontWeight: 300,
};

const DELETE_CONFIRM_PRIMARY_STYLE: React.CSSProperties = {
    border: '1px solid #ff4b4e',
    background: '#ff4b4e',
    color: '#ffffff',
    borderRadius: '6.8px',
    padding: '6.8px 11.9px',
    fontSize: '11.9px',
    cursor: 'pointer',
    fontWeight: 300,
};

const SEARCH_OVERLAY_BACKDROP_STYLE: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '16px',
    boxSizing: 'border-box',
    background: 'rgba(6, 8, 12, 0.58)',
    zIndex: LAYER_MODAL_SEARCH,
    pointerEvents: 'auto',
};

const SEARCH_OVERLAY_CARD_STYLE: React.CSSProperties = {
    position: 'relative',
    width: 'min(560px, calc(100vw - 32px))',
    height: 'min(320px, calc(100vh - 64px))',
    maxHeight: 'calc(100vh - 64px)',
    overflowX: 'hidden',
    borderRadius: '14px',
    border: 'none',
    background: '#0d0d18',
    boxShadow: '0 18px 56px rgba(0, 0, 0, 0.45)',
    padding: '16px',
    boxSizing: 'border-box',
    overflow: 'hidden',
    color: '#e7e7e7',
    fontFamily: 'var(--font-ui)',
    fontWeight: 300,
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
};

const SEARCH_CLOSE_BUTTON_STYLE: React.CSSProperties = {
    position: 'absolute',
    top: '12px',
    right: '-6px',
    width: '24px',
    height: '24px',
    borderRadius: '6px',
    border: 'none',
    background: 'transparent',
    color: 'rgba(231, 231, 231, 0.86)',
    cursor: 'pointer',
    lineHeight: 1,
    fontSize: '14px',
    fontWeight: 300,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    fontFamily: 'var(--font-ui)',
    opacity: 0.7,
};

const SEARCH_INPUT_STYLE: React.CSSProperties = {
    flex: '0 0 auto',
    width: '100%',
    borderRadius: '10px',
    border: 'none',
    background: 'rgba(12, 15, 22, 0.95)',
    color: '#e7e7e7',
    fontFamily: 'var(--font-ui)',
    fontWeight: 300,
    fontSize: '10.5px',
    lineHeight: 1.4,
    padding: '9px 36px 9px 20px',
    outline: 'none',
    WebkitTapHighlightColor: 'transparent',
};

const SEARCH_RESULTS_STYLE: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    flex: '1 1 auto',
    minHeight: 0,
    gap: '8px',
    paddingLeft: '10px',
    marginRight: '-16px',
    paddingRight: '16px',
    paddingBottom: '10px',
    overflowY: 'auto',
    overflowX: 'hidden',
};

const SEARCH_SECTION_LABEL_STYLE: React.CSSProperties = {
    color: 'rgba(231, 231, 231, 0.58)',
    fontSize: '8.25px',
    lineHeight: 1.2,
    letterSpacing: '0.35px',
    textTransform: 'none',
    padding: '2px 10px 0',
    fontFamily: 'var(--font-ui)',
    fontWeight: 300,
};

const SEARCH_RESULT_ROW_STYLE: React.CSSProperties = {
    width: '100%',
    minWidth: 0,
    display: 'block',
    padding: '8px 10px',
    borderRadius: '10px',
    border: 'none',
    background: 'transparent',
    textAlign: 'left',
    cursor: 'pointer',
    fontFamily: 'var(--font-ui)',
    fontWeight: 300,
};

const SEARCH_RESULT_TITLE_STYLE: React.CSSProperties = {
    color: '#f3f7ff',
    fontSize: '10.5px',
    lineHeight: 1.35,
    fontWeight: 300,
    fontFamily: 'var(--font-ui)',
    minWidth: 0,
    maxWidth: '100%',
    width: '100%',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
};

const SEARCH_EMPTY_STYLE: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    color: 'rgba(231, 231, 231, 0.62)',
    fontSize: '13px',
    lineHeight: 1.4,
    padding: '10px 10px',
    fontFamily: 'var(--font-ui)',
    fontWeight: 300,
};

const SEARCH_EMPTY_TITLE_STYLE: React.CSSProperties = {
    color: 'rgba(231, 231, 231, 0.74)',
    fontFamily: 'var(--font-ui)',
    fontWeight: 300,
    fontSize: '13px',
    lineHeight: 1.35,
};

const SEARCH_EMPTY_HINT_STYLE: React.CSSProperties = {
    color: 'rgba(231, 231, 231, 0.52)',
    fontFamily: 'var(--font-ui)',
    fontWeight: 300,
    fontSize: '12px',
    lineHeight: 1.35,
};
