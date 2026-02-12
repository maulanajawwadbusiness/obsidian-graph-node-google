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
import { LAYER_SIDEBAR, LAYER_SIDEBAR_ROW_MENU } from '../ui/layers';

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

const COLLAPSED_WIDTH = '35px';
const EXPANDED_WIDTH = '10vw';
const MIN_EXPANDED_WIDTH = '200px';
const ICON_SIZE = 18 * SIDEBAR_SCALE;
// Logo size multiplier: 1.0 = base, 1.5 = 50% larger
const LOGO_SCALE = 1.05;
const LOGO_SIZE = 20 * SIDEBAR_SCALE * LOGO_SCALE;
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
const ROW_MENU_DELETE_TEXT_COLOR = '#ff4b4e';
type RowMenuItemKey = 'rename' | 'delete';

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
}) => {
    const [logoHover, setLogoHover] = React.useState(false);
    const [createNewHover, setCreateNewHover] = React.useState(false);
    const [searchHover, setSearchHover] = React.useState(false);
    const [moreHover, setMoreHover] = React.useState(false);
    const [documentHover, setDocumentHover] = React.useState(false);
    const [closeHover, setCloseHover] = React.useState(false);
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
    const renameInputRef = React.useRef<HTMLInputElement | null>(null);
    const menuItemPreview = React.useMemo<Array<{ key: RowMenuItemKey; icon: string; label: string; color: string }>>(
        () => [
            { key: 'rename', icon: renameIcon, label: 'Rename', color: '#e7e7e7' },
            { key: 'delete', icon: deleteIcon, label: 'Delete', color: ROW_MENU_DELETE_TEXT_COLOR },
        ],
        []
    );
    const displayAccountName = accountName && accountName.trim() ? accountName.trim() : 'Your Name';

    const sidebarStyle: React.CSSProperties = {
        ...SIDEBAR_BASE_STYLE,
        width: isExpanded ? EXPANDED_WIDTH : COLLAPSED_WIDTH,
        minWidth: isExpanded ? MIN_EXPANDED_WIDTH : COLLAPSED_WIDTH,
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
        const rect = trigger.getBoundingClientRect();
        const placement = computeRowMenuPlacement(rect);
        setOpenRowMenuId(itemId);
        setRowMenuAnchorRect(rect);
        setRowMenuPosition({ left: placement.left, top: placement.top });
        setMenuPlacement(placement.placement);
    }, [closeRowMenu, computeRowMenuPlacement, disabled, openRowMenuId]);

    React.useEffect(() => {
        if (!disabled) return;
        if (openRowMenuId) {
            closeRowMenu();
        }
        if (renamingRowId) {
            cancelRename();
        }
    }, [cancelRename, closeRowMenu, disabled, openRowMenuId, renamingRowId]);

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
                    <button
                        type="button"
                        style={ICON_BUTTON_STYLE}
                        onMouseEnter={() => setLogoHover(true)}
                        onMouseLeave={() => setLogoHover(false)}
                        onClick={!isExpanded ? onToggle : undefined}
                        title={!isExpanded ? 'Open sidebar' : undefined}
                    >
                        <MaskIcon
                            src={!isExpanded && logoHover ? sidebarIcon : circleIcon}
                            size={LOGO_SIZE}
                            color={logoHover ? HOVER_ACCENT_COLOR : DEFAULT_ICON_COLOR}
                            opacity={logoHover ? ICON_OPACITY_HOVER : ICON_OPACITY_DEFAULT}
                        />
                    </button>
                    {isExpanded && (
                        <button
                            type="button"
                            style={{ ...ICON_BUTTON_STYLE, marginLeft: 'auto', marginRight: `${-CLOSE_ICON_OFFSET_LEFT}px` }}
                            onMouseEnter={() => setCloseHover(true)}
                            onMouseLeave={() => setCloseHover(false)}
                            onClick={onToggle}
                            title="Close sidebar"
                        >
                            <MaskIcon
                                src={sidebarIcon}
                                size={ICON_SIZE}
                                color={closeHover ? HOVER_ACCENT_COLOR : DEFAULT_ICON_COLOR}
                                opacity={closeHover ? ICON_OPACITY_HOVER : ICON_OPACITY_DEFAULT}
                            />
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
                        icon={threeDotIcon}
                        label="More"
                        isExpanded={isExpanded}
                        isHovered={moreHover}
                        onMouseEnter={() => setMoreHover(true)}
                        onMouseLeave={() => setMoreHover(false)}
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
                        style={{
                            ...PROFILE_ROW_STYLE,
                            width: isExpanded ? PROFILE_ROW_STYLE.width : 'fit-content',
                            margin: isExpanded ? undefined : '0',
                            backgroundColor: avatarRowHover ? 'rgba(255, 255, 255, 0.14)' : 'transparent',
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
    onClick?: () => void;
    hardShieldInput?: boolean;
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
}) => (
    <button
        type="button"
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
            onClick?.();
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
};

const MaskIcon: React.FC<MaskIconProps> = ({ src, size, color, opacity = 1 }) => (
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
    color: '#e7e7e7',
    fontSize: `${FONT_SIZE_NAV}px`,
    fontFamily: 'var(--font-ui)',
    whiteSpace: 'nowrap',
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
    color: 'rgba(255, 255, 255, 0.4)',
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
    color: '#e7e7e7',
    fontSize: `${FONT_SIZE_NAV}px`,
    fontFamily: 'var(--font-ui)',
    textAlign: 'left',
    cursor: 'pointer',
    opacity: 1,
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
    transition: 'opacity 140ms ease',
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
    transition: 'filter 140ms ease',
};

const ROW_MENU_ITEM_LABEL_STYLE: React.CSSProperties = {
    fontFamily: 'var(--font-ui)',
    fontSize: `${FONT_SIZE_NAV}px`,
    lineHeight: 1.2,
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
    color: '#e7e7e7',
    fontFamily: 'var(--font-ui)',
    fontSize: `${FONT_SIZE_NAV}px`,
    lineHeight: 1.2,
    padding: '4px 8px',
    outline: 'none',
};

const INTERFACE_EMPTY_STATE_STYLE: React.CSSProperties = {
    ...INTERFACE_ITEM_STYLE,
    color: 'rgba(255, 255, 255, 0.45)',
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
    transition: 'background-color 120ms ease',
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
    color: '#000',
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
    color: '#e7e7e7',
    fontSize: `${FONT_SIZE_NAV}px`,
    lineHeight: 1,
    fontFamily: 'var(--font-ui)',
    opacity: 1,
    marginLeft: `${NAME_OFFSET_LEFT}px`,
};


