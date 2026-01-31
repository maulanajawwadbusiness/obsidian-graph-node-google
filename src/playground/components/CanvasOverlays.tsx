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

// Toggle to show/hide debug controls buttons (Debug, Theme, Controls)
const SHOW_DEBUG_CONTROLS = true;

import type { ForceConfig } from '../../physics/types';

const stopPropagation = (e: React.MouseEvent) => e.stopPropagation();
type CanvasOverlaysProps = {
    config?: ForceConfig;
    onConfigChange?: (key: keyof ForceConfig, value: number | boolean) => void;
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
};

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
    config,
    onConfigChange
}) => {
    const hud = metrics.physicsHud;
    const formatRatio = (value: number, base?: number) => {
        if (!base || base <= 0) return '';
        return ` (x${(value / base).toFixed(2)})`;
    };
    const baseScore = hudScores[5];

    const [showAdvanced, setShowAdvanced] = React.useState(false);
    const [showLegacyControls, setShowLegacyControls] = React.useState(false);
    const [showLegacyDiagnostics, setShowLegacyDiagnostics] = React.useState(false);

    // NEW: HUD Layout State
    const [isNarrow, setIsNarrow] = React.useState(typeof window !== 'undefined' ? window.innerWidth < 450 : false);
    const [restForensicCollapsed, setRestForensicCollapsed] = React.useState(true);

    React.useEffect(() => {
        const handleResize = () => setIsNarrow(window.innerWidth < 450);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

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
                    onMouseMove={stopPropagation}
                    onMouseUp={stopPropagation}
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
                    onMouseMove={stopPropagation}
                    onMouseUp={stopPropagation}
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
                    onMouseMove={stopPropagation}
                    onMouseUp={stopPropagation}
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

            {debugOpen && (
                <div
                    style={{
                        ...DEBUG_OVERLAY_STYLE,
                        left: viewerOpen ? 'calc(50vw + 16px)' : DEBUG_OVERLAY_STYLE.left,
                        width: isNarrow ? 'calc(100vw - 32px)' : '420px',
                        maxWidth: '520px',
                        maxHeight: 'calc(100vh - 40px)',
                        overflowY: 'auto'
                    }}
                    onMouseDown={stopPropagation}
                    onMouseMove={stopPropagation}
                    onMouseUp={stopPropagation}
                    onWheel={stopPropagation}
                    onPointerDown={stopPropagation}
                    onPointerMove={stopPropagation}
                    onPointerUp={stopPropagation}
                >
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
                                ✕
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
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* PHYSICS HUD STATS */}
                            <div style={{ marginTop: '8px', lineHeight: '1.2' }}>
                                <strong style={{ fontWeight: 700 }}>Physics Stats</strong><br />
                                N: {metrics.nodes} | L: {metrics.links}<br />
                                FPS: {metrics.fps} <br />
                                Degrade: {hud ? hud.degradeLevel : 0} ({hud ? hud.degradePct5s.toFixed(1) : '0.0'}%)<br />
                                Settle: {hud ? hud.settleState : 'moving'} ({hud ? Math.round(hud.lastSettleMs) : 0}ms)<br />
                                Jitter(1s): {hud ? hud.jitterAvg.toFixed(4) : '0.0'}<br />
                                PBD Corr: {hud ? hud.pbdCorrectionSum.toFixed(3) : '0.0'}<br />
                                Conflict(5s): {hud ? hud.conflictPct5s.toFixed(1) : '0.0'}%<br />
                                Engy(v²): {hud ? hud.energyProxy.toFixed(4) : '0.0'}<br />
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
                            </div>

                            {/* REST MARKER FORENSIC (Collapsible) */}
                            {metrics.renderDebug?.restMarkerStats && (
                                <div style={{ marginTop: '8px', padding: '4px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)' }}>
                                    <div
                                        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                                        onClick={() => setRestForensicCollapsed(!restForensicCollapsed)}
                                    >
                                        <span style={{ fontSize: '10px', transform: restForensicCollapsed ? 'rotate(0deg)' : 'rotate(90deg)', transition: 'transform 0.1s' }}>▶</span>
                                        <strong style={{ color: '#aaa' }} >Rest Marker Forensic</strong>
                                    </div>
                                    {!restForensicCollapsed && (
                                        <div style={{ marginTop: '4px' }}>
                                            Enabled: {metrics.renderDebug.restMarkerStats.enabled ? 'YES' : 'NO'}<br />
                                            DrawPass: {metrics.renderDebug.restMarkerStats.drawPassCalled ? 'YES' : 'NO'} <br />
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', fontSize: '10px' }}>
                                                <div>A (HudSleep): {metrics.renderDebug.restMarkerStats.countA}</div>
                                                <div>B (IsSleep): {metrics.renderDebug.restMarkerStats.countB}</div>
                                                <div>C (Frames): {metrics.renderDebug.restMarkerStats.countC}</div>
                                                <div>D (Fallback): {metrics.renderDebug.restMarkerStats.countD}</div>
                                            </div>
                                            Candidates: {metrics.renderDebug.restMarkerStats.candidateCount}<br />
                                            NaN Speeds: {metrics.renderDebug.restMarkerStats.nanSpeedCount}<br />
                                            SpeedSq Ref: {(metrics.renderDebug.restMarkerStats.epsUsed ** 2).toFixed(6)} (Jit: {((metrics.renderDebug.restMarkerStats.epsUsed * 2.5) ** 2).toFixed(6)})<br />
                                            SpeedSq Range: [{metrics.renderDebug.restMarkerStats.minSpeedSq === Infinity ? 'Inf' : metrics.renderDebug.restMarkerStats.minSpeedSq.toExponential(2)}, {metrics.renderDebug.restMarkerStats.maxSpeedSq.toExponential(2)}]<br />
                                            SampleNode: {metrics.renderDebug.restMarkerStats.sampleNodeId || 'None'} <br />
                                            - Vx/Vy: {metrics.renderDebug.restMarkerStats.sampleNodeVx?.toFixed(4)} / {metrics.renderDebug.restMarkerStats.sampleNodeVy?.toFixed(4)}<br />
                                            - SpeedSq: {metrics.renderDebug.restMarkerStats.sampleNodeSpeedSq?.toExponential(4)}<br />
                                            - Sleep: {metrics.renderDebug.restMarkerStats.sampleNodeIsSleeping ? 'Y' : 'N'} ({metrics.renderDebug.restMarkerStats.sampleNodeSleepFrames})
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* RIGHT COLUMN: FORENSICS TABLES (Ledgers) */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {/* ENERGY LEDGER */}
                            {metrics.renderDebug?.energyLedger && metrics.renderDebug.energyLedger.length > 0 && (
                                <div style={{ padding: '4px', border: '1px solid rgba(100,255,100,0.2)', background: 'rgba(0,20,0,0.3)' }}>
                                    <strong style={{ color: '#8f8' }}>Energy Ledger (v²)</strong>
                                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', fontSize: '9px', gap: '2px', marginTop: '4px', lineHeight: '1.2' }}>
                                        <div style={{ borderBottom: '1px solid #444' }}>Stage</div>
                                        <div style={{ borderBottom: '1px solid #444', textAlign: 'right' }}>Energy</div>
                                        <div style={{ borderBottom: '1px solid #444', textAlign: 'right' }}>Δ</div>
                                        {metrics.renderDebug.energyLedger.map((row: any, i: number) => (
                                            <React.Fragment key={i}>
                                                <div>{row.stage}</div>
                                                <div style={{ textAlign: 'right', fontFamily: 'monospace' }}>{row.energy.toExponential(2)}</div>
                                                <div style={{ textAlign: 'right', fontFamily: 'monospace', color: row.delta > 0 ? '#ff8' : '#8ff' }}>
                                                    {row.delta > 0 ? '+' : ''}{row.delta.toExponential(1)}
                                                </div>
                                            </React.Fragment>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* FIGHT LEDGER */}
                            {metrics.renderDebug?.fightLedger && metrics.renderDebug.fightLedger.length > 0 && (
                                <div style={{ padding: '4px', border: '1px solid rgba(255,100,100,0.2)', background: 'rgba(20,0,0,0.3)' }}>
                                    <strong style={{ color: '#f88' }}>Constraint Fight Ledger</strong>
                                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', fontSize: '9px', gap: '2px', marginTop: '4px', lineHeight: '1.2' }}>
                                        <div style={{ borderBottom: '1px solid #444' }}>Stage</div>
                                        <div style={{ borderBottom: '1px solid #444', textAlign: 'right' }}>Conflict%</div>
                                        <div style={{ borderBottom: '1px solid #444', textAlign: 'right' }}>AvgCorr</div>
                                        {metrics.renderDebug.fightLedger.map((row: any, i: number) => (
                                            <React.Fragment key={i}>
                                                <div>{row.stage}</div>
                                                <div style={{ textAlign: 'right', fontFamily: 'monospace', color: row.conflictPct > 20 ? '#f88' : '#888' }}>
                                                    {row.conflictPct.toFixed(1)}%
                                                </div>
                                                <div style={{ textAlign: 'right', fontFamily: 'monospace' }}>
                                                    {row.avgCorr > 0 ? row.avgCorr.toFixed(3) : '-'}
                                                </div>
                                            </React.Fragment>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Placeholder for future forensic tables */}
                        </div>
                    </div>

                    {hudScenarioLabel && (
                        <>
                            <br />
                            <strong>Scenario:</strong> {hudScenarioLabel}
                            {hudDragTargetId && (
                                <div>Drag Target: {hudDragTargetId}</div>
                            )}
                        </>
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
                </div >
            )}
        </>
    );
};
