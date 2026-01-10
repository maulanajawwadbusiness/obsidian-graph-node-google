import React, { useRef, useEffect, useState } from 'react';
import { PhysicsEngine } from '../physics/engine';
import { ForceConfig } from '../physics/types';
import { DEFAULT_PHYSICS_CONFIG } from '../physics/config';
import { GraphTheme, themeElegant, themeNormal } from './graphThemes';
import {
    BASE_CONTAINER_STYLE,
    DEBUG_CLOSE_STYLE,
    DEBUG_OVERLAY_STYLE,
    DEBUG_TOGGLE_STYLE,
    MAIN_STYLE,
    SIDEBAR_CLOSE_STYLE,
    SIDEBAR_STYLE,
    SIDEBAR_TOGGLE_STYLE,
    THEME_TOGGLE_STYLE
} from './graphStyles';
import { generateRandomGraph } from './randomGraph';
import { useGraphInteractions } from './useGraphInteractions';
import { useGraphRendering } from './useGraphRendering';

// -----------------------------------------------------------------------------
// Main Component
// -----------------------------------------------------------------------------
export const GraphPhysicsPlayground: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const engineRef = useRef<PhysicsEngine>(new PhysicsEngine());

    // State for React UI
    const [config, setConfig] = useState<ForceConfig>(DEFAULT_PHYSICS_CONFIG);
    const [useVariedSize, setUseVariedSize] = useState(false); // Toggle State
    const [sidebarOpen, setSidebarOpen] = useState(false); // Hidden by default
    const [debugOpen, setDebugOpen] = useState(true); // Shown by default
    const [useElegantTheme, setUseElegantTheme] = useState(false);
    const [metrics, setMetrics] = useState({
        nodes: 0,
        links: 0,
        fps: 0,
        avgVel: 0,
        activeNodes: 0,
        // Shape Diagnostics
        avgDist: 0,
        stdDist: 0,
        aspectRatio: 0,
        lifecycleMs: 0
    });
    const [spawnCount, setSpawnCount] = useState(20);
    const [seed, setSeed] = useState(Date.now()); // Seed for deterministic generation
    const activeTheme = useElegantTheme ? themeElegant : themeNormal;

    // Camera State (for automatic framing)
    const cameraRef = useRef({
        panX: 0,
        panY: 0,
        zoom: 1.0,
        targetPanX: 0,
        targetPanY: 0,
        targetZoom: 1.0
    });

    // Ref for Loop Access
    const settingsRef = useRef({ useVariedSize: true });
    const themeRef = useRef<GraphTheme>(themeNormal);

    useEffect(() => {
        settingsRef.current.useVariedSize = useVariedSize;
    }, [useVariedSize]);

    useEffect(() => {
        themeRef.current = useElegantTheme ? themeElegant : themeNormal;
    }, [useElegantTheme]);

    useEffect(() => {
        const isTypingTarget = (target: EventTarget | null) => {
            const el = target as HTMLElement | null;
            if (!el) return false;
            const tag = el.tagName?.toLowerCase();
            return tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable;
        };

        const onKeyDown = (e: KeyboardEvent) => {
            if (isTypingTarget(e.target)) return;
            if (e.key !== 'u' && e.key !== 'U') return;

            e.preventDefault();
            setSidebarOpen((v) => !v);
            setDebugOpen((v) => !v);
        };

        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, []);

    useGraphRendering({
        canvasRef,
        engineRef,
        config,
        spawnCount,
        seed,
        settingsRef,
        themeRef,
        cameraRef,
        setMetrics
    });

    const { handleMouseDown, handleMouseMove, handleMouseUp } = useGraphInteractions({
        canvasRef,
        engineRef,
        themeRef,
        settingsRef
    });

    // ---------------------------------------------------------------------------
    // Config Updates
    // ---------------------------------------------------------------------------
    const handleConfigChange = (key: keyof ForceConfig, value: number) => {
        const newConfig = { ...config, [key]: value };
        setConfig(newConfig);
        engineRef.current.updateConfig(newConfig);
    };

    const handleSpawn = () => {
        engineRef.current.clear();
        // Generate new random seed for each spawn
        const newSeed = Date.now();
        setSeed(newSeed);
        const { nodes, links } = generateRandomGraph(spawnCount, config.targetSpacing, config.initScale, newSeed);
        nodes.forEach(n => engineRef.current.addNode(n));
        links.forEach(l => engineRef.current.addLink(l));
    };

    const handleReset = () => {
        // Just randomize positions of existing nodes
        engineRef.current.nodes.forEach(n => {
            // SINGULARITY RESET
            n.x = (Math.random() - 0.5) * 1.0;
            n.y = (Math.random() - 0.5) * 1.0;
            n.vx = 0;
            n.vy = 0;
            n.warmth = 1.0;
        });
        engineRef.current.resetLifecycle();
    };

    const handleLogPreset = () => {
        const preset = {
            // Core spacing
            targetSpacing: config.targetSpacing,
            initScale: config.initScale,
            snapImpulseScale: config.snapImpulseScale,

            // Physics timing
            dampingSnap: 0.30,     // From engine.ts Flight phase
            dampingSettle: 0.90,   // From engine.ts Settle phase
            maxVelocity: config.maxVelocity,
            sleepThreshold: config.velocitySleepThreshold,

            // Springs
            springStiffness: config.springStiffness,

            // Collision
            collisionPadding: config.collisionPadding,
            collisionStrength: config.collisionStrength,

            // Repulsion
            repulsionStrength: config.repulsionStrength,
            repulsionDistanceMax: config.repulsionDistanceMax,

            // Generation
            seed: seed,
            nodeCount: spawnCount
        };

        console.log('='.repeat(60));
        console.log('PRESET CAPTURE');
        console.log('='.repeat(60));
        console.log(JSON.stringify(preset, null, 2));
        console.log('='.repeat(60));
    };

    return (
        <div style={{ ...BASE_CONTAINER_STYLE, background: activeTheme.background.baseColor }}>
            {/* Canvas Area */}
            <div
                style={MAIN_STYLE}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
            >
                <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />

                {/* Debug Toggle (when hidden) */}
                {!debugOpen && (
                    <button
                        type="button"
                        style={DEBUG_TOGGLE_STYLE}
                        onMouseDown={(e) => e.stopPropagation()}
                        onMouseMove={(e) => e.stopPropagation()}
                        onMouseUp={(e) => e.stopPropagation()}
                        onClick={(e) => {
                            e.stopPropagation();
                            setDebugOpen(true);
                        }}
                        aria-label="Show debug panel"
                        title="Show debug"
                    >
                        Debug
                    </button>
                )}

                {/* Sidebar Toggle */}
                <button
                    type="button"
                    style={SIDEBAR_TOGGLE_STYLE}
                    onMouseDown={(e) => e.stopPropagation()}
                    onMouseMove={(e) => e.stopPropagation()}
                    onMouseUp={(e) => e.stopPropagation()}
                    onClick={(e) => {
                        e.stopPropagation();
                        setSidebarOpen((v) => !v);
                    }}
                    aria-label={sidebarOpen ? 'Hide controls' : 'Show controls'}
                    title={sidebarOpen ? 'Hide controls' : 'Show controls'}
                >
                    {sidebarOpen ? 'Hide Controls' : 'Controls'}
                </button>

                {/* Theme Toggle */}
                <button
                    type="button"
                    style={THEME_TOGGLE_STYLE}
                    onMouseDown={(e) => e.stopPropagation()}
                    onMouseMove={(e) => e.stopPropagation()}
                    onMouseUp={(e) => e.stopPropagation()}
                    onClick={(e) => {
                        e.stopPropagation();
                        setUseElegantTheme((value) => !value);
                    }}
                    aria-label="Toggle theme"
                    title="Toggle theme"
                >
                    {useElegantTheme ? 'Theme: Elegant' : 'Theme: Normal'}
                </button>

                {/* Debug Overlay */}
                {debugOpen && (
                    <div
                        style={DEBUG_OVERLAY_STYLE}
                        onMouseDown={(e) => e.stopPropagation()}
                        onMouseMove={(e) => e.stopPropagation()}
                        onMouseUp={(e) => e.stopPropagation()}
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
                                    onClick={() => setDebugOpen(false)}
                                    aria-label="Hide debug panel"
                                    title="Hide"
                                >
                                    Hide
                                </button>
                                <button
                                    type="button"
                                    style={DEBUG_CLOSE_STYLE}
                                    onClick={() => setDebugOpen(false)}
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
            </div>

            {/* Sidebar Controls */}
            {sidebarOpen && (
                <div className="gp-sidebar" style={SIDEBAR_STYLE}>
                    <button
                        type="button"
                        style={SIDEBAR_CLOSE_STYLE}
                        onClick={() => setSidebarOpen(false)}
                        aria-label="Close controls"
                        title="Close"
                    >
                        ✕
                    </button>

                    <h3 style={{ paddingRight: '36px' }}>Physics Playground</h3>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
                        <button onClick={handleSpawn}>Spawn New</button>
                        <button onClick={handleReset}>Explode</button>
                        <button onClick={handleLogPreset} style={{ backgroundColor: '#2a5' }}>Log Preset</button>
                    </div>

                    {/* Size Toggle */}
                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <input
                                type="checkbox"
                                checked={useVariedSize}
                                onChange={(e) => setUseVariedSize(e.target.checked)}
                            />
                            Varied Node Sizes
                        </label>
                    </div>

                    <div>
                        <label>Node Count: {spawnCount}</label>
                        <input
                            type="range" min="10" max="400" step="10"
                            value={spawnCount}
                            onChange={(e) => setSpawnCount(Number(e.target.value))}
                            style={{ width: '100%' }}
                        />
                    </div>

                    <div style={{ marginTop: '12px' }}>
                        <label>Seed: {seed}</label>
                        <input
                            type="number"
                            value={seed}
                            onChange={(e) => setSeed(Number(e.target.value))}
                            style={{ width: '100%', padding: '4px', marginTop: '4px', fontFamily: 'inherit' }}
                            placeholder="Enter seed number"
                        />
                        <div style={{ fontSize: '11px', color: '#888', marginTop: '4px' }}>
                            Same seed = identical graph. Click "Spawn New" to use current seed.
                        </div>
                    </div>

                    <hr style={{ border: '0', borderTop: '1px solid #444', width: '100%' }} />

                    {/* Sliders */}
                    {Object.keys(DEFAULT_PHYSICS_CONFIG).map((key) => {
                        const k = key as keyof ForceConfig;
                        const val = config[k];

                        // Define ranges broadly for testing
                        let min = 0;
                        let max = 100;
                        let step = 1;

                        if (k === 'springStiffness' || k === 'damping' || k === 'gravityCenterStrength' || k === 'restForceScale') {
                            max = 1.0;
                            step = 0.01;
                        }
                        if (k === 'formingTime') {
                            max = 10.0;
                            step = 0.1;
                        }
                        if (k === 'repulsionStrength' || k === 'boundaryStrength' || k === 'collisionStrength') {
                            max = 10000;
                            step = 100;
                        }
                        if (k === 'repulsionDistanceMax' || k === 'springLength' || k === 'boundaryMargin' || k === 'gravityBaseRadius') {
                            max = 500;
                        }

                        return (
                            <div key={k}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                                    <span>{k}</span>
                                    <span>{val}</span>
                                </div>
                                <input
                                    type="range"
                                    min={min}
                                    max={max}
                                    step={step}
                                    value={val}
                                    onChange={(e) => handleConfigChange(k, Number(e.target.value))}
                                    style={{ width: '100%' }}
                                />
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
