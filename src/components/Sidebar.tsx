import React from 'react';
import circleIcon from '../assets/circle_icon.png';
import sidebarIcon from '../assets/sidebar_icon.png';
import homeIcon from '../assets/home_icon.png';
import searchIcon from '../assets/search_icon.png';
import threeDotIcon from '../assets/3_dot_icon.png';

// ═══════════════════════════════════════════════════════════════════════════
// Mock Data
// ═══════════════════════════════════════════════════════════════════════════
const MOCK_INTERFACES = [
    { id: '1', name: 'Interfaces 1' },
    { id: '2', name: 'Interfaces 2' },
    { id: '3', name: 'Interfaces 3' },
    { id: '4', name: 'Interfaces 4' },
    { id: '5', name: 'Interfaces 5' },
    { id: '6', name: 'Interfaces 6' },
];

// ═══════════════════════════════════════════════════════════════════════════
// Design Tokens
// ═══════════════════════════════════════════════════════════════════════════
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
// Home icon vertical offset: negative = up, positive = down (in px)
const HOME_OFFSET_TOP = -1;
// Search icon vertical offset: negative = up, positive = down (in px)
const SEARCH_OFFSET_TOP = -7.5;
// More (3-dot) icon vertical offset: negative = up, positive = down (in px)
const MORE_OFFSET_TOP = -9.5;
// Account section horizontal offset: negative = left, positive = right (in px)
const ACCOUNT_OFFSET_LEFT = -8;
// Your Name text horizontal offset: negative = left, positive = right (in px)
const NAME_OFFSET_LEFT = -13;
// Close icon (expanded state) horizontal offset: negative = left, positive = right (in px)
const CLOSE_ICON_OFFSET_LEFT = -10;
const ICON_OPACITY_DEFAULT = 1.0;
const ICON_OPACITY_HOVER = 1.0;
const COLLAPSED_AVATAR_HOVER_PADDING = 0;
const COLLAPSED_AVATAR_BUTTON_PADDING = 4.5;
const HOVER_ACCENT_COLOR = '#63abff';
const DEFAULT_ICON_COLOR = '#ffffff';

type SidebarProps = {
    isExpanded: boolean;
    onToggle: () => void;
};

export const Sidebar: React.FC<SidebarProps> = ({ isExpanded, onToggle }) => {
    const [logoHover, setLogoHover] = React.useState(false);
    const [homeHover, setHomeHover] = React.useState(false);
    const [searchHover, setSearchHover] = React.useState(false);
    const [moreHover, setMoreHover] = React.useState(false);
    const [closeHover, setCloseHover] = React.useState(false);
    const [hoveredInterfaceId, setHoveredInterfaceId] = React.useState<string | null>(null);
    const [avatarRowHover, setAvatarRowHover] = React.useState(false);

    const sidebarStyle: React.CSSProperties = {
        ...SIDEBAR_BASE_STYLE,
        width: isExpanded ? EXPANDED_WIDTH : COLLAPSED_WIDTH,
        minWidth: isExpanded ? MIN_EXPANDED_WIDTH : COLLAPSED_WIDTH,
    };

    return (
        <aside style={sidebarStyle}>
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
                <div style={{ marginTop: `${HOME_OFFSET_TOP}px` }}>
                    <NavItem
                        icon={homeIcon}
                        label="Home"
                        isExpanded={isExpanded}
                        isHovered={homeHover}
                        onMouseEnter={() => setHomeHover(true)}
                        onMouseLeave={() => setHomeHover(false)}
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

                {/* Your Interfaces Section (expanded only) */}
                {isExpanded && (
                    <div style={INTERFACES_SECTION_STYLE}>
                        <div style={SECTION_HEADER_STYLE}>Your Interfaces</div>
                        <div style={INTERFACES_LIST_STYLE}>
                            {MOCK_INTERFACES.map((item) => (
                                <button
                                    key={item.id}
                                    type="button"
                                    style={{
                                        ...INTERFACE_ITEM_STYLE,
                                        color: hoveredInterfaceId === item.id ? HOVER_ACCENT_COLOR : INTERFACE_ITEM_STYLE.color,
                                    }}
                                    onMouseEnter={() => setHoveredInterfaceId(item.id)}
                                    onMouseLeave={() => setHoveredInterfaceId(null)}
                                >
                                    {item.name}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Bottom Section - User Avatar */}
            <div
                style={{
                    ...BOTTOM_SECTION_STYLE,
                    justifyContent: isExpanded ? 'flex-start' : 'center',
                    padding: isExpanded ? BOTTOM_SECTION_STYLE.padding : '12px 0',
                }}
            >
                <div
                    style={{
                        ...PROFILE_ROW_STYLE,
                        width: isExpanded ? PROFILE_ROW_STYLE.width : 'auto',
                        margin: isExpanded ? undefined : '0 auto',
                        padding: isExpanded ? PROFILE_ROW_STYLE.padding : `${COLLAPSED_AVATAR_HOVER_PADDING}px`,
                        backgroundColor: avatarRowHover ? 'rgba(255, 255, 255, 0.14)' : 'transparent',
                    }}
                    onMouseEnter={() => setAvatarRowHover(true)}
                    onMouseLeave={() => setAvatarRowHover(false)}
                >
                    <button
                        type="button"
                        style={{
                            ...ICON_BUTTON_STYLE,
                            padding: isExpanded ? ICON_BUTTON_STYLE.padding : `${COLLAPSED_AVATAR_BUTTON_PADDING}px`,
                        }}
                    >
                        <div
                            style={{
                                ...AVATAR_STYLE,
                                opacity: 1,
                            }}
                        >
                            BA
                        </div>
                    </button>
                    {isExpanded && <span style={AVATAR_NAME_STYLE}>Your Name</span>}
                </div>
            </div>
        </aside>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
// NavItem Sub-component
// ═══════════════════════════════════════════════════════════════════════════
type NavItemProps = {
    icon: string;
    label: string;
    isExpanded: boolean;
    isHovered: boolean;
    onMouseEnter: () => void;
    onMouseLeave: () => void;
};

const NavItem: React.FC<NavItemProps> = ({
    icon,
    label,
    isExpanded,
    isHovered,
    onMouseEnter,
    onMouseLeave,
}) => (
    <button
        type="button"
        style={NAV_ITEM_STYLE}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
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

// ═══════════════════════════════════════════════════════════════════════════
// Styles
// ═══════════════════════════════════════════════════════════════════════════
const SIDEBAR_BASE_STYLE: React.CSSProperties = {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    background: '#111115',
    borderRight: '1px solid rgba(255, 255, 255, 0.1)',
    display: 'flex',
    flexDirection: 'column',
    zIndex: 50,
    boxSizing: 'border-box',
};

const TOP_SECTION_STYLE: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    padding: `12px ${8 + ICON_OFFSET_LEFT}px 12px ${8 - ICON_OFFSET_LEFT}px`,
    gap: '4px',
    flex: 1,
    overflow: 'hidden',
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
    marginTop: '16px',
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

const BOTTOM_SECTION_STYLE: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    padding: '12px 8px',
    paddingLeft: `${8 + ACCOUNT_OFFSET_LEFT}px`,
    borderTop: '1px solid rgba(255, 255, 255, 0.1)',
};

const PROFILE_ROW_STYLE: React.CSSProperties = {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    borderRadius: '10px',
    padding: '2px',
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

const AVATAR_NAME_STYLE: React.CSSProperties = {
    color: '#e7e7e7',
    fontSize: `${FONT_SIZE_NAV}px`,
    fontFamily: 'var(--font-ui)',
    opacity: 1,
    marginLeft: `${NAME_OFFSET_LEFT}px`,
};
