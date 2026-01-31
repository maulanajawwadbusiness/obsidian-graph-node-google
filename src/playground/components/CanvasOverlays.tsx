import React from 'react';
import { PlaygroundMetrics } from '../playgroundTypes';
import {
    DEBUG_CLOSE_STYLE,
    DEBUG_OVERLAY_STYLE,
    DEBUG_TOGGLE_STYLE,
    SIDEBAR_TOGGLE_STYLE,
    THEME_TOGGLE_STYLE
} from '../graphPlaygroundStyles';

// Toggle to show/hide debug controls buttons (Debug, Theme, Controls)
const SHOW_DEBUG_CONTROLS = true;

const stopPropagation = (e: React.MouseEvent) => e.stopPropagation();
type CanvasOverlaysProps = {
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
    onSpawnPreset,
    onRunSettleScenario,
    onRunDragScenario,
    onRecordHudScore,
    hudScenarioLabel,
    hudDragTargetId,
    hudScores
}) => {
    const hud = metrics.physicsHud;
    const formatRatio = (value: number, base?: number) => {
        if (!base || base <= 0) return '';
        return ` (x${(value / base).toFixed(2)})`;
    };
    const baseScore = hudScores[5];

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
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '10px' }}>
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
                <strong style={{ fontWeight: 700 }}>Physics HUD</strong><br />
                Nodes: {metrics.nodes} | Links: {metrics.links}<br />
                FPS: {metrics.fps} <br />
                Degrade: {hud ? hud.degradeLevel : 0} ({hud ? hud.degradePct5s.toFixed(1) : '0.0'}%)<br />
                Settle: {hud ? hud.settleState : 'moving'} ({hud ? Math.round(hud.lastSettleMs) : 0}ms)<br />
                JitterAvg (1s): {hud ? hud.jitterAvg.toFixed(4) : '0.0000'}<br />
                PBD Corr/frame: {hud ? hud.pbdCorrectionSum.toFixed(3) : '0.000'}<br />
                Conflict% (5s): {hud ? hud.conflictPct5s.toFixed(1) : '0.0'}%<br />
                Energy Proxy (avg v²): {hud ? hud.energyProxy.toFixed(4) : '0.0000'}<br />
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
                <strong style={{ fontWeight: 700 }}>Performance</strong><br />
                Avg Vel: {metrics.avgVel.toFixed(4)} <br />
                <strong style={{ fontWeight: 700 }}>Shape Diagnostics</strong><br />
                Spread (R_mean): {metrics.avgDist.toFixed(2)} px <br />
                Irregularity (R_std): {metrics.stdDist.toFixed(2)} px <br />
                CV (Std/Mean): {(metrics.avgDist > 0 ? (metrics.stdDist / metrics.avgDist) : 0).toFixed(3)} <br />
                Aspect Ratio (W/H): {metrics.aspectRatio.toFixed(3)}
            </div>
        )}
    </>
    );
};
