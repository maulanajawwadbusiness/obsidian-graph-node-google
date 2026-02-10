// type check enabled
import React, { useRef, useState, useEffect, useLayoutEffect } from 'react';
import { PhysicsEngine } from '../physics/engine';
import { ForceConfig, PhysicsNode } from '../physics/types';
import { DEFAULT_PHYSICS_CONFIG } from '../physics/config';
import { DRAG_ENABLED, SkinMode, getTheme } from '../visual/theme';
import { CanvasOverlays } from './components/CanvasOverlays';
import { SidebarControls } from './components/SidebarControls';
import { HalfLeftWindow } from './components/HalfLeftWindow';
import { AIActivityGlyph } from './components/AIActivityGlyph';
import { CONTAINER_STYLE, MAIN_STYLE, SHOW_THEME_TOGGLE, SHOW_MAP_TITLE, SHOW_BRAND_LABEL } from './graphPlaygroundStyles';
import { PlaygroundMetrics } from './playgroundTypes';
import { useGraphRendering } from './useGraphRendering';
import { generateRandomGraph } from './graphRandom';
import { DocumentProvider, useDocument } from '../store/documentStore';
import { applyFirstWordsToNodes, applyAnalysisToNodes } from '../document/nodeBinding';
import type { ParsedDocument } from '../document/types';
import { MapTitleBlock } from './components/MapTitleBlock';
import { BrandLabel } from './components/BrandLabel';
import { PopupProvider, usePopup } from '../popup/PopupStore';
import { PopupPortal } from '../popup/PopupPortal';
import { RotationCompass } from './components/RotationCompass';
import { FullChatProvider, FullChatbar, FullChatToggle, useFullChat } from '../fullchat';
import TestBackend from '../components/TestBackend';
import { SessionExpiryBanner } from '../auth/SessionExpiryBanner';
import { LoadingScreen } from '../screens/LoadingScreen';
// RUN 4: Topology API imports
import { setTopology, getTopologyVersion, getTopology } from '../graph/topologyControl'; // STEP3-RUN5-V3-FIX3: Added getTopology
import { legacyToTopology } from '../graph/topologyAdapter';
// RUN 5: Spring derivation import
import { deriveSpringEdges } from '../graph/springDerivation';
// RUN 6: Spring-to-physics converter import
import { springEdgesToPhysicsLinks } from '../graph/springToPhysics';
// STEP3-RUN5-V4-FIX1: Removed unused recomputeSprings import
// RUN 8: Dev console helpers (exposes window.__topology)
// PRE-STEP2: Only import in dev mode to prevent bundling in production
if (import.meta.env.DEV) {
    import('../graph/devTopologyHelpers');
    // STEP2-RUN6: Dev console KG helpers (exposes window.__kg)
    import('../graph/devKGHelpers');
}

type PendingAnalysisPayload =
    | { kind: 'text'; text: string; createdAt: number }
    | { kind: 'file'; file: File; createdAt: number }
    | null;

type GraphPhysicsPlaygroundProps = {
    pendingAnalysisPayload: PendingAnalysisPayload;
    onPendingAnalysisConsumed: () => void;
    onLoadingStateChange?: (isLoading: boolean) => void;
    documentViewerToggleToken?: number;
};

function inferTitleFromPastedText(text: string): string {
    const firstLine = text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .find((line) => line.length > 0);
    if (!firstLine) return 'Pasted Document';
    const normalized = firstLine.replace(/\s+/g, ' ');
    return normalized.length > 80 ? normalized.slice(0, 80).trim() : normalized;
}

function countWords(text: string): number {
    const trimmed = text.trim();
    if (!trimmed) return 0;
    return trimmed.split(/\s+/).length;
}

// -----------------------------------------------------------------------------
// Main Component (Internal)
// -----------------------------------------------------------------------------
const GraphPhysicsPlaygroundInternal: React.FC<GraphPhysicsPlaygroundProps> = ({
    pendingAnalysisPayload,
    onPendingAnalysisConsumed,
    onLoadingStateChange,
    documentViewerToggleToken,
}) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const [canvasReady, setCanvasReady] = useState(false);
    // Run 3: Lazy Init engine to prevent double-construction on render
    const engineRef = useRef<PhysicsEngine>(null!); // forcing non-null assertion as we init immediately
    if (!engineRef.current) {
        engineRef.current = new PhysicsEngine();
    }
    // DEV: Expose engine for console proof helpers (xpbd constraint counts).
    if (import.meta.env.DEV && typeof window !== 'undefined') {
        (window as any).__engine = engineRef.current;
    }
    const documentContext = useDocument();
    const popupContext = usePopup();
    const fullChatContext = useFullChat();
    const fullChatOpen = fullChatContext.isOpen;
    const hasConsumedPendingRef = useRef(false);
    const currentPendingDocIdRef = useRef<string | null>(null);

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
    const [spawnCount, setSpawnCount] = useState(4);
    const [seed, setSeed] = useState(Date.now()); // Seed for deterministic generation

    // FIX: Adaptive Scale (Temp)
    // Reduce edge length for small graphs (<8 nodes)
    const effectiveConfig = { ...config };
    if (spawnCount < 8) { // Check spawn count as proxy for node count
        // Refined: 6-7 nodes get 0.15 reduction, <6 get 0.3 reduction
        const reduction = spawnCount >= 6 ? 0.15 : 0.3;

        // We modify the derived values since edgeLenScale is a constant, not a config prop we write to
        const adaptiveScale = 0.9 - reduction; // Base 0.9 from config default
        effectiveConfig.targetSpacing = 300 * adaptiveScale;
        effectiveConfig.linkRestLength = 104 * adaptiveScale;
    }

    const [skinMode, setSkinMode] = useState<SkinMode>('elegant'); // Skin toggle (default: elegant)
    const [cameraLocked, setCameraLocked] = useState(false);
    const [showPresetHUD, _setShowPresetHUD] = useState(false); // Toggle for preset HUD - set to true to show
    const [showDebugGrid, setShowDebugGrid] = useState(false);
    const [pixelSnapping, setPixelSnapping] = useState(false);
    const [debugNoRenderMotion, setDebugNoRenderMotion] = useState(false);
    const [showRestMarkers, setShowRestMarkers] = useState(false);
    const [showConflictMarkers, setShowConflictMarkers] = useState(false);
    const [forceShowRestMarkers, setForceShowRestMarkers] = useState(false);
    const [markerIntensity, setMarkerIntensity] = useState(1);
    const [showTestBackend, _setShowTestBackend] = useState(false);
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
        canvasReady,
        config: effectiveConfig, // Use adaptive config
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

    const setCanvasEl = React.useCallback((el: HTMLCanvasElement | null) => {
        canvasRef.current = el;
        setCanvasReady(Boolean(el));
    }, []);

    // 2. Sync Engine Config when effective config changes
    useEffect(() => {
        if (engineRef.current) {
            engineRef.current.updateConfig(effectiveConfig);
        }
    }, [effectiveConfig.targetSpacing, effectiveConfig.linkRestLength]); // React to adaptive changes

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
                documentContext.setAIError,
                documentContext.setInferredTitle
            );
        }
    };

    // ---------------------------------------------------------------------------
    // Config Updates
    // ---------------------------------------------------------------------------
    const handleConfigChange = (key: keyof ForceConfig, value: number | boolean | string) => {
        // Run 4: Fix stale closure by using updater
        setConfig(prev => {
            const newConfig = { ...prev, [key]: value };
            engineRef.current?.updateConfig(newConfig);
            return newConfig;
        });
    };

    const handleXpbdDampingPreset = (preset: 'SNAPPY' | 'BALANCED' | 'SMOOTH') => {
        // 1. Dispatch to Engine (Source of Truth for Logic & Probes)
        engineRef.current?.applyXpbdDampingPreset(preset);

        // 2. Sync Local React State (Visuals only, no re-dispatch)
        const presetValues = {
            SNAPPY: 0.12,
            BALANCED: 0.20,
            SMOOTH: 0.32
        };
        const value = presetValues[preset];
        setConfig(prev => ({ ...prev, xpbdDamping: value }));
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

    const buildControlledGraph = (activeConfig: ForceConfig) => {
        const spacing = Math.max(120, activeConfig.targetSpacing * 0.6);
        const nodes: PhysicsNode[] = [
            { id: 'n1', x: -spacing, y: 0, vx: 0, vy: 0, fx: 0, fy: 0, mass: 3, radius: 8, isFixed: false, warmth: 1.0, role: 'spine', label: 'Node 1' },
            { id: 'n2', x: 0, y: -spacing * 0.7, vx: 0, vy: 0, fx: 0, fy: 0, mass: 2, radius: 6, isFixed: false, warmth: 1.0, role: 'rib', label: 'Node 2' },
            { id: 'n3', x: 0, y: spacing * 0.7, vx: 0, vy: 0, fx: 0, fy: 0, mass: 2, radius: 6, isFixed: false, warmth: 1.0, role: 'rib', label: 'Node 3' },
            { id: 'n4', x: spacing, y: spacing * 0.7, vx: 0, vy: 0, fx: 0, fy: 0, mass: 1, radius: 5, isFixed: false, warmth: 1.0, role: 'fiber', label: 'Node 4' }
        ];

        const topology = {
            nodes: nodes.map(node => ({
                id: node.id,
                label: node.label,
                meta: { role: node.role }
            })),
            links: [
                { from: 'n1', to: 'n2', kind: 'manual', weight: 1.0 },
                { from: 'n1', to: 'n3', kind: 'manual', weight: 1.0 },
                { from: 'n3', to: 'n4', kind: 'manual', weight: 1.0 },
                { from: 'n4', to: 'n1', kind: 'manual', weight: 1.0 }
            ]
        };

        return { nodes, topology };
    };

    const spawnGraph = (count: number, newSeed: number) => {
        const engine = engineRef.current;
        if (!engine) return;
        engine.clear();
        setSeed(newSeed);
        const useControlled = count === 4;
        let nodes: PhysicsNode[] = [];
        let topology: ReturnType<typeof legacyToTopology>;

        if (useControlled) {
            const controlled = buildControlledGraph(config);
            nodes = controlled.nodes;
            topology = controlled.topology;
            console.log('[Run4] Using controlled topology: n1->n2, n1->n3, n3->n4');
        } else {
            const random = generateRandomGraph(
                count,
                config.targetSpacing,
                config.initScale,
                newSeed,
                config.initStrategy,
                config.minNodeDistance
            );
            nodes = random.nodes;
            // RUN 4: Convert to Topology and use API
            topology = legacyToTopology(random.nodes, random.links);
        }

        // Console proof
        console.log(`[Run4] Topology set: ${topology.nodes.length} nodes, ${topology.links.length} directed links`);
        console.log(`[Run4] Sample links (first 5):`, topology.links.slice(0, 5));

        // STEP3-RUN5-V3-FIX3: Call setTopology ONCE - it recomputes springs internally
        // STEP3-RUN5-V4-FIX2: Pass config for rest-length policy
        const beforeVersion = getTopologyVersion();
        setTopology(topology, config);
        const afterVersion = getTopologyVersion();
        console.log(`[Run7] Topology version: ${beforeVersion} → ${afterVersion} (changed: ${beforeVersion !== afterVersion})`);

        // Get final topology with springs
        const finalTopology = getTopology();
        console.log(`[STEP3-RUN3] Springs recomputed internally: ${finalTopology.springs?.length || 0} undirected springs from ${topology.links.length} directed links`);

        // RUN 5: Test spring edge derivation (legacy check)
        const springEdges = deriveSpringEdges(topology, config);
        console.log(`[Run5] Spring edges derived: ${springEdges.length}`);
        console.log(`[Run5] Sample spring edges (first 3):`, springEdges.slice(0, 3));

        // STEP3-RUN5-V3-FIX5: Fallback-derive for XPBD if springs missing
        let physicsLinks: any[] = [];
        if (!finalTopology.springs || finalTopology.springs.length === 0) {
            if (finalTopology.links.length > 0) {
                console.warn(`[STEP3-FIX5] ⚠ Springs missing but links exist! Fallback-deriving for XPBD...`);
                const fallbackSprings = deriveSpringEdges(finalTopology, config);
                physicsLinks = springEdgesToPhysicsLinks(fallbackSprings);
            }
        } else {
            physicsLinks = springEdgesToPhysicsLinks(finalTopology.springs);
        }

        console.log(`[Run6] Engine wiring: ${nodes.length} nodes, ${physicsLinks.length} physics links`);
        console.log(`[STEP3-RUN4] XPBD consuming ${physicsLinks.length} springs (not ${topology.links.length} directed links)`);

        nodes.forEach(n => engine.addNode(n));
        physicsLinks.forEach(l => engine.addLink(l));
        engine.resetLifecycle();
    };

    useEffect(() => {
        // Spawn the controlled 4-dot topology on load.
        spawnGraph(4, 1337);
    }, []);

    useEffect(() => {
        if (!pendingAnalysisPayload) return;
        if (hasConsumedPendingRef.current) return;
        if (documentContext.state.aiActivity) return;
        if (!engineRef.current || engineRef.current.nodes.size === 0) return;

        const setAIErrorWithAuthLog = (message: string | null) => {
            if (message && message.includes('Please log in')) {
                console.log('[graph] analyze_failed status=401 (auth)');
            }
            documentContext.setAIError(message);
        };

        if (pendingAnalysisPayload.kind === 'text') {
            hasConsumedPendingRef.current = true;
            const text = pendingAnalysisPayload.text;
            const createdAt = pendingAnalysisPayload.createdAt;
            const docId = `pasted-${createdAt}`;
            const inferredTitle = inferTitleFromPastedText(text);
            const syntheticDocument: ParsedDocument = {
                id: docId,
                fileName: `${inferredTitle}.txt`,
                mimeType: 'text/plain',
                sourceType: 'txt',
                text,
                warnings: [],
                meta: {
                    wordCount: countWords(text),
                    charCount: text.length
                }
            };
            currentPendingDocIdRef.current = docId;

            console.log(`[graph] consuming_pending_analysis kind=text len=${text.length}`);
            onPendingAnalysisConsumed();
            documentContext.setDocument(syntheticDocument);
            documentContext.setInferredTitle(inferredTitle);

            void (async () => {
                let ok = true;
                try {
                    await applyAnalysisToNodes(
                        engineRef.current,
                        text,
                        docId,
                        () => currentPendingDocIdRef.current,
                        documentContext.setAIActivity,
                        setAIErrorWithAuthLog,
                        documentContext.setInferredTitle
                    );
                } catch (error) {
                    ok = false;
                    console.error('[graph] pending analysis failed', error);
                    setAIErrorWithAuthLog('We could not reach the server, so analysis did not run. Your graph is unchanged.');
                } finally {
                    console.log(`[graph] pending_analysis_done ok=${ok}`);
                }
            })();
            return;
        }

        if (pendingAnalysisPayload.kind !== 'file') return;
        if (!documentContext.isWorkerReady) return;

        hasConsumedPendingRef.current = true;
        const file = pendingAnalysisPayload.file;
        console.log(`[graph] consuming_pending_analysis kind=file name=${file.name} size=${file.size}`);
        onPendingAnalysisConsumed();

        void (async () => {
            let ok = true;
            let parsed: ParsedDocument | null = null;
            try {
                setLastDroppedFile(file);
                parsed = await documentContext.parseFile(file);
            } catch (error) {
                ok = false;
                console.error('[graph] pending_file_parse_failed', error);
                documentContext.setAIError('Could not parse file. Please try another file.');
                documentContext.setAIActivity(false);
                console.log(`[graph] pending_analysis_done ok=${ok}`);
                return;
            }

            if (!parsed) {
                ok = false;
                console.log('[graph] pending_file_parse_failed reason=no_document');
                documentContext.setAIError('Could not parse file. Please try another file.');
                documentContext.setAIActivity(false);
                console.log(`[graph] pending_analysis_done ok=${ok}`);
                return;
            }

            const parsedText = parsed.text?.trim() ?? '';
            if (parsedText.length === 0) {
                ok = false;
                console.log('[graph] pending_file_empty_text');
                documentContext.setAIError('Could not extract text from file (scanned PDF or empty).');
                documentContext.setAIActivity(false);
                console.log(`[graph] pending_analysis_done ok=${ok}`);
                return;
            }

            const docId = parsed.id || `dropped-${pendingAnalysisPayload.createdAt}`;
            currentPendingDocIdRef.current = docId;
            documentContext.setDocument(parsed);
            applyFirstWordsToNodes(engineRef.current, parsed);

            try {
                await applyAnalysisToNodes(
                    engineRef.current,
                    parsed.text,
                    docId,
                    () => currentPendingDocIdRef.current,
                    documentContext.setAIActivity,
                    setAIErrorWithAuthLog,
                    documentContext.setInferredTitle
                );
            } catch (error) {
                ok = false;
                console.error('[graph] pending_file_analyze_failed', error);
                const message = error instanceof Error ? error.message : String(error);
                const lower = message.toLowerCase();
                if (
                    lower.includes('401') ||
                    lower.includes('403') ||
                    lower.includes('unauthorized') ||
                    lower.includes('forbidden') ||
                    lower.includes('please log in')
                ) {
                    documentContext.setAIError('You are not logged in. Please log in and try again.');
                } else if (
                    lower.includes('failed to fetch') ||
                    lower.includes('network') ||
                    lower.includes('timeout')
                ) {
                    documentContext.setAIError('We could not reach the server, so analysis did not run. Your graph is unchanged.');
                } else {
                    documentContext.setAIError('Analysis failed. Please try again.');
                }
            } finally {
                documentContext.setAIActivity(false);
                console.log(`[graph] pending_analysis_done ok=${ok}`);
            }
        })();
    }, [
        pendingAnalysisPayload,
        onPendingAnalysisConsumed,
        documentContext.state.aiActivity,
        documentContext.isWorkerReady,
        documentContext.setAIActivity,
        documentContext.setDocument,
        documentContext.setAIError,
        documentContext.setInferredTitle
    ]);

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
    const lastDocumentViewerToggleTokenRef = useRef<number | undefined>(documentViewerToggleToken);

    useEffect(() => {
        if (documentViewerToggleToken === undefined) return;
        if (lastDocumentViewerToggleTokenRef.current === undefined) {
            lastDocumentViewerToggleTokenRef.current = documentViewerToggleToken;
            return;
        }
        if (documentViewerToggleToken === lastDocumentViewerToggleTokenRef.current) return;
        lastDocumentViewerToggleTokenRef.current = documentViewerToggleToken;
        toggleViewer();
    }, [documentViewerToggleToken]);

    const aiErrorMessage = documentContext.state.aiErrorMessage;
    const isGraphLoading = documentContext.state.aiActivity || Boolean(aiErrorMessage);
    const wasLoadingRef = useRef(false);

    useEffect(() => {
        if (wasLoadingRef.current && !isGraphLoading) {
            console.log('[Graph] loading_exit_remount_canvas');
        }
        wasLoadingRef.current = isGraphLoading;
    }, [isGraphLoading]);

    useEffect(() => {
        onLoadingStateChange?.(isGraphLoading);
    }, [isGraphLoading, onLoadingStateChange]);

    if (isGraphLoading) {
        return <LoadingScreen errorMessage={aiErrorMessage || null} />;
    }

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
                <SessionExpiryBanner />
                <canvas ref={setCanvasEl} style={{ width: '100%', height: '100%', background: activeTheme.background }} />
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
                {showTestBackend && <TestBackend />}
                <AIActivityGlyph />
                {SHOW_MAP_TITLE && <MapTitleBlock />}
                {SHOW_BRAND_LABEL && <BrandLabel />}
                <PopupPortal engineRef={engineRef} />
                <RotationCompass engineRef={engineRef} />
                {/* STEP 5/5 RUN 2: Minimal preset controls for hand calibration */}
                {showPresetHUD && (
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
                                    background: config.xpbdDamping === 0.28 ? '#4a9eff' : '#333',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: '2px'
                                }}
                            >
                                Smooth
                            </button>
                        </div>
                    </div>
                )}

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
export const GraphPhysicsPlayground: React.FC<GraphPhysicsPlaygroundProps> = ({
    pendingAnalysisPayload,
    onPendingAnalysisConsumed,
    onLoadingStateChange,
    documentViewerToggleToken
}) => (
    <DocumentProvider>
        <PopupProvider>
            <FullChatProvider>
                <GraphPhysicsPlaygroundInternal
                    pendingAnalysisPayload={pendingAnalysisPayload}
                    onPendingAnalysisConsumed={onPendingAnalysisConsumed}
                    onLoadingStateChange={onLoadingStateChange}
                    documentViewerToggleToken={documentViewerToggleToken}
                />
            </FullChatProvider>
        </PopupProvider>
    </DocumentProvider>
);
