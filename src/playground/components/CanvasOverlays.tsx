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
            </div>
        )}
    </>
);
