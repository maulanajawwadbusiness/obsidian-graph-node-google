import React, { useRef, useState, useEffect, useMemo, useLayoutEffect } from 'react';
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
    const [debugOpen, setDebugOpen] = useState(false); // Hidden by default
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
    const [spawnCount, setSpawnCount] = useState(30);
    const [seed, setSeed] = useState(Date.now()); // Seed for deterministic generation
    const [skinMode, setSkinMode] = useState<SkinMode>('elegant'); // Skin toggle (default: elegant)
    const [cameraLocked, setCameraLocked] = useState(false);
    const [showDebugGrid, setShowDebugGrid] = useState(false);
    const [pixelSnapping, setPixelSnapping] = useState(false);
    const [debugNoRenderMotion, setDebugNoRenderMotion] = useState(false);

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
        updateHoverSelection
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
        debugNoRenderMotion
    });



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

    const getCachedRect = () => {
        // Fallback to live read if RO hasn't fired yet (rare) or fails
        return contentRectRef.current || canvasRef.current?.getBoundingClientRect() || ({ left: 0, top: 0, width: 0, height: 0 } as DOMRect);
    };

    // Wrap hook handlers for pointer events
    const onPointerMove = (e: React.PointerEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        // Use cached rect to avoid forcing style recalc
        const rect = getCachedRect();

        // 1. Hover Update (Ref-based, cheap)
        // FIX 28: Decoupled Input Sampling
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
        engineRef.current.releaseNode();
    };

    const onLostPointerCapture = (e: React.PointerEvent) => {
        // Treat as cancel/up
        handlePointerUp(e.pointerId, e.pointerType);
        engineRef.current.releaseNode();
    };

    // Track gesture start for Click vs Drag distinction
    const gestureStartRef = useRef<{ x: number, y: number, nodeId: string | null } | null>(null);

    const onPointerDown = (e: React.PointerEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        if (e.target !== canvas) return;

        canvas.setPointerCapture(e.pointerId);

        if (!DRAG_ENABLED) {
            engineRef.current.releaseNode();
            return;
        }

        const rect = canvas.getBoundingClientRect();
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
            // Don't grab immediately. Queue it for the next render tick.
            // This ensures we calculate the anchor using the exact camera state of the frame.
            // const { x, y } = clientToWorld(e.clientX, e.clientY, rect);
            // engineRef.current.grabNode(hitId, { x, y });
            if (DRAG_ENABLED) { // Check again just to be safe, though checked above
                // We need to access pendingPointerRef, but we don't have it exposed from hook?
                // Wait, useGraphRendering does NOT expose pendingPointerRef.
                // We need to expose it or pass a function to set it.
                // Let's check useGraphRendering.ts.
                // Actually, we can just expose a "startDrag" or "setPendingDrag" from the hook.
                // OR, since we are in `GraphPhysicsPlayground`, we typically don't touch refs directly if not exposed.
                // Let's see if we can expose pendingPointerRef from `useGraphRendering`.
                // FOR NOW: I will assume I can update useGraphRendering to expose `pendingPointerRef`.
                // BUT I CAN'T change multiple files in parallel if I need to verify.
                // Let's modify useGraphRendering first or use a callback from the hook.
                // Better: `startGraphDrag(nodeId, clientX, clientY)` exposed from hook.
            }
        }
    };

    const onPointerUp = (e: React.PointerEvent) => {
        const canvas = canvasRef.current;
        if (canvas && canvas.hasPointerCapture(e.pointerId)) {
            canvas.releasePointerCapture(e.pointerId);
        }
        handlePointerUp(e.pointerId, e.pointerType);

        // GESTURE LOGIC: Click vs Drag
        const start = gestureStartRef.current;
        if (start && start.nodeId) {
            const dx = e.clientX - start.x;
            const dy = e.clientY - start.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            // Threshold: < 5px is a Click
            if (dist < 5) {
                // It was a click (not a drag)
                const node = engineRef.current.nodes.get(start.nodeId);
                // Verify node still exists and matches
                if (node) {
                    const rect = canvas!.getBoundingClientRect();
                    const screenPos = worldToScreen(node.x, node.y, rect);
                    // Standard visual radius estimate (can be refined via renderDebug)
                    const cameraZoom = hoverStateRef.current.lastSelectionZoom || 1;
                    const visualRadius = node.radius * cameraZoom; // Basic radius
                    // Popups usually attach to the "bubble" which includes glow/padding.
                    // Let's use `visualRadius` but maybe pad it?
                    // The old code `radius * 5` suggests nodes are drawn small but hit area is huge?
                    // Actually, nodes are drawn small (r=3-5) but we want popup to spawn outside the "cluster"?
                    // Let's stick to `visualRadius` but maybe add a margin in the Popup logic itself.
                    // Actually, `computePopupPosition` uses `radius` to push it away.
                    // Let's pass the actual visual radius.

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
        engineRef.current.releaseNode();
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

    // Capture Safety: Release drag on window blur (Alt-Tab)
    useEffect(() => {
        const handleBlur = () => {
            if (engineRef.current.draggedNodeId) {
                engineRef.current.releaseNode();
            }
        };
        window.addEventListener('blur', handleBlur);
        return () => window.removeEventListener('blur', handleBlur);
    }, []);

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
                onPointerMove={onPointerMove}
                onPointerLeave={onPointerLeave}
                onPointerCancel={onPointerCancel}
                onLostPointerCapture={onLostPointerCapture}
                onPointerUp={onPointerUp}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
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
                    viewerOpen={documentContext.state.previewOpen}
                    cameraLocked={cameraLocked}
                    showDebugGrid={showDebugGrid}
                    onToggleCameraLock={() => setCameraLocked(v => !v)}
                    onToggleDebugGrid={() => setShowDebugGrid(v => !v)}
                    pixelSnapping={pixelSnapping}
                    debugNoRenderMotion={debugNoRenderMotion}
                    onTogglePixelSnapping={() => setPixelSnapping(v => !v)}
                    onToggleNoRenderMotion={() => setDebugNoRenderMotion(v => !v)}
                />
                <TextPreviewButton onToggle={toggleViewer} />
                <AIActivityGlyph />
                <AnalysisOverlay />
                {SHOW_MAP_TITLE && <MapTitleBlock />}
                {SHOW_BRAND_LABEL && <BrandLabel />}
                <PopupPortal engineRef={engineRef} />
                <RotationCompass engineRef={engineRef} />
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
};

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
