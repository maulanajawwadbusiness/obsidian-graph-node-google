import React from 'react';
import circleIcon from '../assets/circle_icon.png';
import sidebarIcon from '../assets/sidebar_icon.png';
import createNewIcon from '../assets/create_new_icon.png';
import searchIcon from '../assets/search_icon.png';
import threeDotIcon from '../assets/3_dot_icon.png';
import documentIcon from '../assets/document_icon.png';
import verticalElipsisIcon from '../assets/vertical_elipsis_icon.png';
import renameIcon from '../assets/rename_icon.png';
import deleteIcon from '../assets/delete_icon.png';
import logoutIcon from '../assets/logout_icon.png';
import suggestionFeedbackIcon from '../assets/suggestion_feedback_icon.png';
import blogIcon from '../assets/blog_icon.png';
import { LAYER_SIDEBAR, LAYER_SIDEBAR_ROW_MENU } from '../ui/layers';
import {
    SIDEBAR_COLLAPSED_WIDTH_CSS,
    SIDEBAR_EXPANDED_MIN_WIDTH_CSS,
    SIDEBAR_EXPANDED_WIDTH_CSS,
} from '../screens/appshell/appShellStyles';

// ===========================================================================
// Mock Data
// ===========================================================================
export type SidebarInterfaceItem = {
    id: string;
    title: string;
    subtitle?: string;
    nodeCount?: number;
    linkCount?: number;
    updatedAt?: number;
};

// ===========================================================================
// Design Tokens
// ===========================================================================
// Scale: 1.0 = base size, 0.5 = 50% smaller
const SIDEBAR_SCALE = 0.8;

const ICON_SIZE = 18 * SIDEBAR_SCALE;
// Logo size multiplier: 1.0 = base, 1.5 = 50% larger
const LOGO_SCALE = 1.05;
const LOGO_SIZE = 20 * SIDEBAR_SCALE * LOGO_SCALE;
const CLOSE_ICON_SIZE_PX = Math.round(ICON_SIZE);
// Avatar size multiplier: 1.0 = base, 0.85 = 15% smaller
const AVATAR_SCALE = 0.85;
const AVATAR_SIZE = 28 * SIDEBAR_SCALE * AVATAR_SCALE;
const FONT_SIZE_NAV = 13 * SIDEBAR_SCALE;
const FONT_SIZE_SECTION_HEADER = 11 * SIDEBAR_SCALE;
const FONT_SIZE_AVATAR = 10 * SIDEBAR_SCALE;
// Horizontal offset: negative = left, positive = right (in px)
const ICON_OFFSET_LEFT = -8.5;
// Logo vertical offset: negative = up, positive = down (in px)
const LOGO_OFFSET_TOP = 5;
// Create New icon vertical offset: negative = up, positive = down (in px)
const CREATE_NEW_OFFSET_TOP = -1;
// Search icon vertical offset: negative = up, positive = down (in px)
const SEARCH_OFFSET_TOP = -7.5;
// More (3-dot) icon vertical offset: negative = up, positive = down (in px)
const MORE_OFFSET_TOP = -9.5;
// Your Name text horizontal offset: negative = left, positive = right (in px)
const NAME_OFFSET_LEFT = -13;
// Close icon (expanded state) horizontal offset: negative = left, positive = right (in px)
const CLOSE_ICON_OFFSET_LEFT = -10;
const ICON_OPACITY_DEFAULT = 1.0;
const ICON_OPACITY_HOVER = 1.0;
const HOVER_ACCENT_COLOR = '#63abff';
const DEFAULT_ICON_COLOR = '#d7f5ff';
const SIDEBAR_TEXT_COLOR = '#D7F5FF';
const ROW_MENU_DELETE_TEXT_COLOR = '#FF4B4E';
const SIDEBAR_HOVER_TRANSITION = '250ms ease';
const LOGO_SWAP_TRANSITION = '100ms ease';
const CLOSE_ICON_VIEWBOX = '0 0 100 100';
type RowMenuItemKey = 'rename' | 'delete';
type MoreMenuItemKey = 'suggestion' | 'blog';

const roundedRectArcPath = (x: number, y: number, width: number, height: number, radius: number): string => {
    const r = Math.max(0, Math.min(radius, width / 2, height / 2));
    const right = (x + width).toFixed(3);
    const bottom = (y + height).toFixed(3);
    const left = x.toFixed(3);
    const top = y.toFixed(3);
    const hStart = (x + r).toFixed(3);
    const hEnd = (x + width - r).toFixed(3);
    const vStart = (y + r).toFixed(3);
    const vEnd = (y + height - r).toFixed(3);
    const rText = r.toFixed(3);
    return `M ${hStart} ${top} H ${hEnd} A ${rText} ${rText} 0 0 1 ${right} ${vStart} V ${vEnd} A ${rText} ${rText} 0 0 1 ${hEnd} ${bottom} H ${hStart} A ${rText} ${rText} 0 0 1 ${left} ${vEnd} V ${vStart} A ${rText} ${rText} 0 0 1 ${hStart} ${top} Z`;
};

const CLOSE_ICON_PATH_D = [
    roundedRectArcPath(8, 12, 84, 76, 16),
    roundedRectArcPath(17, 20, 14, 60, 7),
    roundedRectArcPath(40, 20, 43, 60, 11),
].join(' ');

type SidebarProps = {
    isExpanded: boolean;
    onToggle: () => void;
    onCreateNew?: () => void;
    onOpenSearchInterfaces?: () => void;
    onRenameInterface?: (id: string, newTitle: string) => void;
    onDeleteInterface?: (id: string) => void;
    disabled?: boolean;
    onToggleDocumentViewer?: () => void;
    showDocumentViewerButton?: boolean;
    interfaces?: SidebarInterfaceItem[];
    selectedInterfaceId?: string;
    onSelectInterface?: (id: string) => void;
    accountName?: string;
    accountImageUrl?: string;
    onOpenProfile?: () => void;
    onRequestLogout?: () => void;
};

export const Sidebar: React.FC<SidebarProps> = ({
    isExpanded,
    onToggle,
    onCreateNew,
    onOpenSearchInterfaces,
    onRenameInterface,
    onDeleteInterface,
    disabled = false,
    onToggleDocumentViewer,
    showDocumentViewerButton = false,
    interfaces,
    selectedInterfaceId,
    onSelectInterface,
    accountName,
    accountImageUrl,
    onOpenProfile,
    onRequestLogout,
}) => {
    const [logoHover, setLogoHover] = React.useState(false);
    const [createNewHover, setCreateNewHover] = React.useState(false);
    const [searchHover, setSearchHover] = React.useState(false);
    const [moreHover, setMoreHover] = React.useState(false);
    const [documentHover, setDocumentHover] = React.useState(false);
    const [closeHover, setCloseHover] = React.useState(false);
    const [closeHoverArmed, setCloseHoverArmed] = React.useState(true);
    const [hoveredInterfaceId, setHoveredInterfaceId] = React.useState<string | null>(null);
    const [hoveredEllipsisRowId, setHoveredEllipsisRowId] = React.useState<string | null>(null);
    const [hoveredMenuItemKey, setHoveredMenuItemKey] = React.useState<RowMenuItemKey | null>(null);
    const [openRowMenuId, setOpenRowMenuId] = React.useState<string | null>(null);
    const [rowMenuAnchorRect, setRowMenuAnchorRect] = React.useState<DOMRect | null>(null);
    const [rowMenuPosition, setRowMenuPosition] = React.useState<{ left: number; top: number } | null>(null);
    const [menuPlacement, setMenuPlacement] = React.useState<'down' | 'up' | null>(null);
    const [renamingRowId, setRenamingRowId] = React.useState<string | null>(null);
    const [renameDraft, setRenameDraft] = React.useState('');
    const [renameOriginal, setRenameOriginal] = React.useState('');
    const [avatarRowHover, setAvatarRowHover] = React.useState(false);
    const [isAvatarMenuOpen, setIsAvatarMenuOpen] = React.useState(false);
    const [avatarMenuAnchorRect, setAvatarMenuAnchorRect] = React.useState<DOMRect | null>(null);
    const [avatarMenuPosition, setAvatarMenuPosition] = React.useState<{ left: number; top: number } | null>(null);
    const [avatarMenuPlacement, setAvatarMenuPlacement] = React.useState<'up' | 'down' | null>(null);
    const [avatarMenuHoverKey, setAvatarMenuHoverKey] = React.useState<'profile' | 'logout' | null>(null);
    const [isMoreMenuOpen, setIsMoreMenuOpen] = React.useState(false);
    const [moreMenuAnchorRect, setMoreMenuAnchorRect] = React.useState<DOMRect | null>(null);
    const [moreMenuPosition, setMoreMenuPosition] = React.useState<{ left: number; top: number } | null>(null);
    const [moreMenuPlacement, setMoreMenuPlacement] = React.useState<'up' | 'down' | null>(null);
    const [moreMenuHoverKey, setMoreMenuHoverKey] = React.useState<MoreMenuItemKey | null>(null);
    const renameInputRef = React.useRef<HTMLInputElement | null>(null);
    const avatarTriggerRef = React.useRef<HTMLDivElement | null>(null);
    const moreTriggerRef = React.useRef<HTMLButtonElement | null>(null);
    const menuItemPreview = React.useMemo<Array<{ key: RowMenuItemKey; icon: string; label: string; color: string }>>(
        () => [
            { key: 'rename', icon: renameIcon, label: 'Rename', color: SIDEBAR_TEXT_COLOR },
            { key: 'delete', icon: deleteIcon, label: 'Delete', color: ROW_MENU_DELETE_TEXT_COLOR },
        ],
        []
    );
    const displayAccountName = accountName && accountName.trim() ? accountName.trim() : 'Your Name';
    const canOpenAvatarMenu = Boolean(onOpenProfile || onRequestLogout);

    const sidebarStyle: React.CSSProperties = {
        ...SIDEBAR_BASE_STYLE,
        width: isExpanded ? SIDEBAR_EXPANDED_WIDTH_CSS : SIDEBAR_COLLAPSED_WIDTH_CSS,
        minWidth: isExpanded ? SIDEBAR_EXPANDED_MIN_WIDTH_CSS : SIDEBAR_COLLAPSED_WIDTH_CSS,
        pointerEvents: disabled ? 'none' : 'auto',
    };

    const computeRowMenuPlacement = React.useCallback((rect: DOMRect) => {
        const gap = 8;
        const viewportPadding = 8;
        const menuWidth = 168;
        const menuHeight = 96;
        const maxLeft = Math.max(viewportPadding, window.innerWidth - menuWidth - viewportPadding);
        const left = Math.max(viewportPadding, Math.min(rect.right + gap, maxLeft));
        const canOpenDown = rect.bottom + gap + menuHeight <= window.innerHeight - viewportPadding;
        const top = canOpenDown
            ? Math.max(viewportPadding, rect.top)
            : Math.max(viewportPadding, rect.bottom - menuHeight);
        return {
            left,
            top,
            placement: canOpenDown ? 'down' as const : 'up' as const,
        };
    }, []);

    const closeRowMenu = React.useCallback(() => {
        setOpenRowMenuId(null);
        setRowMenuAnchorRect(null);
        setRowMenuPosition(null);
        setMenuPlacement(null);
    }, []);

    const computeAvatarMenuPlacement = React.useCallback((rect: DOMRect) => {
        const gap = 8;
        const viewportPadding = 8;
        const menuWidth = 184;
        const menuHeight = 90;
        const preferredLeft = rect.left;
        const maxLeft = Math.max(viewportPadding, window.innerWidth - menuWidth - viewportPadding);
        const left = Math.max(viewportPadding, Math.min(preferredLeft, maxLeft));
        const canOpenUp = rect.top - gap - menuHeight >= viewportPadding;
        const top = canOpenUp
            ? rect.top - gap - menuHeight
            : Math.min(window.innerHeight - menuHeight - viewportPadding, rect.bottom + gap);
        return {
            left,
            top,
            placement: canOpenUp ? 'up' as const : 'down' as const,
        };
    }, []);

    const closeAvatarMenu = React.useCallback(() => {
        setIsAvatarMenuOpen(false);
        setAvatarMenuAnchorRect(null);
        setAvatarMenuPosition(null);
        setAvatarMenuPlacement(null);
        setAvatarMenuHoverKey(null);
    }, []);

    const computeMoreMenuPlacement = React.useCallback((rect: DOMRect) => {
        const gap = 8;
        const viewportPadding = 8;
        const menuWidth = 208;
        const menuHeight = 88;
        const preferredLeft = rect.left;
        const maxLeft = Math.max(viewportPadding, window.innerWidth - menuWidth - viewportPadding);
        const left = Math.max(viewportPadding, Math.min(preferredLeft, maxLeft));
        const canOpenDown = rect.bottom + gap + menuHeight <= window.innerHeight - viewportPadding;
        const top = canOpenDown
            ? Math.max(viewportPadding, rect.bottom + gap)
            : Math.max(viewportPadding, rect.top - gap - menuHeight);
        return {
            left,
            top,
            placement: canOpenDown ? 'down' as const : 'up' as const,
        };
    }, []);

    const closeMoreMenu = React.useCallback(() => {
        setIsMoreMenuOpen(false);
        setMoreMenuAnchorRect(null);
        setMoreMenuPosition(null);
        setMoreMenuPlacement(null);
        setMoreMenuHoverKey(null);
    }, []);

    const toggleMoreMenuFromTrigger = React.useCallback((trigger: HTMLElement) => {
        if (disabled) return;
        if (isMoreMenuOpen) {
            closeMoreMenu();
            return;
        }
        closeRowMenu();
        closeAvatarMenu();
        const rect = trigger.getBoundingClientRect();
        const placement = computeMoreMenuPlacement(rect);
        setMoreMenuAnchorRect(rect);
        setMoreMenuPosition({ left: placement.left, top: placement.top });
        setMoreMenuPlacement(placement.placement);
        setIsMoreMenuOpen(true);
    }, [closeAvatarMenu, closeMoreMenu, closeRowMenu, computeMoreMenuPlacement, disabled, isMoreMenuOpen]);

    const openAvatarMenuFromTrigger = React.useCallback((trigger: HTMLElement) => {
        if (disabled) return;
        if (!canOpenAvatarMenu) return;
        closeMoreMenu();
        const rect = trigger.getBoundingClientRect();
        const placement = computeAvatarMenuPlacement(rect);
        setAvatarMenuAnchorRect(rect);
        setAvatarMenuPosition({ left: placement.left, top: placement.top });
        setAvatarMenuPlacement(placement.placement);
        setIsAvatarMenuOpen(true);
    }, [canOpenAvatarMenu, closeMoreMenu, computeAvatarMenuPlacement, disabled]);

    const toggleAvatarMenuFromTrigger = React.useCallback((trigger: HTMLElement) => {
        if (isAvatarMenuOpen) {
            closeAvatarMenu();
            return;
        }
        openAvatarMenuFromTrigger(trigger);
    }, [closeAvatarMenu, isAvatarMenuOpen, openAvatarMenuFromTrigger]);

    const cancelRename = React.useCallback(() => {
        setRenamingRowId(null);
        setRenameDraft('');
        setRenameOriginal('');
    }, []);

    const startRename = React.useCallback((id: string, title: string) => {
        if (disabled) return;
        closeRowMenu();
        setRenamingRowId(id);
        setRenameDraft(title);
        setRenameOriginal(title);
    }, [closeRowMenu, disabled]);

    const sanitizeRenameTitle = React.useCallback((raw: string): string => {
        const collapsed = raw.replace(/\s+/g, ' ').trim();
        const capped = collapsed.slice(0, 120).trim();
        return capped.length > 0 ? capped : 'Untitled Interface';
    }, []);

    const confirmRename = React.useCallback(() => {
        if (!renamingRowId) return;
        const nextTitle = sanitizeRenameTitle(renameDraft);
        onRenameInterface?.(renamingRowId, nextTitle);
        setRenamingRowId(null);
        setRenameDraft('');
        setRenameOriginal('');
    }, [onRenameInterface, renameDraft, renamingRowId, sanitizeRenameTitle]);

    const toggleRowMenuForItem = React.useCallback((itemId: string, trigger: HTMLElement) => {
        if (disabled) return;
        if (openRowMenuId === itemId) {
            closeRowMenu();
            return;
        }
        closeMoreMenu();
        const rect = trigger.getBoundingClientRect();
        const placement = computeRowMenuPlacement(rect);
        setOpenRowMenuId(itemId);
        setRowMenuAnchorRect(rect);
        setRowMenuPosition({ left: placement.left, top: placement.top });
        setMenuPlacement(placement.placement);
    }, [closeMoreMenu, closeRowMenu, computeRowMenuPlacement, disabled, openRowMenuId]);

    React.useEffect(() => {
        if (!disabled) return;
        if (openRowMenuId) {
            closeRowMenu();
        }
        if (renamingRowId) {
            cancelRename();
        }
        if (isAvatarMenuOpen) {
            closeAvatarMenu();
        }
        if (isMoreMenuOpen) {
            closeMoreMenu();
        }
    }, [cancelRename, closeAvatarMenu, closeMoreMenu, closeRowMenu, disabled, isAvatarMenuOpen, isMoreMenuOpen, openRowMenuId, renamingRowId]);

    React.useEffect(() => {
        if (!openRowMenuId && !renamingRowId) return;

        const onWindowPointerDown = (event: PointerEvent) => {
            const target = event.target as Element | null;
            if (!target) {
                if (openRowMenuId) {
                    closeRowMenu();
                }
                if (renamingRowId) {
                    cancelRename();
                }
                return;
            }

            if (renamingRowId) {
                if (!target.closest('[data-rename-container="1"]')) {
                    cancelRename();
                }
            }
            if (target.closest('[data-row-menu="1"]')) return;
            if (target.closest('[data-row-ellipsis="1"]')) return;

            if (openRowMenuId) {
                closeRowMenu();
            }
        };

        const onWindowKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                if (renamingRowId) {
                    cancelRename();
                    return;
                }
                if (openRowMenuId) {
                    closeRowMenu();
                }
            }
        };

        window.addEventListener('pointerdown', onWindowPointerDown, true);
        window.addEventListener('keydown', onWindowKeyDown, true);
        return () => {
            window.removeEventListener('pointerdown', onWindowPointerDown, true);
            window.removeEventListener('keydown', onWindowKeyDown, true);
        };
    }, [openRowMenuId, renamingRowId, closeRowMenu, cancelRename]);

    React.useEffect(() => {
        if (!renamingRowId) return;
        const id = window.requestAnimationFrame(() => {
            renameInputRef.current?.focus();
            renameInputRef.current?.select();
        });
        return () => window.cancelAnimationFrame(id);
    }, [renamingRowId]);

    React.useEffect(() => {
        if (!isAvatarMenuOpen || !avatarMenuAnchorRect) return;
        const update = () => {
            if (!avatarMenuAnchorRect) return;
            const placement = computeAvatarMenuPlacement(avatarMenuAnchorRect);
            setAvatarMenuPosition({ left: placement.left, top: placement.top });
            setAvatarMenuPlacement(placement.placement);
        };
        window.addEventListener('resize', update);
        window.addEventListener('scroll', update, true);
        return () => {
            window.removeEventListener('resize', update);
            window.removeEventListener('scroll', update, true);
        };
    }, [avatarMenuAnchorRect, computeAvatarMenuPlacement, isAvatarMenuOpen]);

    React.useEffect(() => {
        if (!isMoreMenuOpen || !moreMenuAnchorRect) return;
        const update = () => {
            if (!moreMenuAnchorRect) return;
            const placement = computeMoreMenuPlacement(moreMenuAnchorRect);
            setMoreMenuPosition({ left: placement.left, top: placement.top });
            setMoreMenuPlacement(placement.placement);
        };
        window.addEventListener('resize', update);
        window.addEventListener('scroll', update, true);
        return () => {
            window.removeEventListener('resize', update);
            window.removeEventListener('scroll', update, true);
        };
    }, [computeMoreMenuPlacement, isMoreMenuOpen, moreMenuAnchorRect]);

    React.useEffect(() => {
        if (!isAvatarMenuOpen) return;

        const onWindowPointerDown = (event: PointerEvent) => {
            const target = event.target as Element | null;
            if (!target) {
                closeAvatarMenu();
                return;
            }
            if (target.closest('[data-avatar-menu="1"]')) return;
            if (target.closest('[data-avatar-trigger="1"]')) return;
            closeAvatarMenu();
        };

        const onWindowKeyDown = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return;
            closeAvatarMenu();
        };

        window.addEventListener('pointerdown', onWindowPointerDown, true);
        window.addEventListener('keydown', onWindowKeyDown, true);
        return () => {
            window.removeEventListener('pointerdown', onWindowPointerDown, true);
            window.removeEventListener('keydown', onWindowKeyDown, true);
        };
    }, [closeAvatarMenu, isAvatarMenuOpen]);

    React.useEffect(() => {
        if (!isMoreMenuOpen) return;

        const onWindowPointerDown = (event: PointerEvent) => {
            const target = event.target as Element | null;
            if (!target) {
                closeMoreMenu();
                return;
            }
            if (target.closest('[data-more-menu="1"]')) return;
            if (target.closest('[data-more-trigger="1"]')) return;
            closeMoreMenu();
        };

        const onWindowKeyDown = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return;
            closeMoreMenu();
        };

        window.addEventListener('pointerdown', onWindowPointerDown, true);
        window.addEventListener('keydown', onWindowKeyDown, true);
        return () => {
            window.removeEventListener('pointerdown', onWindowPointerDown, true);
            window.removeEventListener('keydown', onWindowKeyDown, true);
        };
    }, [closeMoreMenu, isMoreMenuOpen]);

    React.useEffect(() => {
        if (isExpanded) {
            setCloseHover(false);
            setCloseHoverArmed(false);
            return;
        }

        setCloseHover(false);
        setCloseHoverArmed(true);
    }, [isExpanded]);

    React.useEffect(() => {
        if (!isExpanded || closeHoverArmed) return;

        const onFirstPointerMove = () => {
            setCloseHoverArmed(true);
        };

        window.addEventListener('pointermove', onFirstPointerMove, { once: true });
        return () => {
            window.removeEventListener('pointermove', onFirstPointerMove);
        };
    }, [closeHoverArmed, isExpanded]);

    const bottomSectionStyle: React.CSSProperties = {
        ...BOTTOM_SECTION_STYLE,
        alignItems: isExpanded ? 'stretch' : 'center',
        ...(isExpanded
            ? {}
            : {
                paddingLeft: '0px',
                paddingRight: '0px',
            }),
    };

    return (
        <aside
            data-sidebar-root="1"
            data-row-menu-open={openRowMenuId ? '1' : '0'}
            data-row-menu-anchor-ready={rowMenuAnchorRect ? '1' : '0'}
            data-row-menu-position-ready={rowMenuPosition ? '1' : '0'}
            data-row-menu-placement={menuPlacement ?? ''}
            data-row-menu-item-preview-count={String(menuItemPreview.length)}
            style={sidebarStyle}
            onPointerDown={(e) => e.stopPropagation()}
            onWheelCapture={(e) => e.stopPropagation()}
            onWheel={(e) => e.stopPropagation()}
        >
            {/* Top Section */}
            <div style={TOP_SECTION_STYLE}>
                {/* Logo / Toggle Row */}
                <div style={LOGO_ROW_STYLE}>
                    {/*
                      Top-left logo uses layered mask crossfade so shape swap is a true 100ms fade.
                    */}
                    <button
                        type="button"
                        style={ICON_BUTTON_STYLE}
                        onMouseEnter={() => setLogoHover(true)}
                        onMouseLeave={() => setLogoHover(false)}
                        onClick={!isExpanded ? onToggle : undefined}
                        title={!isExpanded ? 'Open sidebar' : undefined}
                    >
                        <span
                            aria-hidden="true"
                            style={{
                                position: 'relative',
                                width: `${LOGO_SIZE}px`,
                                height: `${LOGO_SIZE}px`,
                                display: 'inline-block',
                                pointerEvents: 'none',
                            }}
                        >
                            <span
                                style={{
                                    position: 'absolute',
                                    inset: 0,
                                    display: 'inline-flex',
                                }}
                            >
                                <MaskIcon
                                    src={circleIcon}
                                    size={LOGO_SIZE}
                                    color={logoHover ? HOVER_ACCENT_COLOR : DEFAULT_ICON_COLOR}
                                    opacity={!isExpanded && logoHover ? 0 : (logoHover ? ICON_OPACITY_HOVER : ICON_OPACITY_DEFAULT)}
                                    transition={`opacity ${LOGO_SWAP_TRANSITION}, background-color ${SIDEBAR_HOVER_TRANSITION}`}
                                />
                            </span>
                            <span
                                style={{
                                    position: 'absolute',
                                    inset: 0,
                                    display: 'inline-flex',
                                }}
                            >
                                <MaskIcon
                                    src={sidebarIcon}
                                    size={LOGO_SIZE}
                                    color={logoHover ? HOVER_ACCENT_COLOR : DEFAULT_ICON_COLOR}
                                    opacity={!isExpanded && logoHover ? (logoHover ? ICON_OPACITY_HOVER : ICON_OPACITY_DEFAULT) : 0}
                                    transition={`opacity ${LOGO_SWAP_TRANSITION}, background-color ${SIDEBAR_HOVER_TRANSITION}`}
                                />
                            </span>
                        </span>
                    </button>
                    {isExpanded && (
                        <button
                            type="button"
                            style={{ ...ICON_BUTTON_STYLE, marginLeft: 'auto', marginRight: `${-CLOSE_ICON_OFFSET_LEFT}px` }}
                            onMouseEnter={() => {
                                if (!closeHoverArmed) return;
                                setCloseHover(true);
                            }}
                            onMouseLeave={() => setCloseHover(false)}
                            onClick={onToggle}
                            title="Close sidebar"
                        >
                            <svg
                                aria-hidden="true"
                                viewBox={CLOSE_ICON_VIEWBOX}
                                style={{
                                    width: `${CLOSE_ICON_SIZE_PX}px`,
                                    height: `${CLOSE_ICON_SIZE_PX}px`,
                                    display: 'block',
                                    pointerEvents: 'none',
                                }}
                            >
                                <path
                                    d={CLOSE_ICON_PATH_D}
                                    fill={closeHover ? HOVER_ACCENT_COLOR : DEFAULT_ICON_COLOR}
                                    fillRule="evenodd"
                                    style={{
                                        opacity: closeHover ? ICON_OPACITY_HOVER : ICON_OPACITY_DEFAULT,
                                        transition: `fill ${SIDEBAR_HOVER_TRANSITION}, opacity ${SIDEBAR_HOVER_TRANSITION}`,
                                    }}
                                />
                            </svg>
                        </button>
                    )}
                </div>

                {/* Nav Items */}
                <div style={{ marginTop: `${CREATE_NEW_OFFSET_TOP}px` }}>
                    <NavItem
                        icon={createNewIcon}
                        label="Create New"
                        isExpanded={isExpanded}
                        isHovered={createNewHover}
                        onMouseEnter={() => setCreateNewHover(true)}
                        onMouseLeave={() => setCreateNewHover(false)}
                        onClick={onCreateNew}
                    />
                </div>
                <div style={{ marginTop: `${SEARCH_OFFSET_TOP}px` }}>
                    <NavItem
                        icon={searchIcon}
                        label="Search Interfaces"
                        isExpanded={isExpanded}
                        isHovered={searchHover}
                        onMouseEnter={() => setSearchHover(true)}
                        onMouseLeave={() => setSearchHover(false)}
                        onClick={onOpenSearchInterfaces}
                        hardShieldInput
                    />
                </div>
                <div style={{ marginTop: `${MORE_OFFSET_TOP}px` }}>
                    <NavItem
                        buttonRef={moreTriggerRef}
                        dataMoreTrigger
                        icon={threeDotIcon}
                        label="More"
                        isExpanded={isExpanded}
                        isHovered={moreHover}
                        onMouseEnter={() => setMoreHover(true)}
                        onMouseLeave={() => setMoreHover(false)}
                        onClick={(e) => {
                            e.stopPropagation();
                            const trigger = e.currentTarget as HTMLButtonElement;
                            toggleMoreMenuFromTrigger(trigger);
                        }}
                        hardShieldInput
                    />
                </div>

            </div>

            {/* Your Interfaces Section (expanded only, isolated scroll area) */}
            {isExpanded && (
                <div style={INTERFACES_SECTION_STYLE}>
                    <div style={SECTION_HEADER_STYLE}>Your Interfaces</div>
                    <div style={INTERFACES_LIST_STYLE}>
                        {!interfaces || interfaces.length === 0 ? (
                            <div style={INTERFACE_EMPTY_STATE_STYLE}>No saved interfaces yet.</div>
                        ) : (
                            interfaces.map((item) => {
                                const isHovered = hoveredInterfaceId === item.id;
                                const isSelected = selectedInterfaceId === item.id;
                                const isRenaming = renamingRowId === item.id;
                                const showRowEllipsis = (isHovered || openRowMenuId === item.id) && !isRenaming;
                                return (
                                    <button
                                        key={item.id}
                                        type="button"
                                        style={{
                                            ...INTERFACE_ITEM_STYLE,
                                            color: isHovered || isSelected ? HOVER_ACCENT_COLOR : INTERFACE_ITEM_STYLE.color,
                                            background: isSelected ? 'rgba(99, 171, 255, 0.12)' : INTERFACE_ITEM_STYLE.background,
                                        }}
                                        onPointerDown={(e) => e.stopPropagation()}
                                        onWheelCapture={(e) => e.stopPropagation()}
                                        onWheel={(e) => e.stopPropagation()}
                                        onMouseEnter={() => setHoveredInterfaceId(item.id)}
                                        onMouseLeave={() => setHoveredInterfaceId(null)}
                                        onClick={() => {
                                            if (isRenaming) return;
                                            onSelectInterface?.(item.id);
                                        }}
                                        title={item.subtitle}
                                    >
                                        <span style={INTERFACE_ROW_CONTENT_STYLE}>
                                            {isRenaming ? (
                                                <span
                                                    data-rename-container="1"
                                                    style={RENAME_CONTAINER_STYLE}
                                                    onPointerDown={(e) => e.stopPropagation()}
                                                    onPointerUp={(e) => e.stopPropagation()}
                                                    onClick={(e) => e.stopPropagation()}
                                                    onWheelCapture={(e) => e.stopPropagation()}
                                                    onWheel={(e) => e.stopPropagation()}
                                                >
                                                    <input
                                                        ref={renameInputRef}
                                                        type="text"
                                                        value={renameDraft}
                                                        onChange={(e) => setRenameDraft(e.target.value)}
                                                        style={RENAME_INPUT_STYLE}
                                                        onPointerDown={(e) => e.stopPropagation()}
                                                        onPointerUp={(e) => e.stopPropagation()}
                                                        onClick={(e) => e.stopPropagation()}
                                                        onWheelCapture={(e) => e.stopPropagation()}
                                                        onWheel={(e) => e.stopPropagation()}
                                                        onKeyDown={(e) => {
                                                            e.stopPropagation();
                                                            if (e.key === 'Enter') {
                                                                e.preventDefault();
                                                                confirmRename();
                                                                return;
                                                            }
                                                            if (e.key === 'Escape') {
                                                                e.preventDefault();
                                                                setRenameDraft(renameOriginal);
                                                                cancelRename();
                                                            }
                                                        }}
                                                    />
                                                </span>
                                            ) : (
                                                <span style={INTERFACE_TEXT_STYLE}>{item.title}</span>
                                            )}
                                            <span style={INTERFACE_ROW_MENU_SLOT_STYLE}>
                                                <button
                                                    type="button"
                                                    disabled={disabled}
                                                    data-row-ellipsis="1"
                                                    aria-label={`Open actions for ${item.title}`}
                                                    title="Session actions"
                                                    style={{
                                                        ...ROW_ELLIPSIS_BUTTON_STYLE,
                                                        border: 'none',
                                                        background: 'transparent',
                                                        cursor: disabled ? 'default' : ROW_ELLIPSIS_BUTTON_STYLE.cursor,
                                                        opacity: showRowEllipsis ? 1 : 0,
                                                    }}
                                                    onPointerDown={(e) => e.stopPropagation()}
                                                    onPointerUp={(e) => e.stopPropagation()}
                                                    onWheelCapture={(e) => e.stopPropagation()}
                                                    onWheel={(e) => e.stopPropagation()}
                                                    onMouseEnter={() => setHoveredEllipsisRowId(item.id)}
                                                    onMouseLeave={() => setHoveredEllipsisRowId((curr) => (curr === item.id ? null : curr))}
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        if (disabled) return;
                                                        const el = e.currentTarget as HTMLButtonElement;
                                                        if (isRenaming) return;
                                                        toggleRowMenuForItem(item.id, el);
                                                    }}
                                                    onKeyDown={(e) => {
                                                        if (e.key !== 'Enter' && e.key !== ' ') return;
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        if (disabled) return;
                                                        const el = e.currentTarget as HTMLButtonElement;
                                                        toggleRowMenuForItem(item.id, el);
                                                    }}
                                                >
                                                    <MaskIcon
                                                        src={verticalElipsisIcon}
                                                        size={12}
                                                        color={hoveredEllipsisRowId === item.id
                                                            ? HOVER_ACCENT_COLOR
                                                            : (isSelected ? HOVER_ACCENT_COLOR : 'rgba(255, 255, 255, 0.75)')}
                                                        opacity={1}
                                                    />
                                                </button>
                                            </span>
                                        </span>
                                    </button>
                                );
                            })
                        )}
                    </div>
                </div>
            )}

            {openRowMenuId !== null && rowMenuPosition !== null ? (
                <div
                    data-row-menu="1"
                    style={{
                        ...ROW_MENU_POPUP_STYLE,
                        left: `${rowMenuPosition.left}px`,
                        top: `${rowMenuPosition.top}px`,
                        transformOrigin: menuPlacement === 'up' ? 'bottom left' : 'top left',
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                    onPointerUp={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                    onWheelCapture={(e) => e.stopPropagation()}
                    onWheel={(e) => e.stopPropagation()}
                >
                    {menuItemPreview.map((menuItem) => (
                        <button
                            key={menuItem.key}
                            type="button"
                            style={ROW_MENU_ITEM_STYLE}
                            onPointerDown={(e) => e.stopPropagation()}
                            onPointerUp={(e) => e.stopPropagation()}
                            onWheelCapture={(e) => e.stopPropagation()}
                            onWheel={(e) => e.stopPropagation()}
                            onMouseEnter={() => setHoveredMenuItemKey(menuItem.key)}
                            onMouseLeave={() => setHoveredMenuItemKey((curr) => (curr === menuItem.key ? null : curr))}
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (disabled) {
                                    closeRowMenu();
                                    return;
                                }
                                if (menuItem.key === 'rename' && openRowMenuId) {
                                    const current = interfaces?.find((item) => item.id === openRowMenuId);
                                    if (current) {
                                        startRename(current.id, current.title);
                                    }
                                } else if (menuItem.key === 'delete' && openRowMenuId) {
                                    onDeleteInterface?.(openRowMenuId);
                                } else if (import.meta.env.DEV) {
                                    console.log('[sidebar] menu_%s_clicked id=%s', menuItem.key, openRowMenuId);
                                }
                                closeRowMenu();
                                setHoveredMenuItemKey(null);
                            }}
                        >
                            <span
                                style={{
                                    ...ROW_MENU_ITEM_CONTENT_STYLE,
                                    opacity: menuItem.key === 'delete' && hoveredMenuItemKey === 'delete'
                                        ? 0.5
                                        : 1,
                                }}
                            >
                                <MaskIcon
                                    src={menuItem.icon}
                                    size={14}
                                    color={menuItem.key === 'rename' && hoveredMenuItemKey === 'rename'
                                        ? HOVER_ACCENT_COLOR
                                        : menuItem.color}
                                    opacity={1}
                                />
                                <span
                                    style={{
                                        ...ROW_MENU_ITEM_LABEL_STYLE,
                                        color: menuItem.key === 'rename' && hoveredMenuItemKey === 'rename'
                                            ? HOVER_ACCENT_COLOR
                                            : menuItem.color,
                                    }}
                                >
                                    {menuItem.label}
                                </span>
                            </span>
                        </button>
                    ))}
                </div>
            ) : null}

            {isAvatarMenuOpen && avatarMenuPosition ? (
                <div
                    data-avatar-menu="1"
                    style={{
                        ...AVATAR_MENU_POPUP_STYLE,
                        left: `${avatarMenuPosition.left}px`,
                        top: `${avatarMenuPosition.top}px`,
                        transformOrigin: avatarMenuPlacement === 'down' ? 'top left' : 'bottom left',
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                    onPointerUp={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                    onWheelCapture={(e) => e.stopPropagation()}
                    onWheel={(e) => e.stopPropagation()}
                >
                    <button
                        type="button"
                        style={AVATAR_MENU_ITEM_STYLE}
                        onPointerDown={(e) => e.stopPropagation()}
                        onPointerUp={(e) => e.stopPropagation()}
                        onWheelCapture={(e) => e.stopPropagation()}
                        onWheel={(e) => e.stopPropagation()}
                        onMouseEnter={() => setAvatarMenuHoverKey('profile')}
                        onMouseLeave={() => setAvatarMenuHoverKey((curr) => (curr === 'profile' ? null : curr))}
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            closeAvatarMenu();
                            onOpenProfile?.();
                        }}
                    >
                        <span style={AVATAR_MENU_ITEM_CONTENT_STYLE}>
                            {accountImageUrl ? (
                                <img
                                    src={accountImageUrl}
                                    alt="avatar"
                                    style={AVATAR_MENU_ACCOUNT_PHOTO_STYLE}
                                />
                            ) : (
                                <span style={AVATAR_MENU_ACCOUNT_FALLBACK_STYLE}>BA</span>
                            )}
                            <span
                                style={{
                                    ...AVATAR_MENU_ACCOUNT_NAME_STYLE,
                                    color: avatarMenuHoverKey === 'profile' ? HOVER_ACCENT_COLOR : SIDEBAR_TEXT_COLOR,
                                }}
                            >
                                {displayAccountName}
                            </span>
                        </span>
                    </button>
                    <button
                        type="button"
                        style={AVATAR_MENU_ITEM_STYLE}
                        onPointerDown={(e) => e.stopPropagation()}
                        onPointerUp={(e) => e.stopPropagation()}
                        onWheelCapture={(e) => e.stopPropagation()}
                        onWheel={(e) => e.stopPropagation()}
                        onMouseEnter={() => setAvatarMenuHoverKey('logout')}
                        onMouseLeave={() => setAvatarMenuHoverKey((curr) => (curr === 'logout' ? null : curr))}
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            closeAvatarMenu();
                            onRequestLogout?.();
                        }}
                    >
                        <span
                            style={{
                                ...AVATAR_MENU_ITEM_CONTENT_STYLE,
                                opacity: avatarMenuHoverKey === 'logout' ? 0.5 : 1,
                            }}
                        >
                            <MaskIcon
                                src={logoutIcon}
                                size={14}
                                color="#ff4b4e"
                                opacity={1}
                            />
                            <span
                                style={{
                                    ...AVATAR_MENU_ITEM_LABEL_STYLE,
                                    color: SIDEBAR_TEXT_COLOR,
                                }}
                            >
                                Log Out
                            </span>
                        </span>
                    </button>
                </div>
            ) : null}

            {isMoreMenuOpen && moreMenuPosition ? (
                <div
                    data-more-menu="1"
                    style={{
                        ...MORE_MENU_POPUP_STYLE,
                        left: `${moreMenuPosition.left}px`,
                        top: `${moreMenuPosition.top}px`,
                        transformOrigin: moreMenuPlacement === 'down' ? 'top left' : 'bottom left',
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                    onPointerUp={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                    onWheelCapture={(e) => e.stopPropagation()}
                    onWheel={(e) => e.stopPropagation()}
                >
                    <button
                        type="button"
                        style={MORE_MENU_ITEM_STYLE}
                        onPointerDown={(e) => e.stopPropagation()}
                        onPointerUp={(e) => e.stopPropagation()}
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            closeMoreMenu();
                            // TODO: implement Suggestion and Feedback UI flow.
                            console.log('[sidebar] suggestion_feedback_clicked');
                        }}
                        onWheelCapture={(e) => e.stopPropagation()}
                        onWheel={(e) => e.stopPropagation()}
                        onMouseEnter={() => setMoreMenuHoverKey('suggestion')}
                        onMouseLeave={() => setMoreMenuHoverKey((curr) => (curr === 'suggestion' ? null : curr))}
                    >
                        <span style={MORE_MENU_ITEM_CONTENT_STYLE}>
                            <MaskIcon
                                src={suggestionFeedbackIcon}
                                size={14}
                                color={moreMenuHoverKey === 'suggestion' ? HOVER_ACCENT_COLOR : SIDEBAR_TEXT_COLOR}
                                opacity={1}
                            />
                            <span
                                style={{
                                    ...MORE_MENU_ITEM_LABEL_STYLE,
                                    color: moreMenuHoverKey === 'suggestion' ? HOVER_ACCENT_COLOR : SIDEBAR_TEXT_COLOR,
                                }}
                            >
                                Suggestion and Feedback
                            </span>
                        </span>
                    </button>
                    <button
                        type="button"
                        style={MORE_MENU_ITEM_STYLE}
                        onPointerDown={(e) => e.stopPropagation()}
                        onPointerUp={(e) => e.stopPropagation()}
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            closeMoreMenu();
                            window.open('https://blog.arnvoid.com', '_blank', 'noopener,noreferrer');
                        }}
                        onWheelCapture={(e) => e.stopPropagation()}
                        onWheel={(e) => e.stopPropagation()}
                        onMouseEnter={() => setMoreMenuHoverKey('blog')}
                        onMouseLeave={() => setMoreMenuHoverKey((curr) => (curr === 'blog' ? null : curr))}
                    >
                        <span style={MORE_MENU_ITEM_CONTENT_STYLE}>
                            <MaskIcon
                                src={blogIcon}
                                size={14}
                                color={moreMenuHoverKey === 'blog' ? HOVER_ACCENT_COLOR : SIDEBAR_TEXT_COLOR}
                                opacity={1}
                            />
                            <span
                                style={{
                                    ...MORE_MENU_ITEM_LABEL_STYLE,
                                    color: moreMenuHoverKey === 'blog' ? HOVER_ACCENT_COLOR : SIDEBAR_TEXT_COLOR,
                                }}
                            >
                                Arnvoid Blog
                            </span>
                        </span>
                    </button>
                </div>
            ) : null}

            {/* Bottom Section - User Avatar */}
            <div
                style={bottomSectionStyle}
            >
                {showDocumentViewerButton ? (
                    <button
                        type="button"
                        style={{
                            ...NAV_ITEM_STYLE,
                            justifyContent: 'flex-start',
                            alignSelf: 'stretch',
                            marginBottom: '8px',
                        }}
                        onClick={onToggleDocumentViewer}
                        onPointerDown={(e) => e.stopPropagation()}
                        onMouseEnter={() => setDocumentHover(true)}
                        onMouseLeave={() => setDocumentHover(false)}
                        title="Open document viewer"
                    >
                        <MaskIcon
                            src={documentIcon}
                            size={ICON_SIZE}
                            color={documentHover ? HOVER_ACCENT_COLOR : DEFAULT_ICON_COLOR}
                            opacity={documentHover ? ICON_OPACITY_HOVER : ICON_OPACITY_DEFAULT}
                        />
                        {isExpanded && (
                            <span
                                style={{
                                    ...NAV_LABEL_STYLE,
                                    color: documentHover ? HOVER_ACCENT_COLOR : NAV_LABEL_STYLE.color,
                                }}
                            >
                                Document Viewer
                            </span>
                        )}
                    </button>
                ) : null}
                <div style={AVATAR_SECTION_STYLE}>
                    <div
                        ref={avatarTriggerRef}
                        data-avatar-trigger="1"
                        style={{
                            ...PROFILE_ROW_STYLE,
                            width: isExpanded ? 'calc(100% - 10px)' : 'fit-content',
                            margin: isExpanded ? undefined : '0',
                            marginRight: isExpanded ? '10px' : undefined,
                            backgroundColor: avatarRowHover ? 'rgba(215, 245, 255, 0.14)' : 'transparent',
                            cursor: canOpenAvatarMenu ? 'pointer' : 'default',
                        }}
                        onPointerDown={(e) => e.stopPropagation()}
                        onPointerUp={(e) => e.stopPropagation()}
                        onWheelCapture={(e) => e.stopPropagation()}
                        onWheel={(e) => e.stopPropagation()}
                        onClick={(e) => {
                            e.stopPropagation();
                            if (!canOpenAvatarMenu) return;
                            const target = e.currentTarget as HTMLDivElement;
                            toggleAvatarMenuFromTrigger(target);
                        }}
                        onMouseEnter={() => setAvatarRowHover(true)}
                        onMouseLeave={() => setAvatarRowHover(false)}
                    >
                        <button
                            type="button"
                            style={{
                                ...ICON_BUTTON_STYLE,
                                padding: '0',
                                width: '32px',
                                height: '32px',
                                lineHeight: 0,
                            }}
                            onPointerDown={(e) => e.stopPropagation()}
                            onPointerUp={(e) => e.stopPropagation()}
                            onWheelCapture={(e) => e.stopPropagation()}
                            onWheel={(e) => e.stopPropagation()}
                        >
                            {accountImageUrl ? (
                                <img
                                    src={accountImageUrl}
                                    alt="avatar"
                                    style={AVATAR_IMAGE_STYLE}
                                />
                            ) : (
                                <div
                                    style={{
                                        ...AVATAR_STYLE,
                                        opacity: 1,
                                    }}
                                >
                                    BA
                                </div>
                            )}
                        </button>
                        {isExpanded && <span style={AVATAR_NAME_STYLE}>{displayAccountName}</span>}
                    </div>
                </div>
            </div>
        </aside>
    );
};

// ===========================================================================
// NavItem Sub-component
// ===========================================================================
type NavItemProps = {
    icon: string;
    label: string;
    isExpanded: boolean;
    isHovered: boolean;
    onMouseEnter: () => void;
    onMouseLeave: () => void;
    onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
    hardShieldInput?: boolean;
    dataMoreTrigger?: boolean;
    buttonRef?: React.Ref<HTMLButtonElement>;
};

const NavItem: React.FC<NavItemProps> = ({
    icon,
    label,
    isExpanded,
    isHovered,
    onMouseEnter,
    onMouseLeave,
    onClick,
    hardShieldInput = false,
    dataMoreTrigger = false,
    buttonRef,
}) => (
    <button
        ref={buttonRef}
        type="button"
        data-more-trigger={dataMoreTrigger ? '1' : undefined}
        style={NAV_ITEM_STYLE}
        onPointerDown={(e) => e.stopPropagation()}
        onPointerUp={hardShieldInput ? (e) => e.stopPropagation() : undefined}
        onWheelCapture={hardShieldInput ? (e) => e.stopPropagation() : undefined}
        onWheel={hardShieldInput ? (e) => e.stopPropagation() : undefined}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        onClick={(e) => {
            if (hardShieldInput) {
                e.stopPropagation();
            }
            onClick?.(e);
        }}
    >
        <MaskIcon
            src={icon}
            size={ICON_SIZE}
            color={isHovered ? HOVER_ACCENT_COLOR : DEFAULT_ICON_COLOR}
            opacity={isHovered ? ICON_OPACITY_HOVER : ICON_OPACITY_DEFAULT}
        />
        {isExpanded && (
            <span
                style={{
                    ...NAV_LABEL_STYLE,
                    color: isHovered ? HOVER_ACCENT_COLOR : NAV_LABEL_STYLE.color,
                    opacity: 1,
                }}
            >
                {label}
            </span>
        )}
    </button>
);

type MaskIconProps = {
    src: string;
    size: number;
    color: string;
    opacity?: number;
    transition?: string;
};

const MaskIcon: React.FC<MaskIconProps> = ({ src, size, color, opacity = 1, transition }) => (
    <span
        aria-hidden="true"
        style={{
            width: `${size}px`,
            height: `${size}px`,
            display: 'inline-block',
            flexShrink: 0,
            backgroundColor: color,
            opacity,
            WebkitMaskImage: `url(${src})`,
            maskImage: `url(${src})`,
            WebkitMaskRepeat: 'no-repeat',
            maskRepeat: 'no-repeat',
            WebkitMaskPosition: 'center',
            maskPosition: 'center',
            WebkitMaskSize: 'contain',
            maskSize: 'contain',
            transition: transition ?? `background-color ${SIDEBAR_HOVER_TRANSITION}, opacity ${SIDEBAR_HOVER_TRANSITION}`,
        }}
    />
);

// ===========================================================================
// Styles
// ===========================================================================
const SIDEBAR_BASE_STYLE: React.CSSProperties = {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    background: '#06060A',
    borderRight: '1px solid rgba(255, 255, 255, 0.1)',
    display: 'flex',
    flexDirection: 'column',
    zIndex: LAYER_SIDEBAR,
    boxSizing: 'border-box',
};

const TOP_SECTION_STYLE: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    padding: `12px ${8 + ICON_OFFSET_LEFT}px 12px ${8 - ICON_OFFSET_LEFT}px`,
    gap: '4px',
};

const LOGO_ROW_STYLE: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    marginBottom: '8px',
    marginTop: `${LOGO_OFFSET_TOP}px`,
};

const ICON_BUTTON_STYLE: React.CSSProperties = {
    background: 'transparent',
    border: 'none',
    padding: '6px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
};

const NAV_ITEM_STYLE: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    background: 'transparent',
    border: 'none',
    padding: '8px 6px',
    cursor: 'pointer',
    width: '100%',
    textAlign: 'left',
};

const NAV_LABEL_STYLE: React.CSSProperties = {
    color: SIDEBAR_TEXT_COLOR,
    fontSize: `${FONT_SIZE_NAV}px`,
    fontFamily: 'var(--font-ui)',
    whiteSpace: 'nowrap',
    transition: `color ${SIDEBAR_HOVER_TRANSITION}`,
};

const INTERFACES_SECTION_STYLE: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    padding: `0 ${8 + ICON_OFFSET_LEFT}px 0 ${8 - ICON_OFFSET_LEFT}px`,
    marginTop: '12px',
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
};

const SECTION_HEADER_STYLE: React.CSSProperties = {
    fontSize: `${FONT_SIZE_SECTION_HEADER}px`,
    color: 'rgba(215, 245, 255, 0.5)',
    fontFamily: 'var(--font-ui)',
    letterSpacing: '0.5px',
    padding: '8px 6px',
};

const INTERFACES_LIST_STYLE: React.CSSProperties = {
    flex: 1,
    overflowY: 'auto',
    overflowX: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
};

const INTERFACE_ITEM_STYLE: React.CSSProperties = {
    display: 'block',
    width: '100%',
    padding: '8px 6px',
    background: 'transparent',
    border: 'none',
    color: SIDEBAR_TEXT_COLOR,
    fontSize: `${FONT_SIZE_NAV}px`,
    fontFamily: 'var(--font-ui)',
    textAlign: 'left',
    cursor: 'pointer',
    opacity: 1,
    transition: `color ${SIDEBAR_HOVER_TRANSITION}, background-color ${SIDEBAR_HOVER_TRANSITION}`,
};

const INTERFACE_ROW_CONTENT_STYLE: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    gap: '8px',
};

const INTERFACE_TEXT_STYLE: React.CSSProperties = {
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'normal',
    wordBreak: 'break-word',
};

const INTERFACE_ROW_MENU_SLOT_STYLE: React.CSSProperties = {
    width: '24px',
    flexShrink: 0,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
};

const ROW_ELLIPSIS_BUTTON_STYLE: React.CSSProperties = {
    width: '20px',
    height: '20px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    transition: `opacity ${SIDEBAR_HOVER_TRANSITION}`,
    borderRadius: '4px',
};

const ROW_MENU_POPUP_STYLE: React.CSSProperties = {
    position: 'fixed',
    width: '168px',
    padding: '6px',
    borderRadius: '10px',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    background: 'rgba(22, 24, 30, 0.98)',
    boxShadow: '0 14px 28px rgba(0, 0, 0, 0.45)',
    zIndex: LAYER_SIDEBAR_ROW_MENU,
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
};

const ROW_MENU_ITEM_STYLE: React.CSSProperties = {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '8px 10px',
    border: 'none',
    borderRadius: '8px',
    background: 'transparent',
    textAlign: 'left',
    cursor: 'pointer',
};

const ROW_MENU_ITEM_CONTENT_STYLE: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '10px',
    transition: `filter ${SIDEBAR_HOVER_TRANSITION}`,
};

const ROW_MENU_ITEM_LABEL_STYLE: React.CSSProperties = {
    fontFamily: 'var(--font-ui)',
    fontSize: `${FONT_SIZE_NAV}px`,
    lineHeight: 1.2,
    color: SIDEBAR_TEXT_COLOR,
    transition: `color ${SIDEBAR_HOVER_TRANSITION}`,
};

const AVATAR_MENU_POPUP_STYLE: React.CSSProperties = {
    position: 'fixed',
    width: '184px',
    padding: '6px',
    borderRadius: '10px',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    background: 'rgba(22, 24, 30, 0.98)',
    boxShadow: '0 14px 28px rgba(0, 0, 0, 0.45)',
    zIndex: LAYER_SIDEBAR_ROW_MENU,
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
};

const AVATAR_MENU_ITEM_STYLE: React.CSSProperties = {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    padding: '8px 10px',
    border: 'none',
    borderRadius: '8px',
    background: 'transparent',
    textAlign: 'left',
    cursor: 'pointer',
};

const AVATAR_MENU_ITEM_CONTENT_STYLE: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '10px',
    transition: `filter ${SIDEBAR_HOVER_TRANSITION}`,
};

const AVATAR_MENU_ITEM_LABEL_STYLE: React.CSSProperties = {
    fontFamily: 'var(--font-ui)',
    fontSize: `${FONT_SIZE_NAV}px`,
    lineHeight: 1.2,
    color: SIDEBAR_TEXT_COLOR,
    transition: `color ${SIDEBAR_HOVER_TRANSITION}`,
};

const AVATAR_MENU_ACCOUNT_PHOTO_STYLE: React.CSSProperties = {
    width: '20px',
    height: '20px',
    borderRadius: '50%',
    objectFit: 'cover',
    display: 'block',
    flexShrink: 0,
};

const AVATAR_MENU_ACCOUNT_FALLBACK_STYLE: React.CSSProperties = {
    width: '20px',
    height: '20px',
    borderRadius: '50%',
    background: '#2dd4bf',
    color: SIDEBAR_TEXT_COLOR,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'var(--font-ui)',
    fontSize: '9px',
    fontWeight: 700,
    lineHeight: 1,
    flexShrink: 0,
};

const AVATAR_MENU_ACCOUNT_NAME_STYLE: React.CSSProperties = {
    ...AVATAR_MENU_ITEM_LABEL_STYLE,
    minWidth: 0,
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
};

const MORE_MENU_POPUP_STYLE: React.CSSProperties = {
    position: 'fixed',
    width: '208px',
    padding: '6px',
    borderRadius: '10px',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    background: 'rgba(22, 24, 30, 0.98)',
    boxShadow: '0 14px 28px rgba(0, 0, 0, 0.45)',
    zIndex: LAYER_SIDEBAR_ROW_MENU,
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
};

const MORE_MENU_ITEM_STYLE: React.CSSProperties = {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '8px 10px',
    border: 'none',
    borderRadius: '8px',
    background: 'transparent',
    textAlign: 'left',
    cursor: 'pointer',
};

const MORE_MENU_ITEM_CONTENT_STYLE: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '10px',
    transition: `filter ${SIDEBAR_HOVER_TRANSITION}`,
};

const MORE_MENU_ITEM_LABEL_STYLE: React.CSSProperties = {
    fontFamily: 'var(--font-ui)',
    fontSize: `${FONT_SIZE_NAV}px`,
    lineHeight: 1.2,
    color: SIDEBAR_TEXT_COLOR,
    transition: `color ${SIDEBAR_HOVER_TRANSITION}`,
};

const RENAME_CONTAINER_STYLE: React.CSSProperties = {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    alignItems: 'center',
};

const RENAME_INPUT_STYLE: React.CSSProperties = {
    width: '100%',
    height: '26px',
    borderRadius: '6px',
    border: '1px solid rgba(99, 171, 255, 0.45)',
    background: 'rgba(12, 15, 22, 0.95)',
    color: SIDEBAR_TEXT_COLOR,
    fontFamily: 'var(--font-ui)',
    fontSize: `${FONT_SIZE_NAV}px`,
    lineHeight: 1.2,
    padding: '4px 8px',
    outline: 'none',
};

const INTERFACE_EMPTY_STATE_STYLE: React.CSSProperties = {
    ...INTERFACE_ITEM_STYLE,
    color: SIDEBAR_TEXT_COLOR,
    cursor: 'default',
    pointerEvents: 'none',
};

const BOTTOM_SECTION_STYLE: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
    marginTop: 'auto',
    padding: `12px ${8 + ICON_OFFSET_LEFT}px 12px ${8 - ICON_OFFSET_LEFT}px`,
};

const AVATAR_SECTION_STYLE: React.CSSProperties = {
    width: '100%',
    borderTop: '1px solid rgba(255, 255, 255, 0.1)',
    paddingTop: '8px',
    display: 'flex',
    justifyContent: 'center',
};

const PROFILE_ROW_STYLE: React.CSSProperties = {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    borderRadius: '10px',
    height: '36px',
    padding: '0',
    transition: `background-color ${SIDEBAR_HOVER_TRANSITION}`,
};

const AVATAR_STYLE: React.CSSProperties = {
    width: `${AVATAR_SIZE}px`,
    height: `${AVATAR_SIZE}px`,
    borderRadius: '50%',
    background: '#2dd4bf',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: `${FONT_SIZE_AVATAR}px`,
    fontWeight: 600,
    color: SIDEBAR_TEXT_COLOR,
    fontFamily: 'var(--font-ui)',
};

const AVATAR_IMAGE_STYLE: React.CSSProperties = {
    width: `${AVATAR_SIZE}px`,
    height: `${AVATAR_SIZE}px`,
    borderRadius: '50%',
    objectFit: 'cover',
    display: 'block',
};

const AVATAR_NAME_STYLE: React.CSSProperties = {
    color: SIDEBAR_TEXT_COLOR,
    fontSize: `${FONT_SIZE_NAV}px`,
    lineHeight: 1,
    fontFamily: 'var(--font-ui)',
    opacity: 1,
    marginLeft: `${NAME_OFFSET_LEFT}px`,
};


