// type check enabled
import React, { useRef, useState, useEffect, useLayoutEffect } from 'react';
import { PhysicsEngine } from '../physics/engine';
import { ForceConfig } from '../physics/types';
import { DEFAULT_PHYSICS_CONFIG } from '../physics/config';
import { DRAG_ENABLED, SkinMode, getTheme } from '../visual/theme';
import { CanvasOverlays } from './components/CanvasOverlays';
import { SidebarControls } from './components/SidebarControls';
import { TextPreviewButton } from './components/TextPreviewButton';
import { HalfLeftWindow } from './components/HalfLeftWindow';
import { AIActivityGlyph } from './components/AIActivityGlyph';
import { CONTAINER_STYLE, MAIN_STYLE, SHOW_THEME_TOGGLE, SHOW_MAP_TITLE, SHOW_BRAND_LABEL } from './graphPlaygroundStyles';
import { PlaygroundMetrics } from './playgroundTypes';
import { useGraphRendering } from './useGraphRendering';
import { generateRandomGraph } from './graphRandom';
import { DocumentProvider, useDocument } from '../store/documentStore';
import { applyFirstWordsToNodes, applyAnalysisToNodes } from '../document/nodeBinding';
import { AnalysisOverlay } from '../components/AnalysisOverlay';
import { MapTitleBlock } from './components/MapTitleBlock';
import { BrandLabel } from './components/BrandLabel';
import { PopupProvider, usePopup } from '../popup/PopupStore';
import { PopupPortal } from '../popup/PopupPortal';
import { RotationCompass } from './components/RotationCompass';
import { FullChatProvider, FullChatbar, FullChatToggle, useFullChat } from '../fullchat';

// -----------------------------------------------------------------------------
// Main Component (Internal)
// -----------------------------------------------------------------------------
const GraphPhysicsPlaygroundInternal: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const engineRef = useRef<PhysicsEngine>(new PhysicsEngine());
    const documentContext = useDocument();
    const popupContext = usePopup();
    const fullChatContext = useFullChat();
    const fullChatOpen = fullChatContext.isOpen;

    // State for React UI
    const [config, setConfig] = useState<ForceConfig>(DEFAULT_PHYSICS_CONFIG);
    const [useVariedSize, setUseVariedSize] = useState(false); // Toggle State
    const [sidebarOpen, setSidebarOpen] = useState(false); // Hidden by default
    const [debugOpen, setDebugOpen] = useState(true); // Open by default
    const [lastDroppedFile, setLastDroppedFile] = useState<File | null>(null);
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
    const [spawnCount, setSpawnCount] = useState(15);
    const [seed, setSeed] = useState(Date.now()); // Seed for deterministic generation
    const [skinMode, setSkinMode] = useState<SkinMode>('elegant'); // Skin toggle (default: elegant)
    const [cameraLocked, setCameraLocked] = useState(false);
    const [showDebugGrid, setShowDebugGrid] = useState(false);
    const [pixelSnapping, setPixelSnapping] = useState(false);
    const [debugNoRenderMotion, setDebugNoRenderMotion] = useState(false);
    const [showRestMarkers, setShowRestMarkers] = useState(false);
    const [showConflictMarkers, setShowConflictMarkers] = useState(false);
    const [forceShowRestMarkers, setForceShowRestMarkers] = useState(false);
    const [markerIntensity, setMarkerIntensity] = useState(1);
    const [hudScenarioLabel, setHudScenarioLabel] = useState('');
    const [hudDragTargetId, setHudDragTargetId] = useState<string | null>(null);
    const [hudScores, setHudScores] = useState<Record<number, {
        settleMs: number;
        jitter: number;
        conflictPct: number;
        energy: number;
        degradePct: number;
    }>>({});

    const {
        handlePointerMove,
        handlePointerEnter,
        handlePointerLeave,
        handlePointerCancel,
        handlePointerUp,
        clearHover,
        clientToWorld,
        worldToScreen,
        hoverStateRef,
        updateHoverSelection,
        handleDragStart,
        handleDragEnd
    } = useGraphRendering({
        canvasRef,
        config,
        engineRef,
        seed,
        setMetrics,
        spawnCount,
        useVariedSize,
        skinMode,
        cameraLocked,
        showDebugGrid,
        pixelSnapping,
        debugNoRenderMotion,
        showRestMarkers,
        showConflictMarkers,
        markerIntensity,
        forceShowRestMarkers
    });

    useEffect(() => {
        hoverStateRef.current.hoverDisplayNodeId = hudDragTargetId;
    }, [hudDragTargetId, hoverStateRef]);

    // FIX 36: Kill Layout Thrash (Single Rect Read)
    // Cache the rect using ResizeObserver so we don't force reflows during high-frequency pointer moves.
    const contentRectRef = useRef<DOMRect | null>(null);

    useLayoutEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const update = () => {
            contentRectRef.current = canvas.getBoundingClientRect();
        };

        // Initial measurement
        update();

        const ro = new ResizeObserver(update);
        ro.observe(canvas);

        return () => ro.disconnect();
    }, []);

    // (getCachedRect removed - unused)

    // Wrap hook handlers for pointer events
    const onPointerMove = (e: React.PointerEvent) => {
        // FIX: Reliable Source (currentTarget is the div we listened on)
        // Avoid aborted input due to null canvasRef.
        const target = e.currentTarget as HTMLElement;
        const rect = target.getBoundingClientRect();

        // 1. Hover Update (Ref-based, cheap)
        // FIX 28: Decoupled Input Sampling
        // FORENSIC LOG: Pointer Move (Sampled)
        if (Math.random() < 0.05) {
            const container = e.currentTarget as HTMLElement;
            console.log(`[PointerTrace] Move id=${e.pointerId} captured=${container.hasPointerCapture(e.pointerId)} x=${e.clientX.toFixed(0)}`);
        }
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
        // FIX 29: Lifecycle Safety
        handleDragEnd();
    };

    const onLostPointerCapture = (e: React.PointerEvent) => {
        // Treat as cancel/up
        handlePointerUp(e.pointerId, e.pointerType);
        handleDragEnd();
    };

    // Track gesture start for Click vs Drag distinction
    const gestureStartRef = useRef<{ x: number, y: number, nodeId: string | null } | null>(null);

    const onPointerDown = (e: React.PointerEvent) => {
        // FIX: Capture on Container (e.currentTarget) to ensure events aren't lost
        // even if e.target was a child element (like an overlay) or we drag off-screen.
        const container = e.currentTarget as HTMLElement;

        // FORENSIC LOG: Routing Debug
        if (DRAG_ENABLED) {
            console.log(`[PointerTrace] Down id=${e.pointerId} target=${(e.target as HTMLElement).tagName}.${(e.target as HTMLElement).className} current=${container.tagName} captured=${container.hasPointerCapture(e.pointerId)}`);
        }

        // FIX: Relaxed Target Check
        if (!container) return;

        // Capture! (Wrap in try/catch just in case)
        try {
            container.setPointerCapture(e.pointerId);
            if (DRAG_ENABLED) {
                console.log(`[PointerTrace] Capture Success: id=${e.pointerId} on ${container.tagName}`);
            }
        } catch (err) {
            console.error(`[PointerTrace] Capture FAILED:`, err);
        }

        if (!DRAG_ENABLED) {
            engineRef.current.releaseNode();
            return;
        }

        // Use cached rect if available (from RO) or measure container
        const rect = container.getBoundingClientRect();
        const theme = getTheme(skinMode);

        updateHoverSelection(e.clientX, e.clientY, rect, theme, 'pointer');

        const hitId = hoverStateRef.current.hoveredNodeId;

        // Record Gesture Start
        gestureStartRef.current = {
            x: e.clientX,
            y: e.clientY,
            nodeId: hitId
        };

        if (hitId) {
            // FIX 36: Deferred Drag Start (First Frame Continuity)
            if (DRAG_ENABLED) {
                console.log(`[PointerTrace] Queueing DragStart for ${hitId} at ${e.clientX},${e.clientY}`);
                handleDragStart(hitId, e.clientX, e.clientY);
            }
        }
    };

    const onPointerUp = (e: React.PointerEvent) => {
        const container = e.currentTarget as HTMLElement;
        try {
            if (container.hasPointerCapture(e.pointerId)) {
                container.releasePointerCapture(e.pointerId);
            }
        } catch (err) { /* ignore */ }

        console.log(`[PointerTrace] Up id=${e.pointerId} released-from=${container.tagName}`);
        handlePointerUp(e.pointerId, e.pointerType);

        // GESTURE LOGIC: Click vs Drag
        const start = gestureStartRef.current;
        if (start && start.nodeId) {
            const dx = e.clientX - start.x;
            const dy = e.clientY - start.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            // Threshold: < 5px is a Click
            if (dist < 5) {
                const node = engineRef.current.nodes.get(start.nodeId);
                // Verify node still exists and matches
                if (node) {
                    const rect = container.getBoundingClientRect();
                    const screenPos = worldToScreen(node.x, node.y, rect);
                    const cameraZoom = hoverStateRef.current.lastSelectionZoom || 1;
                    const visualRadius = node.radius * cameraZoom;

                    const metaContent = node.meta ? {
                        title: node.meta.sourceTitle,
                        summary: node.meta.sourceSummary
                    } : undefined;

                    popupContext.openPopup(start.nodeId, {
                        x: screenPos.x,
                        y: screenPos.y,
                        radius: visualRadius
                    }, metaContent);

                    console.log('[Gesture] Click detected (dist<5px). Opening popup for:', start.nodeId);
                }
            } else {
                console.log('[Gesture] Drag detected (dist>5px). Popup suppressed.');
            }
        }

        gestureStartRef.current = null; // Reset
        handleDragEnd();
    };

    // ---------------------------------------------------------------------------
    // Drag & Drop Handlers (Document Upload)
    // ---------------------------------------------------------------------------
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();

        const files = Array.from(e.dataTransfer.files);
        if (files.length === 0) return;

        const file = files[0];
        console.log('[Drop] File dropped:', file.name, file.type);
        setLastDroppedFile(file);

        // Convert drop coordinates to world space
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const world = clientToWorld(e.clientX, e.clientY, rect);
        console.log('[Drop] World position:', world.x.toFixed(2), world.y.toFixed(2));

        // Parse file in worker and get document immediately
        const document = await documentContext.parseFile(file);

        // Apply first 5 words to node labels (fast, synchronous)
        if (document) {
            applyFirstWordsToNodes(engineRef.current, document);

            // Trigger AI label rewrite (async, non-blocking)
            // Capture docId now to avoid races with documentContext updates.
            const docId = document.id;
            applyAnalysisToNodes(
                engineRef.current,
                document.text,
                docId,
                () => docId,
                documentContext.setAIActivity,
                documentContext.setInferredTitle
            );
        }
    };

    // ---------------------------------------------------------------------------
    // Config Updates
    // ---------------------------------------------------------------------------
    const handleConfigChange = (key: keyof ForceConfig, value: number | boolean) => {
        const newConfig = { ...config, [key]: value };
        setConfig(newConfig);
        engineRef.current?.updateConfig(newConfig);
    };

    const handleXpbdDampingPreset = (preset: 'SNAPPY' | 'BALANCED' | 'SMOOTH') => {
        const presetValues = {
            SNAPPY: 0.12,
            BALANCED: 0.20,
            SMOOTH: 0.32
        };
        handleConfigChange('xpbdDamping', presetValues[preset]);
    };

    // Capture Safety: Release drag on window blur (Alt-Tab)
    useEffect(() => {
        const handleBlur = () => {
            if (engineRef.current.draggedNodeId) {
                handleDragEnd();
            }
        };
        window.addEventListener('blur', handleBlur);
        return () => window.removeEventListener('blur', handleBlur);
    }, [handleDragEnd]);

    // FIX 40: Global Shortcut Gate (Focus Truth)
    // Prevent browser defaults (e.g. Page Scroll on Space/Arrows) when interacting with Canvas.
    // Allow them if user is typing in Chat/Input.
    useEffect(() => {
        const handleGlobalKeydown = (e: KeyboardEvent) => {
            // 1. Focus Check: Is user typing?
            const target = e.target as HTMLElement;
            const isInput = target.tagName === 'INPUT' ||
                target.tagName === 'TEXTAREA' ||
                target.isContentEditable;

            if (isInput) {
                // User is typing. Let browser/app handle it (e.g. space in text).
                // Do NOT block.
                return;
            }

            // 2. Block List: Keys that cause unwanted browser scrolling/nav on Canvas
            // Space, Arrows
            if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
                e.preventDefault();
                // e.stopPropagation(); // Optional: Stop bubble if we had conflicting listeners up-tree
            }
        };

        window.addEventListener('keydown', handleGlobalKeydown, { capture: true }); // Capture to intercept early
        return () => window.removeEventListener('keydown', handleGlobalKeydown, { capture: true });
    }, []);

    const spawnGraph = (count: number, newSeed: number) => {
        const engine = engineRef.current;
        if (!engine) return;
        engine.clear();
        setSeed(newSeed);
        const { nodes, links } = generateRandomGraph(
            count,
            config.targetSpacing,
            config.initScale,
            newSeed,
            config.initStrategy,
            config.minNodeDistance
        );
        nodes.forEach(n => engine.addNode(n));
        links.forEach(l => engine.addLink(l));
        engine.resetLifecycle();
    };

    const handleSpawn = () => {
        // Generate new random seed for each spawn
        const newSeed = Date.now();
        spawnGraph(spawnCount, newSeed);
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

    const handleSpawnPreset = (count: number) => {
        const fixedSeed = 1337 + count;
        setSpawnCount(count);
        setHudScenarioLabel(`Preset N=${count} (seed ${fixedSeed})`);
        setHudDragTargetId(null);
        spawnGraph(count, fixedSeed);
    };

    const handleSettleScenario = () => {
        const fixedSeed = 1337 + spawnCount;
        setHudScenarioLabel('Settle test: wait for settle → sleep, then record.');
        setHudDragTargetId(null);
        spawnGraph(spawnCount, fixedSeed);
    };

    const handleDragScenario = () => {
        const engine = engineRef.current;
        if (!engine) return;
        const degreeMap = new Map<string, number>();
        for (const link of engine.links) {
            degreeMap.set(link.source, (degreeMap.get(link.source) || 0) + 1);
            degreeMap.set(link.target, (degreeMap.get(link.target) || 0) + 1);
        }
        let targetId: string | null = null;
        let bestDeg = -1;
        for (const node of engine.nodes.values()) {
            const deg = degreeMap.get(node.id) || 0;
            if (deg > bestDeg) {
                bestDeg = deg;
                targetId = node.id;
            }
        }
        setHudDragTargetId(targetId);
        setHudScenarioLabel('Drag test: drag highlighted dot for 2s, then release.');
    };

    const handleSimulateJitter = () => {
        if (!engineRef.current) return;
        engineRef.current.debugSimulateJitterUntil = performance.now() + 5000;
        console.log('[Dev] Simulating Jitter for 5s');
    };

    const handleSimulateSpike = () => {
        if (!engineRef.current) return;
        engineRef.current.debugSimulateSpikeFrames = 1;
        console.log('[Dev] Simulating Spike (250ms)');
    };

    const handleRecordHudScore = () => {
        const hud = metrics.physicsHud;
        if (!hud) return;
        const count = metrics.nodes;
        setHudScores(prev => ({
            ...prev,
            [count]: {
                settleMs: hud.lastSettleMs,
                jitter: hud.jitterAvg,
                conflictPct: hud.conflictPct5s,
                energy: hud.energyProxy,
                degradePct: hud.degradePct5s,
            }
        }));
    };

    // Get theme for container styling
    const activeTheme = getTheme(skinMode);

    const toggleViewer = () => {
        clearHover('viewer toggle', -1, 'unknown');
        documentContext.togglePreview();
    };

    return (
        <div style={{ ...CONTAINER_STYLE, background: activeTheme.background }}>
            <HalfLeftWindow
                open={documentContext.state.previewOpen}
                onClose={() => {
                    clearHover('viewer close', -1, 'unknown');
                    documentContext.setPreviewOpen(false);
                }}
                rawFile={lastDroppedFile}
            />
            <div
                style={MAIN_STYLE}
                onPointerDown={onPointerDown}
                onPointerEnter={onPointerEnter}
                onPointerMoveCapture={onPointerMove}
                onPointerLeave={onPointerLeave}
                onPointerCancel={onPointerCancel}
                onLostPointerCapture={onLostPointerCapture}
                onPointerUp={onPointerUp}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
            >
                <canvas ref={canvasRef} style={{ width: '100%', height: '100%', background: activeTheme.background }} />
                <CanvasOverlays
                    config={config}
                    onConfigChange={handleConfigChange}
                    debugOpen={debugOpen}
                    metrics={metrics}
                    onCloseDebug={() => setDebugOpen(false)}
                    onShowDebug={() => setDebugOpen(true)}
                    onToggleSidebar={() => setSidebarOpen((v) => !v)}
                    onToggleTheme={() => setSkinMode(skinMode === 'elegant' ? 'normal' : 'elegant')}
                    showThemeToggle={SHOW_THEME_TOGGLE}
                    sidebarOpen={sidebarOpen}
                    skinMode={skinMode}
                    viewerOpen={documentContext.state.previewOpen}
                    cameraLocked={cameraLocked}
                    showDebugGrid={showDebugGrid}
                    onToggleCameraLock={() => setCameraLocked(v => !v)}
                    onToggleDebugGrid={() => setShowDebugGrid(v => !v)}
                    pixelSnapping={pixelSnapping}
                    debugNoRenderMotion={debugNoRenderMotion}
                    onTogglePixelSnapping={() => setPixelSnapping(v => !v)}
                    onToggleNoRenderMotion={() => setDebugNoRenderMotion(v => !v)}
                    showRestMarkers={showRestMarkers}
                    showConflictMarkers={showConflictMarkers}
                    markerIntensity={markerIntensity}
                    forceShowRestMarkers={forceShowRestMarkers}
                    onToggleRestMarkers={() => setShowRestMarkers(v => !v)}
                    onToggleConflictMarkers={() => setShowConflictMarkers(v => !v)}
                    onToggleForceShowRestMarkers={() => setForceShowRestMarkers(v => !v)}
                    onMarkerIntensityChange={setMarkerIntensity}
                    onSpawnPreset={handleSpawnPreset}
                    onRunSettleScenario={handleSettleScenario}
                    onRunDragScenario={handleDragScenario}
                    onRecordHudScore={handleRecordHudScore}
                    hudScenarioLabel={hudScenarioLabel}
                    hudDragTargetId={hudDragTargetId}
                    hudScores={hudScores}
                />
                <TextPreviewButton onToggle={toggleViewer} />
                <AIActivityGlyph />
                <AnalysisOverlay />
                {SHOW_MAP_TITLE && <MapTitleBlock />}
                {SHOW_BRAND_LABEL && <BrandLabel />}
                <PopupPortal engineRef={engineRef} />
                <RotationCompass engineRef={engineRef} />

                {/* STEP 5/5 RUN 2: Minimal preset controls for hand calibration */}
                <div style={{
                    position: 'absolute',
                    top: '10px',
                    left: '10px',
                    background: 'rgba(0, 0, 0, 0.7)',
                    color: '#fff',
                    padding: '8px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontFamily: 'monospace',
                    pointerEvents: 'auto',
                    zIndex: 1000
                }}
                onPointerDown={(e) => e.stopPropagation()}
                >
                    <div style={{ marginBottom: '4px', fontWeight: 'bold' }}>
                        XPBD Damping: {(config.xpbdDamping ?? 0.20).toFixed(2)} {config.xpbdDamping !== undefined ? '(CONFIG)' : '(DEFAULT)'}
                    </div>
                    <div style={{ display: 'flex', gap: '4px' }}>
                        <button
                            onClick={() => handleXpbdDampingPreset('SNAPPY')}
                            onPointerDown={(e) => e.stopPropagation()}
                            style={{
                                padding: '4px 8px',
                                fontSize: '10px',
                                cursor: 'pointer',
                                background: config.xpbdDamping === 0.12 ? '#4a9eff' : '#333',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '2px'
                            }}
                        >
                            Snappy
                        </button>
                        <button
                            onClick={() => handleXpbdDampingPreset('BALANCED')}
                            onPointerDown={(e) => e.stopPropagation()}
                            style={{
                                padding: '4px 8px',
                                fontSize: '10px',
                                cursor: 'pointer',
                                background: config.xpbdDamping === 0.20 ? '#4a9eff' : '#333',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '2px'
                            }}
                        >
                            Balanced
                        </button>
                        <button
                            onClick={() => handleXpbdDampingPreset('SMOOTH')}
                            onPointerDown={(e) => e.stopPropagation()}
                            style={{
                                padding: '4px 8px',
                                fontSize: '10px',
                                cursor: 'pointer',
                                background: config.xpbdDamping === 0.32 ? '#4a9eff' : '#333',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '2px'
                            }}
                        >
                            Smooth
                        </button>
                    </div>
                </div>

                <FullChatToggle />
            </div>

            {sidebarOpen && !fullChatOpen && (
                <SidebarControls
                    config={config}
                    onClose={() => setSidebarOpen(false)}
                    onConfigChange={handleConfigChange}
                    onLogPreset={handleLogPreset}
                    onReset={handleReset}
                    onSpawn={handleSpawn}
                    onToggleVariedSize={setUseVariedSize}
                    onSimulateJitter={handleSimulateJitter}
                    onSimulateSpike={handleSimulateSpike}
                    seed={seed}
                    setSeed={setSeed}
                    setSpawnCount={setSpawnCount}
                    spawnCount={spawnCount}
                    useVariedSize={useVariedSize}
                />
            )}

            {fullChatOpen && (
                <FullChatbar engineRef={engineRef} />
            )}
        </div>
    );

}; // close GraphPhysicsPlaygroundInternal

// Wrapper with DocumentProvider, PopupProvider, and FullChatProvider
export const GraphPhysicsPlayground: React.FC = () => (
    <DocumentProvider>
        <PopupProvider>
            <FullChatProvider>
                <GraphPhysicsPlaygroundInternal />
            </FullChatProvider>
        </PopupProvider>
    </DocumentProvider>
);
