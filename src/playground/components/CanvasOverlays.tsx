// type check enabled
import React from 'react';
import { PlaygroundMetrics } from '../playgroundTypes';
import {
    DEBUG_CLOSE_STYLE,
    DEBUG_OVERLAY_STYLE,
    DEBUG_TOGGLE_STYLE,
    // DEBUG_SECTION_HEADER_STYLE, // Removed missing import
    SIDEBAR_TOGGLE_STYLE,
    THEME_TOGGLE_STYLE
} from '../graphPlaygroundStyles';
import { IS_DEV } from '../rendering/debugUtils';
import downloadDevModeIcon from '../../assets/download_dev_mode.png';
import threeDotIcon from '../../assets/3_dot_icon.png';
import shareIcon from '../../assets/share_icon.png';
import fullscreenOpenIcon from '../../assets/fullscreen_open_icon.png';
import fullscreenCloseIcon from '../../assets/fullscreen_close_icon.png';
import { useFullscreen } from '../../hooks/useFullscreen';

// Toggle to show/hide debug controls buttons (Debug, Theme, Controls)
const SHOW_DEBUG_CONTROLS = false;
const SHOW_DEV_DOWNLOAD_JSON_BUTTON = false;
const SHOW_TOP_RIGHT_DOTS_ICON = true;
const SHOW_TOP_RIGHT_SHARE_ICON = false;
const SHOW_TOP_RIGHT_FULLSCREEN_ICON = false;
const TOP_RIGHT_ICON_SIZE_PX = 16;
const FULLSCREEN_ICON_SCALE = 0.9;
const TOP_RIGHT_ICON_BASE_TINT = '#d7f5ff';
const TOP_RIGHT_ICON_IDLE_OPACITY = 0.5;
const TOP_RIGHT_ICON_HOVER_OPACITY = 1;
const TOP_RIGHT_ICON_OPACITY_TRANSITION = '200ms ease';
const SHARE_MENU_SCALE = 0.8;
const SHARE_MENU_PADDING_PX = 5;
const SHARE_MENU_VIEWPORT_PADDING_PX = 8;
const SHARE_MENU_ANCHOR_GAP_PX = 8;

import type { ForceConfig } from '../../physics/types';

const stopPropagation = (e: React.MouseEvent) => e.stopPropagation();
type CanvasOverlaysProps = {
    config?: ForceConfig;
    onConfigChange?: (key: keyof ForceConfig, value: number | boolean | string) => void;
    debugOpen: boolean;
    metrics: PlaygroundMetrics;
    onCloseDebug: () => void;
    onShowDebug: () => void;
    onToggleSidebar: () => void;
    onToggleTheme: () => void;
    showThemeToggle: boolean;
    sidebarOpen: boolean;
    skinMode: string;
    viewerOpen: boolean;
    cameraLocked: boolean;
    showDebugGrid: boolean;
    onToggleCameraLock: () => void;
    onToggleDebugGrid: () => void;
    pixelSnapping: boolean;
    debugNoRenderMotion: boolean;
    onTogglePixelSnapping: () => void;
    onToggleNoRenderMotion: () => void;
    showRestMarkers: boolean;
    showConflictMarkers: boolean;
    markerIntensity: number;
    forceShowRestMarkers: boolean;
    onToggleRestMarkers: () => void;
    onToggleConflictMarkers: () => void;
    onToggleForceShowRestMarkers: () => void;
    onMarkerIntensityChange: (value: number) => void;
    onSpawnPreset: (count: number) => void;
    onRunSettleScenario: () => void;
    onRunDragScenario: () => void;
    onRecordHudScore: () => void;
    hudScenarioLabel: string;
    hudDragTargetId: string | null;
    hudScores: Record<number, {
        settleMs: number;
        jitter: number;
        conflictPct: number;
        energy: number;
        degradePct: number;
    }>;
    onDevDownloadJson?: () => void;
};

type MaskIconProps = {
    src: string;
    opacity: number;
    sizePx?: number;
};

const MaskIcon: React.FC<MaskIconProps> = ({ src, opacity, sizePx = TOP_RIGHT_ICON_SIZE_PX }) => (
    <span
        aria-hidden="true"
        style={{
            width: `${sizePx}px`,
            height: `${sizePx}px`,
            display: 'inline-block',
            flexShrink: 0,
            backgroundColor: TOP_RIGHT_ICON_BASE_TINT,
            opacity,
            WebkitMaskImage: `url(${src})`,
            maskImage: `url(${src})`,
            WebkitMaskRepeat: 'no-repeat',
            maskRepeat: 'no-repeat',
            WebkitMaskPosition: 'center',
            maskPosition: 'center',
            WebkitMaskSize: 'contain',
            maskSize: 'contain',
            transition: `opacity ${TOP_RIGHT_ICON_OPACITY_TRANSITION}`,
        }}
    />
);

function computeShareMenuPosition(rect: DOMRect): { right: number; top: number } {
    const right = Math.max(
        SHARE_MENU_VIEWPORT_PADDING_PX,
        window.innerWidth - rect.right
    );
    const estimatedHeight = 4 * 32 + SHARE_MENU_PADDING_PX * 2;
    const canOpenDown =
        rect.bottom + SHARE_MENU_ANCHOR_GAP_PX + estimatedHeight <=
        window.innerHeight - SHARE_MENU_VIEWPORT_PADDING_PX;
    const top = canOpenDown
        ? Math.max(SHARE_MENU_VIEWPORT_PADDING_PX, rect.bottom + SHARE_MENU_ANCHOR_GAP_PX)
        : Math.max(SHARE_MENU_VIEWPORT_PADDING_PX, rect.top - SHARE_MENU_ANCHOR_GAP_PX - estimatedHeight);
    return { right, top };
}

export const CanvasOverlays: React.FC<CanvasOverlaysProps> = ({
    debugOpen,
    metrics,
    onCloseDebug,
    onShowDebug,
    onToggleSidebar,
    onToggleTheme,
    showThemeToggle,
    sidebarOpen,
    skinMode,
    viewerOpen,
    cameraLocked,
    showDebugGrid,
    onToggleCameraLock,
    onToggleDebugGrid,
    pixelSnapping,
    debugNoRenderMotion,
    onTogglePixelSnapping,
    onToggleNoRenderMotion,
    showRestMarkers,
    showConflictMarkers,
    markerIntensity,
    forceShowRestMarkers,
    onToggleRestMarkers,
    onToggleConflictMarkers,
    onToggleForceShowRestMarkers,
    onMarkerIntensityChange,
    onSpawnPreset,
    onRunSettleScenario,
    onRunDragScenario,
    onRecordHudScore,
    hudScenarioLabel,
    hudDragTargetId,
    hudScores,
    onDevDownloadJson,
    config,
    onConfigChange
}) => {
    const { isFullscreen, toggleFullscreen } = useFullscreen();
    const hud = metrics.physicsHud;
    const formatRatio = (value: number, base?: number) => {
        if (!base || base <= 0) return '';
        return ` (x${(value / base).toFixed(2)})`;
    };
    const baseScore = hudScores[5];

    const [showAdvanced, setShowAdvanced] = React.useState(false);
    const [showLegacyControls, setShowLegacyControls] = React.useState(false);
    const [showLegacyDiagnostics, setShowLegacyDiagnostics] = React.useState(false);
    const [hoveredTopRightIcon, setHoveredTopRightIcon] = React.useState<'dots' | 'share' | 'fullscreen' | null>(null);
    const [shareMenuOpen, setShareMenuOpen] = React.useState(false);
    const [shareMenuPosition, setShareMenuPosition] = React.useState<{ right: number; top: number } | null>(null);
    const shareTriggerRef = React.useRef<HTMLButtonElement | null>(null);
    const shareMenuRef = React.useRef<HTMLDivElement | null>(null);

    const shareMenuItems = React.useMemo(
        () => [
            { key: 'link', label: 'Save as Link' },
            { key: 'arn', label: 'Save as ARN' },
        ],
        []
    );

    // NEW: HUD Layout State
    const [isNarrow, setIsNarrow] = React.useState(typeof window !== 'undefined' ? window.innerWidth < 450 : false);
    // Toggle to hide deep forensics for XPBD focus
    const SHOW_DEEP_FORENSICS = false;

    React.useEffect(() => {
        const handleResize = () => setIsNarrow(window.innerWidth < 450);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    React.useEffect(() => {
        if (!shareMenuOpen || !shareTriggerRef.current) return;
        const update = () => {
            if (!shareTriggerRef.current) return;
            setShareMenuPosition(computeShareMenuPosition(shareTriggerRef.current.getBoundingClientRect()));
        };
        update();
        window.addEventListener('resize', update);
        window.addEventListener('scroll', update, true);
        return () => {
            window.removeEventListener('resize', update);
            window.removeEventListener('scroll', update, true);
        };
    }, [shareMenuOpen]);

    React.useEffect(() => {
        if (!shareMenuOpen) return;
        const handleWindowPointerDown = (event: PointerEvent) => {
            const target = event.target as Element | null;
            if (!target) {
                setShareMenuOpen(false);
                return;
            }
            if (target.closest('[data-share-menu="1"]')) return;
            if (target.closest('[data-share-trigger="1"]')) return;
            setShareMenuOpen(false);
        };
        const handleWindowKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setShareMenuOpen(false);
            }
        };
        window.addEventListener('pointerdown', handleWindowPointerDown, true);
        window.addEventListener('keydown', handleWindowKeyDown, true);
        return () => {
            window.removeEventListener('pointerdown', handleWindowPointerDown, true);
            window.removeEventListener('keydown', handleWindowKeyDown, true);
        };
    }, [shareMenuOpen]);

    React.useEffect(() => {
        if (!SHOW_TOP_RIGHT_SHARE_ICON && shareMenuOpen) {
            setShareMenuOpen(false);
        }
    }, [shareMenuOpen]);

    const gridStyle: React.CSSProperties = isNarrow ? {
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
    } : {
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1.1fr) minmax(0, 0.9fr)', // Slightly more space for left col text
        gap: '8px',
        alignItems: 'start'
    };

    return (
        <>
            {SHOW_DEBUG_CONTROLS && !debugOpen && (
                <button
                    type="button"
                    style={DEBUG_TOGGLE_STYLE}
                    onMouseDown={stopPropagation}
                    onPointerDown={stopPropagation}
                    onClick={(e) => {
                        stopPropagation(e);
                        onShowDebug();
                    }}
                    aria-label="Show debug panel"
                    title="Show debug"
                >
                    Debug
                </button>
            )}

            {SHOW_DEBUG_CONTROLS && showThemeToggle && (
                <button
                    type="button"
                    style={THEME_TOGGLE_STYLE}
                    onMouseDown={stopPropagation}
                    onPointerDown={stopPropagation}
                    onClick={(e) => {
                        stopPropagation(e);
                        onToggleTheme();
                    }}
                    aria-label="Toggle theme"
                    title="Toggle between normal and elegant theme"
                >
                    Theme: {skinMode}
                </button>
            )}

            {SHOW_DEBUG_CONTROLS && (
                <button
                    type="button"
                    style={SIDEBAR_TOGGLE_STYLE}
                    onMouseDown={stopPropagation}
                    onPointerDown={stopPropagation}
                    onClick={(e) => {
                        stopPropagation(e);
                        onToggleSidebar();
                    }}
                    aria-label={sidebarOpen ? 'Hide controls' : 'Show controls'}
                    title={sidebarOpen ? 'Hide controls' : 'Show controls'}
                >
                    {sidebarOpen ? 'Hide Controls' : 'Controls'}
                </button>
            )}

            {import.meta.env.DEV && SHOW_DEV_DOWNLOAD_JSON_BUTTON && (
                <button
                    type="button"
                    style={{
                        ...SIDEBAR_TOGGLE_STYLE,
                        top: '56px',
                        width: '32px',
                        height: '32px',
                        padding: '4px',
                        background: 'transparent',
                        border: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                    onPointerDown={stopPropagation}
                    onPointerUp={stopPropagation}
                    onWheelCapture={stopPropagation}
                    onWheel={stopPropagation}
                    onClick={(e) => {
                        stopPropagation(e);
                        onDevDownloadJson?.();
                    }}
                    aria-label="Download graph json (dev)"
                    title="Download graph json (dev)"
                >
                    <img
                        src={downloadDevModeIcon}
                        alt="Download graph json"
                        style={{
                            width: '22px',
                            height: '22px',
                            objectFit: 'contain',
                        }}
                    />
                </button>
            )}
            {(SHOW_TOP_RIGHT_DOTS_ICON || SHOW_TOP_RIGHT_SHARE_ICON || SHOW_TOP_RIGHT_FULLSCREEN_ICON) && (
                <div
                    style={{
                        position: 'absolute',
                        top: '24px',
                        right: '24px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        zIndex: 10,
                        pointerEvents: 'none',
                    }}
                >
                    {SHOW_TOP_RIGHT_DOTS_ICON && (
                        <span
                            style={{ pointerEvents: 'auto', display: 'inline-flex' }}
                            onPointerEnter={() => setHoveredTopRightIcon('dots')}
                            onPointerLeave={() => setHoveredTopRightIcon((current) => (current === 'dots' ? null : current))}
                            onPointerDown={(e) => e.stopPropagation()}
                            onPointerUp={(e) => e.stopPropagation()}
                            onWheelCapture={(e) => e.stopPropagation()}
                            onWheel={(e) => e.stopPropagation()}
                        >
                            <MaskIcon
                                src={threeDotIcon}
                                opacity={hoveredTopRightIcon === 'dots' ? TOP_RIGHT_ICON_HOVER_OPACITY : TOP_RIGHT_ICON_IDLE_OPACITY}
                            />
                        </span>
                    )}
                    {SHOW_TOP_RIGHT_SHARE_ICON && (
                        <button
                            ref={shareTriggerRef}
                            data-share-trigger="1"
                            type="button"
                            style={{
                                pointerEvents: 'auto',
                                display: 'inline-flex',
                                padding: 0,
                                margin: 0,
                                border: 'none',
                                background: 'transparent',
                                cursor: 'pointer'
                            }}
                            onPointerEnter={() => setHoveredTopRightIcon('share')}
                            onPointerLeave={() => setHoveredTopRightIcon((current) => (current === 'share' ? null : current))}
                            onPointerDown={(e) => e.stopPropagation()}
                            onPointerUp={(e) => e.stopPropagation()}
                            onWheelCapture={(e) => e.stopPropagation()}
                            onWheel={(e) => e.stopPropagation()}
                            onClick={(e) => {
                                e.stopPropagation();
                                const trigger = e.currentTarget;
                                setShareMenuOpen((prev) => {
                                    const next = !prev;
                                    if (next) {
                                        setShareMenuPosition(computeShareMenuPosition(trigger.getBoundingClientRect()));
                                    }
                                    return next;
                                });
                            }}
                            aria-label="Open share menu"
                        >
                            <MaskIcon
                                src={shareIcon}
                                opacity={hoveredTopRightIcon === 'share' ? TOP_RIGHT_ICON_HOVER_OPACITY : TOP_RIGHT_ICON_IDLE_OPACITY}
                            />
                        </button>
                    )}
                    {SHOW_TOP_RIGHT_FULLSCREEN_ICON && (
                        <button
                            type="button"
                            style={{
                                pointerEvents: 'auto',
                                display: 'inline-flex',
                                padding: 0,
                                margin: 0,
                                border: 'none',
                                background: 'transparent',
                                cursor: 'pointer'
                            }}
                            onPointerEnter={() => setHoveredTopRightIcon('fullscreen')}
                            onPointerLeave={() => setHoveredTopRightIcon((current) => (current === 'fullscreen' ? null : current))}
                            onPointerDown={(e) => e.stopPropagation()}
                            onPointerUp={(e) => e.stopPropagation()}
                            onWheelCapture={(e) => e.stopPropagation()}
                            onWheel={(e) => e.stopPropagation()}
                            onClick={(e) => {
                                e.stopPropagation();
                                toggleFullscreen().catch((error: unknown) => {
                                    console.warn('[fullscreen] Toggle failed:', error);
                                });
                            }}
                            aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                        >
                            <MaskIcon
                                src={isFullscreen ? fullscreenCloseIcon : fullscreenOpenIcon}
                                opacity={hoveredTopRightIcon === 'fullscreen' ? TOP_RIGHT_ICON_HOVER_OPACITY : TOP_RIGHT_ICON_IDLE_OPACITY}
                                sizePx={TOP_RIGHT_ICON_SIZE_PX * FULLSCREEN_ICON_SCALE}
                            />
                        </button>
                    )}
                </div>
            )}
            {shareMenuOpen && shareMenuPosition ? (
                <div
                    ref={shareMenuRef}
                    data-share-menu="1"
                    style={{
                        position: 'fixed',
                        right: `${shareMenuPosition.right}px`,
                        top: `${shareMenuPosition.top}px`,
                        width: 'max-content',
                        maxWidth: `calc(100vw - ${SHARE_MENU_VIEWPORT_PADDING_PX * 2}px)`,
                        padding: `${SHARE_MENU_PADDING_PX}px`,
                        borderRadius: `${10 * SHARE_MENU_SCALE}px`,
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        background: '#0D0D18',
                        boxShadow: '0 14px 28px rgba(0, 0, 0, 0.45)',
                        zIndex: 1200,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '2px',
                        pointerEvents: 'auto',
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                    onPointerUp={(e) => e.stopPropagation()}
                    onWheelCapture={(e) => e.stopPropagation()}
                    onWheel={(e) => e.stopPropagation()}
                >
                    {shareMenuItems.map((item) => (
                        <button
                            key={item.key}
                            type="button"
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                padding: `${8 * SHARE_MENU_SCALE}px 10px`,
                                border: 'none',
                                borderRadius: `${8 * SHARE_MENU_SCALE}px`,
                                background: 'transparent',
                                textAlign: 'left',
                                cursor: 'pointer',
                                color: '#D7F5FF',
                                fontFamily: 'var(--font-ui)',
                                fontSize: `${13 * SHARE_MENU_SCALE}px`,
                                lineHeight: 1.2,
                            }}
                            onPointerDown={(e) => e.stopPropagation()}
                            onPointerUp={(e) => e.stopPropagation()}
                            onWheelCapture={(e) => e.stopPropagation()}
                            onWheel={(e) => e.stopPropagation()}
                            onClick={(e) => {
                                e.stopPropagation();
                                setShareMenuOpen(false);
                            }}
                        >
                            <span>{item.label}</span>
                        </button>
                    ))}
                </div>
            ) : null}

            {debugOpen && (
                <div
                    style={{
                        ...DEBUG_OVERLAY_STYLE,
                        left: viewerOpen ? 'calc(50vw + 16px)' : DEBUG_OVERLAY_STYLE.left,
                        width: isNarrow ? 'calc(100vw - 32px)' : '420px',
                        maxWidth: '520px',
                        maxHeight: 'calc(100vh - 40px)',
                        overflowY: 'auto',
                        pointerEvents: 'none' // FIX: Allow click-through on background
                    }}
                    onMouseDown={stopPropagation}
                    onWheel={stopPropagation}
                    onPointerDown={stopPropagation}
                >
                    <div style={{ pointerEvents: 'auto' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                            <strong>Time: T+{metrics.lifecycleMs}ms</strong>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <button
                                    type="button"
                                    style={{
                                        ...DEBUG_CLOSE_STYLE,
                                        width: '44px',
                                        fontSize: '11px',
                                        padding: 0
                                    }}
                                    onClick={onCloseDebug}
                                    aria-label="Hide debug panel"
                                    title="Hide"
                                >
                                    Hide
                                </button>
                                <button
                                    type="button"
                                    style={DEBUG_CLOSE_STYLE}
                                    onClick={onCloseDebug}
                                    aria-label="Close debug panel"
                                    title="Close"
                                >
                                    x
                                </button>
                            </div>
                        </div>
                        <br />
                        {/* 2-COLUMN GRID LAYOUT */}
                        <div style={gridStyle}>
                            {/* LEFT COLUMN: Controls, State, Physics Stats */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <div style={{ fontSize: '10px', color: '#666', marginBottom: '4px' }}>
                                    HUD v1.2 (2-col layout)
                                </div>

                                {/* STANDARD CONTROLS */}
                                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', cursor: 'pointer', color: '#aaa' }}>
                                    <input
                                        type="checkbox"
                                        checked={showLegacyControls}
                                        onChange={(e) => setShowLegacyControls(e.target.checked)}
                                    />
                                    Show Standard Controls
                                </label>
                                {showLegacyControls && (
                                    <div style={{ paddingLeft: '8px', borderLeft: '1px solid #333', marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
                                            <input
                                                type="checkbox"
                                                checked={cameraLocked}
                                                onChange={onToggleCameraLock}
                                                style={{ cursor: 'pointer' }}
                                            />
                                            Lock Camera
                                        </label>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
                                            <input
                                                type="checkbox"
                                                checked={showDebugGrid}
                                                onChange={onToggleDebugGrid}
                                                style={{ cursor: 'pointer' }}
                                            />
                                            Show Grid/Axes
                                        </label>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
                                            <input
                                                type="checkbox"
                                                checked={pixelSnapping}
                                                onChange={onTogglePixelSnapping}
                                                style={{ cursor: 'pointer' }}
                                            />
                                            Pixel Snapping
                                        </label>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
                                            <input
                                                type="checkbox"
                                                checked={debugNoRenderMotion}
                                                onChange={onToggleNoRenderMotion}
                                                style={{ cursor: 'pointer' }}
                                            />
                                            Kill Render Motion
                                        </label>
                                    </div>
                                )}

                                {/* FEEL MARKERS */}
                                {IS_DEV && (
                                    <>
                                        <strong style={{ fontWeight: 700, marginTop: '6px' }}>Feel Markers</strong>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
                                            <input
                                                type="checkbox"
                                                checked={showRestMarkers}
                                                onChange={onToggleRestMarkers}
                                                style={{ cursor: 'pointer' }}
                                            />
                                            Show Rest Markers
                                        </label>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
                                            <input
                                                type="checkbox"
                                                checked={showConflictMarkers}
                                                onChange={onToggleConflictMarkers}
                                                style={{ cursor: 'pointer' }}
                                            />
                                            Show Conflict Markers
                                        </label>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                                            Intensity
                                            <input
                                                type="range"
                                                min={0.6}
                                                max={2}
                                                step={0.1}
                                                value={markerIntensity}
                                                onChange={(event) => onMarkerIntensityChange(Number(event.target.value))}
                                                style={{ width: '60px' }}
                                            />
                                            <span style={{ minWidth: '24px' }}>{markerIntensity.toFixed(1)}</span>
                                        </label>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#ffaa3c', cursor: 'pointer', marginTop: '2px' }}>
                                            <input
                                                type="checkbox"
                                                checked={forceShowRestMarkers}
                                                onChange={onToggleForceShowRestMarkers}
                                                style={{ cursor: 'pointer' }}
                                            />
                                            [Debug] Force Show Markers
                                        </label>
                                    </>
                                )}

                                {/* ADVANCED TOGGLES */}
                                {IS_DEV && config && onConfigChange && (
                                    <div style={{ marginTop: '6px' }}>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', cursor: 'pointer', color: '#aaa' }}>
                                            <input
                                                type="checkbox"
                                                checked={showAdvanced}
                                                onChange={(e) => setShowAdvanced(e.target.checked)}
                                            />
                                            Show Advanced Physics
                                        </label>

                                        {showAdvanced && (
                                            <div style={{ marginTop: '4px', padding: '4px', background: 'rgba(255,0,0,0.1)', border: '1px solid rgba(255,0,0,0.3)' }}>
                                                <strong style={{ fontWeight: 700, fontSize: '11px', color: '#ff8888' }}>ISOLATION (KILL SWITCHES)</strong>
                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px' }}>
                                                    <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', cursor: 'pointer' }}>
                                                        <input type="checkbox" checked={!!config.debugDisableDiffusion} onChange={(e) => onConfigChange('debugDisableDiffusion', e.target.checked)} />
                                                        No Diffuse
                                                    </label>
                                                    <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', cursor: 'pointer' }}>
                                                        <input type="checkbox" checked={!!config.debugDisableMicroSlip} onChange={(e) => onConfigChange('debugDisableMicroSlip', e.target.checked)} />
                                                        No M-Slip
                                                    </label>
                                                    <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', cursor: 'pointer' }}>
                                                        <input type="checkbox" checked={!!config.debugDisableRepulsion} onChange={(e) => onConfigChange('debugDisableRepulsion', e.target.checked)} />
                                                        No Repuls
                                                    </label>
                                                    <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', cursor: 'pointer' }}>
                                                        <input type="checkbox" checked={!!config.debugDisableConstraints} onChange={(e) => onConfigChange('debugDisableConstraints', e.target.checked)} />
                                                        No Constr
                                                    </label>
                                                    <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', cursor: 'pointer' }}>
                                                        <input type="checkbox" checked={!!config.debugDisableReconcile} onChange={(e) => onConfigChange('debugDisableReconcile', e.target.checked)} />
                                                        No Reconc
                                                    </label>
                                                    <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', cursor: 'pointer' }}>
                                                        <input type="checkbox" checked={!!config.debugDisableAllVMods} onChange={(e) => onConfigChange('debugDisableAllVMods', e.target.checked)} />
                                                        No V-Mods
                                                    </label>
                                                </div>
                                                <strong style={{ fontWeight: 700, fontSize: '11px', color: '#88ff88', marginTop: '6px', display: 'block' }}>XPBD FORCING</strong>
                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px' }}>
                                                    <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', cursor: 'pointer' }}>
                                                        <input type="checkbox" checked={!!config.debugForceStiffSprings} onChange={(e) => onConfigChange('debugForceStiffSprings', e.target.checked)} />
                                                        Stiff Links
                                                    </label>
                                                    <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', cursor: 'pointer' }}>
                                                        <input type="checkbox" checked={!!config.debugForceRepulsion} onChange={(e) => onConfigChange('debugForceRepulsion', e.target.checked)} />
                                                        Force Repel
                                                    </label>
                                                    <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', cursor: 'pointer' }}>
                                                        <input type="checkbox" checked={!!config.debugXPBDCanary} onChange={(e) => onConfigChange('debugXPBDCanary', e.target.checked)} />
                                                        Calibrate Canary
                                                    </label>
                                                    <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', cursor: 'pointer' }}>
                                                        <input
                                                            type="checkbox"
                                                            checked={config.xpbdEdgeSelection === 'incident'}
                                                            onChange={(e) => onConfigChange('xpbdEdgeSelection', e.target.checked ? 'incident' : 'full')}
                                                        />
                                                        Incident Only
                                                    </label>
                                                    <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', cursor: 'pointer' }}>
                                                        <input type="checkbox" checked={!!config.xpbdRepulsionEnabled} onChange={(e) => onConfigChange('xpbdRepulsionEnabled', e.target.checked)} />
                                                        XPBD Repulsion
                                                    </label>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* PHYSICS HUD STATS */}
                                <div style={{ marginTop: '8px', lineHeight: '1.2' }}>
                                    <strong style={{ fontWeight: 700 }}>Physics Stats</strong><br />
                                    N: {metrics.nodes} | L: {metrics.links}<br />
                                    FPS: {metrics.fps} <br />
                                    <span style={{ color: hud?.mode === 'XPBD' ? '#0f0' : '#fa0', fontWeight: 'bold' }}>
                                        Mode: {hud?.mode || 'UNKNOWN'}
                                    </span><br />
                                    Degrade: {hud ? hud.degradeLevel : 0} ({hud ? hud.degradePct5s.toFixed(1) : '0.0'}%)<br />
                                    Settle: {hud ? hud.settleState : 'moving'} ({hud ? Math.round(hud.lastSettleMs) : 0}ms)<br />
                                    Jitter(1s): {hud ? hud.jitterAvg.toFixed(4) : '0.0'}<br />
                                    PBD Corr: {hud ? hud.pbdCorrectionSum.toFixed(3) : '0.0'}<br />
                                    Conflict(5s): {hud ? hud.conflictPct5s.toFixed(1) : '0.0'}%<br />
                                    Engy(v^2): {hud ? hud.energyProxy.toFixed(4) : '0.0'}<br />
                                    {hud && SHOW_DEEP_FORENSICS && (
                                        <div style={{ marginTop: '4px', paddingTop: '4px', borderTop: '1px solid #444', color: '#faa' }}>
                                            <strong>Law Pop Diagnostics</strong><br />
                                            Hub Flips: {hud.hubFlipCount || 0} (N={hud.hubNodeCount || 0})<br />
                                            Degrade Flips: {hud.degradeFlipCount || 0}<br />
                                            Pop Score: {(hud.lawPopScore || 0).toFixed(4)}<br />
                                        </div>
                                    )}
                                    {hud && (
                                        <div style={{ marginTop: '4px', paddingTop: '4px', borderTop: '1px solid #444', color: hud.mode === 'XPBD' ? '#adff2f' : '#888' }}>
                                            <strong>XPBD Proof-of-Life</strong><br />
                                            Springs: {hud.xpbdSpringCounts?.count || 0} / {hud.xpbdSpringCounts?.iter || 0}it<br />
                                            - Corr: {hud.xpbdSpringCorr?.avg.toFixed(3)} (Max: {hud.xpbdSpringCorr?.max.toFixed(2)})<br />
                                            - Err: {hud.xpbdSpringError?.avg.toFixed(3)} (Max: {hud.xpbdSpringError?.max.toFixed(2)})<br />
                                            Repulsion: {hud.xpbdRepelCounts?.checked || 0}chk / {hud.xpbdRepelCounts?.solved || 0}solv<br />
                                            - Overlap: {hud.xpbdRepelCounts?.overlap || 0}<br />
                                            - Corr: {hud.xpbdRepelCorr?.avg.toFixed(3)} (Max: {hud.xpbdRepelCorr?.max.toFixed(2)})<br />
                                            - Sing: {hud.xpbdRepelSingularities || 0}<br />
                                            Edge Constraints: {hud.xpbdEdgeConstraintCount || 0}
                                        </div>
                                    )}
                                    {hud && (
                                        <div style={{ marginTop: '4px', paddingTop: '4px', borderTop: '1px solid #444', color: hud.xpbdSpringEnabled ? '#adff2f' : '#888' }}>
                                            <strong>XPBD Springs</strong><br />
                                            enabled: {hud.xpbdSpringEnabled ? 'true' : 'false'}<br />
                                            constraints: {hud.xpbdSpringConstraints || 0}<br />
                                            solved: {hud.xpbdSpringSolved || 0}<br />
                                            corrMax: {(hud.xpbdSpringCorrMaxPx || 0).toFixed(3)} px<br />
                                            errAvg: {(hud.xpbdSpringErrAvgPx || 0).toFixed(3)} px<br />
                                            first: {(hud.xpbdFirstConstraintDistPx || 0).toFixed(1)} / {(hud.xpbdFirstConstraintRestPx || 0).toFixed(1)} (C={(hud.xpbdFirstConstraintErrPx || 0).toFixed(1)})<br />
                                            pair: {hud.xpbdFirstConstraintAId || '-'} ({(hud.xpbdFirstConstraintAX || 0).toFixed(1)},{(hud.xpbdFirstConstraintAY || 0).toFixed(1)}) {'<->'} {hud.xpbdFirstConstraintBId || '-'} ({(hud.xpbdFirstConstraintBX || 0).toFixed(1)},{(hud.xpbdFirstConstraintBY || 0).toFixed(1)})<br />
                                            prev: {(hud.xpbdFirstConstraintPrevDistPx || 0).toFixed(1)} ({(hud.xpbdFirstConstraintPrevAX || 0).toFixed(1)},{(hud.xpbdFirstConstraintPrevAY || 0).toFixed(1)}) {'<->'} ({(hud.xpbdFirstConstraintPrevBX || 0).toFixed(1)},{(hud.xpbdFirstConstraintPrevBY || 0).toFixed(1)})<br />
                                            jump: {(hud.xpbdFirstJumpPx || 0).toFixed(1)} px ({hud.xpbdFirstJumpPhase || 'none'} / {hud.xpbdFirstJumpNodeId || '-'})<br />
                                            pre: {(hud.xpbdFirstPreIntegrateJumpPx || 0).toFixed(1)} px (pre / {hud.xpbdFirstPreIntegrateNodeId || '-'})<br />
                                            move: {(hud.xpbdFirstMovePx || 0).toFixed(1)} px ({hud.xpbdFirstMovePhase || 'none'} / {hud.xpbdFirstMoveNodeId || '-'})<br />
                                            cap: {hud.xpbdFirstCapHit ? 'Y' : 'N'} | alpha: {(hud.xpbdFirstAlpha || 0).toExponential(2)} | wSum: {(hud.xpbdFirstWSum || 0).toFixed(2)}<br />
                                            rest: {(hud.xpbdSpringRestMinPx || 0).toFixed(0)}-{(hud.xpbdSpringRestMaxPx || 0).toFixed(0)} (mu={(hud.xpbdSpringRestAvgPx || 0).toFixed(0)})<br />
                                            iter: {hud.xpbdIterationsUsed || 1} (cfg: {hud.xpbdIterationsIdle || 1}/{hud.xpbdIterationsDrag || 1}) | maxC: {(hud.xpbdMaxAbsC || 0).toFixed(2)}px<br />
                                            solve: {(hud.xpbdSpringSolveMs || 0).toFixed(2)} ms {hud.xpbdEarlyBreaks ? `(Break: ${hud.xpbdEarlyBreaks})` : ''}<br />
                                            <span style={{ fontSize: '0.9em', color: '#888' }}>
                                                drop: {hud.xpbdSpringSkipped}/{hud.xpbdSpringSingularity} | sync: {hud.xpbdGhostSyncs}<br />
                                                <span title="Peak inferred velocity from solver corrections (Projection / dt)">ghost:</span> {(hud.xpbdGhostVelMax || 0).toFixed(1)}px/s (evt: {hud.xpbdGhostVelEvents})<br />
                                                inv: {hud.xpbdInvInvalid} | inf: {hud.xpbdInvNonFinite} | 0len: {hud.xpbdInvZero}<br />
                                                <span title="Compliance value in use (lower = stiffer)">C:</span> {(hud.xpbdComplianceUsed || 0).toFixed(6)} | <span title="Average alpha = compliance/dt^2 (higher = stronger correction)">alpha:</span> {(hud.xpbdAlphaAvg || 0).toFixed(2)}<br />
                                                <span style={{ color: hud.xpbdDragActive ? '#00eeee' : '#666' }}>
                                                    drag: {hud.xpbdDragActive ? 'ON' : 'off'} (k={hud.xpbdDragKinematic ? '1' : '0'}, sync={hud.xpbdDragSyncs})
                                                </span>
                                            </span>
                                        </div>
                                    )}
                                    {hud && (
                                        <div style={{ marginTop: '4px', paddingTop: '4px', borderTop: '1px solid #444', color: '#0ff' }}>
                                            <strong>XPBD Fix 7.5: 3-Lane Clean</strong><br />
                                            <span style={{ color: '#fff' }}>Lane A: Sign/Grad</span><br />
                                            {hud.xpbdFirstEdgeDebug ? (
                                                <span style={{ fontSize: '0.9em', color: '#ccc' }}>
                                                    C: {hud.xpbdFirstEdgeDebug.C.toFixed(2)} | dL: {hud.xpbdFirstEdgeDebug.deltaLambda.toFixed(4)}<br />
                                                    DotA: {hud.xpbdFirstEdgeDebug.corrDotA.toFixed(2)} (Need &lt;0)<br />
                                                    DotB: {hud.xpbdFirstEdgeDebug.corrDotB.toFixed(2)} (Need &gt;0)<br />
                                                </span>
                                            ) : (
                                                <span style={{ fontSize: '0.9em', color: '#666' }}>No active edges</span>
                                            )}
                                            <span style={{ color: '#fff' }}>Lane B: Pinning</span><br />
                                            <span style={{ fontSize: '0.9em', color: '#ccc' }}>
                                                Drag: {hud.dragActive ? 'ON' : 'off'} (ID: {hud.draggedNodeId || '-'})<br />
                                                InvM=0: {hud.xpbdSpringCounts ? 'YES' : 'NO'}<br />
                                                Leash: {hud.dragLeashEnabled ? 'ON' : 'OFF'} (Limit: {hud.dragLeashRadius}px)<br />
                                            </span>
                                            <span style={{ color: '#fff' }}>Lane C: Ghost Vel</span><br />
                                            <span style={{ fontSize: '0.9em', color: '#ccc' }}>
                                                Syncs: {hud.xpbdGhostSyncs || 0}<br />
                                                MaxVel: {(hud.xpbdGhostVelMax || 0).toFixed(1)} (Evt: {hud.xpbdGhostVelEvents})<br />
                                                RelGhost: {hud.releaseGhostEvents || 0}<br />
                                            </span>
                                        </div>
                                    )}
                                    {hud && (
                                        <div style={{ marginTop: '4px', paddingTop: '4px', borderTop: '1px solid #444', color: '#ff8' }}>
                                            <strong>XPBD Edge Coverage</strong><br />
                                            Ratio: {hud.edgesSelectedForSolve || 0} / {hud.totalEdgesGraph || 0}<br />
                                            Proc: {hud.edgesProcessed || 0} (Leak: {hud.edgesSelectedButUnprocessed || 0})<br />
                                            Reason: {hud.edgesSelectedReason || '-'}<br />
                                        </div>
                                    )}
                                    {hud && (
                                        <div style={{ marginTop: '4px', paddingTop: '4px', borderTop: '1px solid #444', color: '#dcf' }}>
                                            <strong>Propagation Proof</strong><br />
                                            Edges: {hud.propEdgesSolved || '-'}/{hud.propTotalEdges || '-'} | Nodes: {hud.propNodesUpdated || '-'}/{hud.propTotalNodes || '-'}
                                            {((hud.propEdgesSolved || 0) >= (hud.propTotalEdges || 1) * 0.98 && (hud.propNodesUpdated || 0) >= (hud.propTotalNodes || 1) * 0.98) ? <span style={{ color: '#0f0', backgroundColor: '#030', padding: '0 2px', marginLeft: '4px', fontSize: '0.8em' }}>COVERAGE OK</span> : ''}<br />
                                            MaxC: {(hud.propMaxAbsC || 0).toFixed(2)}px
                                            {((hud.propMaxAbsC || 0) < (hud.propMaxAbsCFirst || 0) * 0.95 && (hud.xpbdIterationsUsed || 1) > 1) ? <span style={{ color: '#0ff', backgroundColor: '#044', padding: '0 2px', marginLeft: '4px', fontSize: '0.8em' }}>CONVERGING</span> : ''}<br />
                                            Moved: {hud.propMovedNodes || '-'} (H1:{hud.propMovedHop1 || '-'} H2:{hud.propMovedHop2 || '-'} H3+:{hud.propMovedHop3Plus || '-'})<br />
                                        </div>
                                    )}
                                    {hud && (
                                        <div style={{ marginTop: '4px', paddingTop: '4px', borderTop: '1px solid #444', color: '#faa' }}>
                                            <strong>Startup Audit (2s)</strong><br />
                                            NaN: {hud.startupNanCount || 0} | Inf: {hud.startupInfCount || 0}<br />
                                            MaxV: {hud.startupMaxSpeed ? hud.startupMaxSpeed.toFixed(0) : 0}<br />
                                            DtClip: {hud.startupDtClamps || 0}
                                        </div>
                                    )}
                                    {hud && (
                                        <div style={{ marginTop: '4px', paddingTop: '4px', borderTop: '1px solid #444', color: '#aaf' }}>
                                            <strong>DT Consistency</strong><br />
                                            Skew(Max): {hud.dtSkewMaxMs ? hud.dtSkewMaxMs.toFixed(3) : '0.000'}ms<br />
                                            Coverage: {hud.perDotUpdateCoveragePct ? hud.perDotUpdateCoveragePct.toFixed(0) : 100}% ({hud.coverageMode || 'full'})<br />
                                            MaxAge: {hud.ageMaxFrames || 1} frames
                                        </div>
                                    )}
                                    {hud && (
                                        <div style={{ marginTop: '4px', paddingTop: '4px', borderTop: '1px solid #444', color: '#afa' }}>
                                            <strong>Ghost Velocity Audit</strong><br />
                                            MaxPrevGap: {hud.maxPrevGap ? hud.maxPrevGap.toFixed(2) : 0}px<br />
                                            V-Mismatch: {hud.ghostVelSuspectCount || 0}
                                        </div>
                                    )}
                                    {hud && (
                                        <div style={{ marginTop: '4px', paddingTop: '4px', borderTop: '1px solid #444', color: (hud.degenerateTriangleCount || 0) > 0 ? '#fa8' : '#888' }}>
                                            <strong>Solver Health</strong><br />
                                            Degree-1 Tris: {hud.degenerateTriangleCount || 0}<br />
                                            Budget Hits: {hud.correctionBudgetHits || 0}
                                        </div>
                                    )}
                                    {hud && (
                                        <div style={{ marginTop: '4px', paddingTop: '4px', borderTop: '1px solid #444', color: '#ffcc00' }}>
                                            <strong>Repulsion Proof (Run 1)</strong><br />
                                            <span style={{ color: hud.repulsionProofEnabled ? '#0f0' : '#666' }}>
                                                Enabled: {hud.repulsionProofEnabled ? 'YES' : 'NO'} | Entered: {hud.repulsionProofEnteredFrame}
                                            </span><br />
                                            Called: {hud.repulsionProofCalledThisFrame ? 'YES' : 'NO'}
                                            <span style={{ color: '#888', fontSize: '9px' }}> (Last: {hud.repulsionCalledLastFrame ? 'YES' : 'NO'})</span><br />
                                            Pairs: {hud.repulsionProofPairsChecked} chk / {hud.repulsionProofPairsApplied} app
                                            <span style={{ color: '#888', fontSize: '9px' }}> (Last: {hud.repulsionPairsCheckedLastFrame}/{hud.repulsionPairsAppliedLastFrame})</span><br />
                                            MaxForce: {hud.repulsionProofMaxForce}
                                            <span style={{ color: '#888', fontSize: '9px' }}> (Last: {hud.repulsionMaxForceMagLastFrame})</span><br />
                                            Active: {hud.repulsionAwakeCount} / Sleep: {hud.repulsionSleepingCount}<br />
                                            Stride: {hud.repulsionPairStride}
                                        </div>
                                    )}
                                    {hud && (
                                        <div style={{ marginTop: '4px', paddingTop: '4px', borderTop: '1px solid #444', color: (hud.corrSignFlipRate || 0) > 10 ? '#f88' : '#8f8' }}>
                                            <strong>Oscillation</strong><br />
                                            Flip Rate: {(hud.corrSignFlipRate || 0).toFixed(1)}%<br />
                                            Rest Flaps: {(hud.restFlapRate || 0).toFixed(1)}/s
                                        </div>
                                    )}
                                    {hud && (
                                        <div style={{ marginTop: '4px', paddingTop: '4px', borderTop: '1px solid #444', color: (hud.nearOverlapCount || 0) > 0 ? '#f88' : '#888' }}>
                                            <strong>Singularity</strong><br />
                                            Min Dist: {(hud.minPairDist || 0).toFixed(1)}px<br />
                                            Overlaps: {hud.nearOverlapCount || 0}<br />
                                            Max Repel: {(hud.repulsionMaxMag || 0).toFixed(1)}
                                        </div>
                                    )}
                                    {hud && (
                                        <div style={{ marginTop: '4px', paddingTop: '4px', borderTop: '1px solid #444', color: '#ff8' }}>
                                            <strong>Forensic: Repulsion</strong><br />
                                            Unit Mode: World (Invariant)<br />
                                            Clamp: {config ? config.repulsionMaxForce : '?'} world<br />
                                            Zoom: {window.devicePixelRatio.toFixed(2)}x (DPR)<br />
                                            Reorder Rates: {hud.neighborReorderRate || 0}<br />
                                        </div>
                                    )}
                                    {hud && (
                                        <div style={{ marginTop: '4px', paddingTop: '4px', borderTop: '1px solid #444', color: '#aaf' }}>
                                            <strong>Forensic: Micro-Slip</strong><br />
                                            Fires/Sec: {hud.microSlipFiresPerSec?.toFixed(1) || 0}<br />
                                            Stuck Score (Avg): {hud.stuckScoreAvg?.toFixed(3) || 0}<br />
                                            Count: {hud.microSlipCount || 0}<br />
                                            Injector: {hud.lastInjector || '-'}<br />
                                        </div>
                                    )}
                                    {hud && (
                                        <div style={{ marginTop: '4px', paddingTop: '4px', borderTop: '1px solid #444', color: '#afa' }}>
                                            <strong>Forensic: Escape</strong><br />
                                            Fires/Sec: {hud.escapeFiresPerSec?.toFixed(1) || 0}<br />
                                            Loop Suspects: {hud.escapeLoopSuspectCount || 0}<br />
                                        </div>
                                    )}
                                    {hud && (
                                        <div style={{ marginTop: '4px', paddingTop: '4px', borderTop: '1px solid #444', color: '#fea' }}>
                                            <strong>Forensic: Rest</strong><br />
                                            State: <strong>{hud.settleState}</strong> ({(hud.lastSettleMs || 0).toFixed(0)}ms)<br />
                                            Flips/10s: {hud.stateFlipCount || 0}<br />
                                            Outliers: {hud.outlierCount || 0}<br />
                                            Calm: {(hud.calmPercent || 0).toFixed(1)}%<br />
                                            Blockers: {(hud.settleBlockers || []).join(', ') || 'None'}<br />
                                        </div>
                                    )}


                                    {hudScenarioLabel && (
                                        <>
                                            <br />
                                            <strong>Scenario:</strong> {hudScenarioLabel}
                                            {hudDragTargetId && (
                                                <div>Drag Target: {hudDragTargetId}</div>
                                            )}
                                        </>
                                    )}
                                    {/* ACCEPTANCE TESTS */}
                                    {SHOW_DEEP_FORENSICS && (
                                        <div style={{ padding: '4px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)' }}>
                                            <strong style={{ fontWeight: 700, color: '#aaf' }}>Acceptance Tests</strong>
                                            <div style={{ display: 'grid', gap: '2px', fontSize: '10px', marginTop: '4px' }}>
                                                {[
                                                    { id: 't1', label: 'T1 [A/B] Drag (Gap < 50px, Corr > 2px)' },
                                                    { id: 't2', label: 'T2 [A] Recoil (1-3 flips, < 3s)' },
                                                    { id: 't3', label: 'T3 [B] Collide (Overlaps=0 in 1-1.5s)' },
                                                    { id: 't4', label: 'T4 [B] Locality (No Teleport)' },
                                                    { id: 't5', label: 'T5 [B] Rest (Jitter < 0.005, Sleep)' },
                                                    { id: 't6', label: 'T6 [B] DT Quarantine (Clip++, NaN=0)' },
                                                    { id: 't7', label: 'T7 [B] Scale (Law Invariant N=5/60/250)' },
                                                ].map(test => (
                                                    <label key={test.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', color: '#ccc' }}>
                                                        <input type="checkbox" style={{ cursor: 'pointer' }} />
                                                        {test.label}
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    <br />
                                    <strong style={{ fontWeight: 700 }}>Harness</strong><br />
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', margin: '6px 0' }}>
                                        {[5, 20, 60, 250, 500].map((count) => (
                                            <button
                                                key={count}
                                                type="button"
                                                style={{ ...DEBUG_CLOSE_STYLE, width: '48px' }}
                                                onClick={() => onSpawnPreset(count)}
                                            >
                                                N={count}
                                            </button>
                                        ))}
                                        <button
                                            type="button"
                                            style={{ ...DEBUG_CLOSE_STYLE, width: '48px', color: '#8f8' }}
                                            onClick={() => onSpawnPreset(metrics.nodes)}
                                            title="Restart Same Seed"
                                        >
                                            Same
                                        </button>
                                        <button
                                            type="button"
                                            style={{ ...DEBUG_CLOSE_STYLE, width: '48px', color: '#f88' }}
                                            onClick={() => onRunSettleScenario()}
                                            title="Wait, this is Settle Test. New Seed requires logic."
                                        >
                                            New
                                        </button>
                                    </div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '6px' }}>
                                        <button
                                            type="button"
                                            style={{ ...DEBUG_CLOSE_STYLE, width: '86px' }}
                                            onClick={onRunSettleScenario}
                                        >
                                            Settle Test
                                        </button>
                                        <button
                                            type="button"
                                            style={{ ...DEBUG_CLOSE_STYLE, width: '86px' }}
                                            onClick={onRunDragScenario}
                                        >
                                            Drag Test
                                        </button>
                                        <button
                                            type="button"
                                            style={{ ...DEBUG_CLOSE_STYLE, width: '86px' }}
                                            onClick={onRecordHudScore}
                                        >
                                            Record
                                        </button>
                                    </div>
                                    <strong style={{ fontWeight: 700 }}>Scoreboard</strong><br />
                                    <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse' }}>
                                        <thead>
                                            <tr>
                                                <th style={{ textAlign: 'left' }}>N</th>
                                                <th style={{ textAlign: 'left' }}>settleMs</th>
                                                <th style={{ textAlign: 'left' }}>jitter</th>
                                                <th style={{ textAlign: 'left' }}>conflict%</th>
                                                <th style={{ textAlign: 'left' }}>energy</th>
                                                <th style={{ textAlign: 'left' }}>degrade%</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {Object.keys(hudScores).length === 0 && (
                                                <tr>
                                                    <td colSpan={6} style={{ opacity: 0.7 }}>No records yet.</td>
                                                </tr>
                                            )}
                                            {Object.entries(hudScores)
                                                .sort(([a], [b]) => Number(a) - Number(b))
                                                .map(([count, score]) => (
                                                    <tr key={count}>
                                                        <td>{count}</td>
                                                        <td>
                                                            {Math.round(score.settleMs)}
                                                            {formatRatio(score.settleMs, baseScore?.settleMs)}
                                                        </td>
                                                        <td>
                                                            {score.jitter.toFixed(4)}
                                                            {formatRatio(score.jitter, baseScore?.jitter)}
                                                        </td>
                                                        <td>
                                                            {score.conflictPct.toFixed(1)}
                                                            {formatRatio(score.conflictPct, baseScore?.conflictPct)}
                                                        </td>
                                                        <td>
                                                            {score.energy.toFixed(4)}
                                                            {formatRatio(score.energy, baseScore?.energy)}
                                                        </td>
                                                        <td>
                                                            {score.degradePct.toFixed(1)}
                                                            {formatRatio(score.degradePct, baseScore?.degradePct)}
                                                        </td>
                                                    </tr>
                                                ))}
                                        </tbody>
                                    </table>
                                    <br />
                                    <br />
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', cursor: 'pointer', color: '#aaa', marginTop: '4px' }}>
                                        <input
                                            type="checkbox"
                                            checked={showLegacyDiagnostics}
                                            onChange={(e) => setShowLegacyDiagnostics(e.target.checked)}
                                        />
                                        Show Diagnostics
                                    </label>

                                    {showLegacyDiagnostics && (
                                        <div style={{ paddingLeft: '8px', borderLeft: '1px solid #333', marginTop: '4px' }}>
                                            <strong style={{ fontWeight: 700 }}>Performance</strong><br />
                                            Avg Vel: {metrics.avgVel.toFixed(4)} <br />
                                            <strong style={{ fontWeight: 700 }}>Shape Diagnostics</strong><br />
                                            Spread (R_mean): {metrics.avgDist.toFixed(2)} px <br />
                                            Irregularity (R_std): {metrics.stdDist.toFixed(2)} px <br />
                                            CV (Std/Mean): {(metrics.avgDist > 0 ? (metrics.stdDist / metrics.avgDist) : 0).toFixed(3)} <br />
                                            Aspect Ratio (W/H): {metrics.aspectRatio.toFixed(3)}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div >
            )}
        </>
    );
};
