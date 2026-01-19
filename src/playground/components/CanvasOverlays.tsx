import React from 'react';
import { PlaygroundMetrics } from '../playgroundTypes';
import {
    DEBUG_CLOSE_STYLE,
    DEBUG_OVERLAY_STYLE,
    DEBUG_TOGGLE_STYLE,
    SIDEBAR_TOGGLE_STYLE,
    THEME_TOGGLE_STYLE
} from '../graphPlaygroundStyles';

const stopPropagation = (e: React.MouseEvent) => e.stopPropagation();
const formatState = (state: { globalAlpha: number; globalCompositeOperation: string; filter: string }) =>
    `a=${state.globalAlpha.toFixed(2)} comp=${state.globalCompositeOperation} filter=${state.filter}`;

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
    skinMode
}) => (
    <>
        {!debugOpen && (
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

        {showThemeToggle && (
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

        {debugOpen && (
            <div
                style={DEBUG_OVERLAY_STYLE}
                onMouseDown={stopPropagation}
                onMouseMove={stopPropagation}
                onMouseUp={stopPropagation}
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
                <strong style={{ fontWeight: 700 }}>Performance</strong><br />
                FPS: {metrics.fps} <br />
                Nodes: {metrics.nodes} (Active: {metrics.activeNodes}) <br />
                Links: {metrics.links} <br />
                Avg Vel: {metrics.avgVel.toFixed(4)} <br />
                <br />
                <strong style={{ fontWeight: 700 }}>Shape Diagnostics</strong><br />
                Spread (R_mean): {metrics.avgDist.toFixed(2)} px <br />
                Irregularity (R_std): {metrics.stdDist.toFixed(2)} px <br />
                CV (Std/Mean): {(metrics.avgDist > 0 ? (metrics.stdDist / metrics.avgDist) : 0).toFixed(3)} <br />
                Aspect Ratio (W/H): {metrics.aspectRatio.toFixed(3)}
                {metrics.renderDebug && (
                    <>
                        <br />
                        <br />
                        <strong style={{ fontWeight: 700 }}>Render Debug</strong><br />
                        Draw Order: {metrics.renderDebug.drawOrder.join(' > ')} <br />
                        Idle Glow Pass: {metrics.renderDebug.idleGlowPassIndex} <br />
                        Active Glow Pass: {metrics.renderDebug.activeGlowPassIndex} <br />
                        Ring Pass: {metrics.renderDebug.ringPassIndex} <br />
                        Idle Glow (pre): {formatState(metrics.renderDebug.idleGlowStateBefore)} <br />
                        Idle Glow (post): {formatState(metrics.renderDebug.idleGlowStateAfter)} <br />
                        Idle Ring (pre): {formatState(metrics.renderDebug.idleRingStateBefore)} <br />
                        Idle Ring (post): {formatState(metrics.renderDebug.idleRingStateAfter)} <br />
                        Active Glow (pre): {formatState(metrics.renderDebug.activeGlowStateBefore)} <br />
                        Active Glow (post): {formatState(metrics.renderDebug.activeGlowStateAfter)} <br />
                        Active Ring (pre): {formatState(metrics.renderDebug.activeRingStateBefore)} <br />
                        Active Ring (post): {formatState(metrics.renderDebug.activeRingStateAfter)}
                    </>
                )}
            </div>
        )}
    </>
);
