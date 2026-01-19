import React, { useEffect, useRef, useState } from 'react';
import { PhysicsEngine } from '../physics/engine';
import { ForceConfig } from '../physics/types';
import { DEFAULT_PHYSICS_CONFIG } from '../physics/config';
import { DRAG_ENABLED, SkinMode, getTheme } from '../visual/theme';
import { CanvasOverlays } from './components/CanvasOverlays';
import { SidebarControls } from './components/SidebarControls';
import { CONTAINER_STYLE, MAIN_STYLE, SHOW_THEME_TOGGLE } from './graphPlaygroundStyles';
import { PlaygroundMetrics } from './playgroundTypes';
import { useGraphRendering } from './useGraphRendering';
import { generateRandomGraph } from './graphRandom';

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
    const [debugOpen, setDebugOpen] = useState(false); // Hidden by default
    const [metrics, setMetrics] = useState<PlaygroundMetrics>({
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
    const [spawnCount, setSpawnCount] = useState(5);
    const [seed, setSeed] = useState(Date.now()); // Seed for deterministic generation
    const [skinMode, setSkinMode] = useState<SkinMode>('elegant'); // Skin toggle (default: elegant)

    const {
        handlePointerMove,
        handlePointerEnter,
        handlePointerLeave,
        handlePointerCancel,
        handlePointerUp,
        clientToWorld
    } = useGraphRendering({
        canvasRef,
        config,
        engineRef,
        seed,
        setMetrics,
        spawnCount,
        useVariedSize,
        skinMode
    });

    // Wrap hook handlers for pointer events
    const onPointerMove = (e: React.PointerEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        handlePointerMove(e.pointerId, e.pointerType, e.clientX, e.clientY, rect);
    };

    const onPointerEnter = (e: React.PointerEvent) => {
        handlePointerEnter(e.pointerId, e.pointerType);
    };

    const onPointerLeave = (e: React.PointerEvent) => {
        handlePointerLeave(e.pointerId, e.pointerType);
    };

    const onPointerCancel = (e: React.PointerEvent) => {
        handlePointerCancel(e.pointerId, e.pointerType);
    };

    const onPointerUp = (e: React.PointerEvent) => {
        handlePointerUp(e.pointerId, e.pointerType);
    };

    // Keyboard shortcut: "U" toggles both UI panels (sidebar + debug)
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

    useEffect(() => {
        if (!DRAG_ENABLED) {
            engineRef.current.releaseNode();
        }
    }, [DRAG_ENABLED]);

    // ---------------------------------------------------------------------------
    // Interaction Handlers (Drag & Drop)
    // ---------------------------------------------------------------------------
    const getWorldPos = (e: React.MouseEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        // Transform screen coords to world coords (camera + rotation aware)
        const { x, y } = clientToWorld(e.clientX, e.clientY, rect);
        return { x, y };
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        if (!DRAG_ENABLED) {
            engineRef.current.releaseNode();
            return;
        }
        const { x, y } = getWorldPos(e);

        // Find node under cursor
        // Simple naive search (checking all nodes). Fine for <1000 nodes.
        let hitId: string | null = null;
        let minDist = Infinity;

        engineRef.current.nodes.forEach((node) => {
            const dx = node.x - x;
            const dy = node.y - y;
            const d = Math.sqrt(dx * dx + dy * dy);
            // Give a bit of fuzzy hit area (radius + 5px padding)
            if (d < node.radius + 10 && d < minDist) {
                minDist = d;
                hitId = node.id;
            }
        });

        if (hitId) {
            engineRef.current.grabNode(hitId, { x, y });
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!DRAG_ENABLED) {
            engineRef.current.releaseNode();
            return;
        }
        const { x, y } = getWorldPos(e);
        engineRef.current.moveDrag({ x, y });
    };

    const handleMouseUp = () => {
        engineRef.current.releaseNode();
    };

    // ---------------------------------------------------------------------------
    // Config Updates
    // ---------------------------------------------------------------------------
    const handleConfigChange = (key: keyof ForceConfig, value: number) => {
        const newConfig = { ...config, [key]: value };
        setConfig(newConfig);
        engineRef.current?.updateConfig(newConfig);
    };

    const handleSpawn = () => {
        const engine = engineRef.current;
        if (!engine) return;
        engine.clear();
        // Generate new random seed for each spawn
        const newSeed = Date.now();
        setSeed(newSeed);
        const { nodes, links } = generateRandomGraph(spawnCount, config.targetSpacing, config.initScale, newSeed);
        nodes.forEach(n => engine.addNode(n));
        links.forEach(l => engine.addLink(l));
    };

    const handleReset = () => {
        const engine = engineRef.current;
        if (!engine) return;
        // Just randomize positions of existing nodes
        engine.nodes.forEach(n => {
            // SINGULARITY RESET
            n.x = (Math.random() - 0.5) * 1.0;
            n.y = (Math.random() - 0.5) * 1.0;
            n.vx = 0;
            n.vy = 0;
            n.warmth = 1.0;
        });
        engine.resetLifecycle();
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

    // Get theme for container styling
    const activeTheme = getTheme(skinMode);

    return (
        <div style={{ ...CONTAINER_STYLE, background: activeTheme.background }}>
            <div
                style={MAIN_STYLE}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onPointerEnter={onPointerEnter}
                onPointerMove={onPointerMove}
                onPointerLeave={onPointerLeave}
                onPointerCancel={onPointerCancel}
                onPointerUp={onPointerUp}
            >
                <canvas ref={canvasRef} style={{ width: '100%', height: '100%', background: activeTheme.background }} />
                <CanvasOverlays
                    debugOpen={debugOpen}
                    metrics={metrics}
                    onCloseDebug={() => setDebugOpen(false)}
                    onShowDebug={() => setDebugOpen(true)}
                    onToggleSidebar={() => setSidebarOpen((v) => !v)}
                    onToggleTheme={() => setSkinMode(skinMode === 'elegant' ? 'normal' : 'elegant')}
                    showThemeToggle={SHOW_THEME_TOGGLE}
                    sidebarOpen={sidebarOpen}
                    skinMode={skinMode}
                />
            </div>

            {sidebarOpen && (
                <SidebarControls
                    config={config}
                    onClose={() => setSidebarOpen(false)}
                    onConfigChange={handleConfigChange}
                    onLogPreset={handleLogPreset}
                    onReset={handleReset}
                    onSpawn={handleSpawn}
                    onToggleVariedSize={setUseVariedSize}
                    seed={seed}
                    setSeed={setSeed}
                    setSpawnCount={setSpawnCount}
                    spawnCount={spawnCount}
                    useVariedSize={useVariedSize}
                />
            )}
        </div>
    );
};
