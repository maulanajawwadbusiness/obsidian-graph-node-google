import React, { useRef, useEffect, useState } from 'react';
import { PhysicsEngine } from '../physics/engine';
import { PhysicsNode, PhysicsLink, ForceConfig } from '../physics/types';
import { DEFAULT_PHYSICS_CONFIG } from '../physics/config';
import { SeededRandom } from '../utils/seededRandom';

// -----------------------------------------------------------------------------
// Styles (Inline for simplicity, as requested)
// -----------------------------------------------------------------------------
const CONTAINER_STYLE: React.CSSProperties = {
    display: 'flex',
    width: '100vw',
    height: '100vh',
    overflow: 'hidden',
    // Use the app font defined in src/index.css (@font-face 'Quicksand')
    fontFamily: "'Quicksand', Inter, system-ui, Avenir, Helvetica, Arial, sans-serif",
    background: '#111',
    color: '#eee',
};

const MAIN_STYLE: React.CSSProperties = {
    flex: 1,
    position: 'relative',
    cursor: 'grab',
};

const SIDEBAR_STYLE: React.CSSProperties = {
    width: '320px',
    padding: '20px',
    background: '#222',
    borderLeft: '1px solid #444',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    position: 'relative', // allow absolute-positioned close button
};

const DEBUG_OVERLAY_STYLE: React.CSSProperties = {
    position: 'absolute',
    top: '16px',
    left: '16px',
    padding: '8px 12px',
    background: 'rgba(0, 0, 0, 0.7)',
    borderRadius: '4px',
    pointerEvents: 'auto',
    fontSize: '12px',
    // Inherit Quicksand from the playground container (src/index.css + CONTAINER_STYLE)
    fontFamily: 'inherit',
    // Allow synthetic bold (root disables it via `font-synthesis: none`)
    fontSynthesis: 'weight',
    zIndex: 10,
};

const SIDEBAR_TOGGLE_STYLE: React.CSSProperties = {
    position: 'absolute',
    top: '16px',
    right: '16px',
    zIndex: 10,
    background: 'rgba(0,0,0,0.55)',
    color: '#eee',
    border: '1px solid rgba(255,255,255,0.25)',
    borderRadius: '8px',
    padding: '8px 10px',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: '12px',
    lineHeight: 1,
    backdropFilter: 'blur(6px)',
};

const DEBUG_TOGGLE_STYLE: React.CSSProperties = {
    position: 'absolute',
    top: '16px',
    left: '16px',
    zIndex: 11,
    background: 'rgba(0,0,0,0.55)',
    color: '#eee',
    border: '1px solid rgba(255,255,255,0.25)',
    borderRadius: '8px',
    padding: '8px 10px',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: '12px',
    lineHeight: 1,
    backdropFilter: 'blur(6px)',
};

const DEBUG_CLOSE_STYLE: React.CSSProperties = {
    width: '28px',
    height: '28px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '8px',
    background: 'rgba(0,0,0,0.35)',
    border: '1px solid rgba(255,255,255,0.18)',
    color: '#eee',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: '13px',
    lineHeight: 1,
};

const SIDEBAR_CLOSE_STYLE: React.CSSProperties = {
    position: 'absolute',
    top: '10px',
    right: '10px',
    width: '32px',
    height: '32px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '8px',
    background: 'rgba(0,0,0,0.35)',
    border: '1px solid rgba(255,255,255,0.18)',
    color: '#eee',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: '14px',
    lineHeight: 1,
};

// -----------------------------------------------------------------------------
// Helper: Random Graph Generator
// -----------------------------------------------------------------------------

// Generate a "Spine-Rib-Fiber" Topology
// KEY UPDATE: "Structural Seeding". Nodes are placed relative to their parents
// to break radial symmetry at t=0.
function generateRandomGraph(
    nodeCount: number,
    targetSpacing: number = 500,
    initScale: number = 0.1,
    seed: number = Date.now()
) {
    const nodes: PhysicsNode[] = [];
    const links: PhysicsLink[] = [];

    // Initialize seeded RNG for deterministic generation
    const rng = new SeededRandom(seed);

    // 0. Helper: Create Node (initially at 0,0, moved later)
    const createNode = (id: string, roleRadius: number, roleMass: number, role: 'spine' | 'rib' | 'fiber'): PhysicsNode => ({
        id,
        x: 0, y: 0, // Will be set by structure
        vx: 0, vy: 0, fx: 0, fy: 0,
        mass: roleMass,
        radius: roleRadius,
        isFixed: false,
        warmth: 1.0,
        role
    });

    // 1. Roles & Counts
    const spineCount = Math.max(3, Math.min(5, Math.floor(nodeCount * 0.1))); // 3-5 Spine nodes
    const remaining = nodeCount - spineCount;
    const ribRatio = 0.6 + rng.next() * 0.15; // 60-75% Ribs
    const ribCount = Math.floor(remaining * ribRatio);
    const fiberCount = remaining - ribCount;

    // Arrays to track indices
    const spineIndices: number[] = [];
    const ribIndices: number[] = [];
    const fiberIndices: number[] = [];

    let globalIdx = 0;

    // 2. Build Spine (The Axis)
    // Intentional Asymmetry: Diagonal Axis (1, 0.5)
    // Start offset (clamped to prevent singularity at targetSpacing=0)
    const currentPos = {
        x: (rng.next() - 0.5) * Math.max(40, targetSpacing * initScale * 5),
        y: (rng.next() - 0.5) * Math.max(40, targetSpacing * initScale * 5)
    };

    const spineStep = {
        x: Math.max(8, targetSpacing * initScale),  // Min 8px to prevent circle mode
        y: Math.max(4, targetSpacing * initScale * 0.5)  // Min 4px
    };

    for (let i = 0; i < spineCount; i++) {
        const id = `n${globalIdx}`;
        spineIndices.push(globalIdx);
        globalIdx++;

        const node = createNode(id, 8.0, 4.0, 'spine'); // Heavy, Big

        // PLACEMENT: Sequential
        if (i === 0) {
            node.x = currentPos.x;
            node.y = currentPos.y;
        } else {
            // Move "forward" along axis (jitter clamped)
            currentPos.x += spineStep.x + (rng.next() - 0.5) * Math.max(2, targetSpacing * initScale * 0.3);
            currentPos.y += spineStep.y + (rng.next() - 0.5) * Math.max(2, targetSpacing * initScale * 0.3);
            node.x = currentPos.x;
            node.y = currentPos.y;
        }

        nodes.push(node);

        // LINKING
        if (i > 0) {
            // Crooked Chain: Occasional branching (Y-shape)
            let targetStep = 1;
            if (i > 1 && rng.next() < 0.2) targetStep = 2; // Connect to grandparent

            const prevIdx = spineIndices[i - targetStep];
            links.push({
                source: `n${prevIdx}`,
                target: id,
                lengthBias: 0.5, // SHORT
                stiffnessBias: 1.0 // STIFF
            });
        }
    }

    // 3. Build Ribs (The Body)
    // Anchored to Spine
    for (let i = 0; i < ribCount; i++) {
        const id = `n${globalIdx}`;
        ribIndices.push(globalIdx);
        globalIdx++;

        const node = createNode(id, 6.0, 2.0, 'rib'); // Medium

        // Pick Anchor
        const spineAnchorIdx = spineIndices[Math.floor(rng.next() * spineIndices.length)];
        const spineAnchor = nodes[spineAnchorIdx];

        // PLACEMENT: Offset from Normal (clamped to prevent singularity)
        // "Normal" to (1, 0.5) is (-0.5, 1) or (0.5, -1).
        // Let's alternate sides based on index parity to create "volume"
        const side = (i % 2 === 0) ? 1 : -1;
        const ribOffset = {
            x: -Math.max(2, targetSpacing * initScale * 0.25) * side,
            y: Math.max(4, targetSpacing * initScale * 0.5) * side
        };

        node.x = spineAnchor.x + ribOffset.x + (rng.next() - 0.5) * Math.max(2, targetSpacing * initScale * 0.3);
        node.y = spineAnchor.y + ribOffset.y + (rng.next() - 0.5) * Math.max(2, targetSpacing * initScale * 0.3);

        nodes.push(node);

        // LINKING
        links.push({
            source: spineAnchor.id,
            target: id,
            lengthBias: 1.0, // NORMAL
            stiffnessBias: 0.8 // FIRM
        });

        // Cage (20% chance double link)
        if (rng.next() < 0.2) {
            const anchor2Idx = spineIndices[Math.floor(rng.next() * spineIndices.length)];
            if (anchor2Idx !== spineAnchorIdx) {
                links.push({
                    source: `n${anchor2Idx}`,
                    target: id,
                    lengthBias: 1.0,
                    stiffnessBias: 0.8
                });
            }
        }
    }

    // 4. Build Fibers (The Detail)
    // Anchored to Ribs
    for (let i = 0; i < fiberCount; i++) {
        const id = `n${globalIdx}`;
        fiberIndices.push(globalIdx);
        globalIdx++;

        const node = createNode(id, 4.0, 1.0, 'fiber'); // Light

        // Pick Anchor
        const ribAnchorIdx = ribIndices[Math.floor(rng.next() * ribIndices.length)];
        const ribAnchor = nodes[ribAnchorIdx];

        // PLACEMENT: Small outward offset (clamped to prevent singularity)
        // Just extend further out
        const fiberOffset = {
            x: (rng.next() - 0.5) * Math.max(6, targetSpacing * initScale * 0.67),
            y: (rng.next() - 0.5) * Math.max(6, targetSpacing * initScale * 0.67)
        };

        node.x = ribAnchor.x + fiberOffset.x;
        node.y = ribAnchor.y + fiberOffset.y;

        nodes.push(node);

        // LINKING
        links.push({
            source: ribAnchor.id,
            target: id,
            lengthBias: 1.5, // LONG
            stiffnessBias: 0.4 // LOOSE (Soft)
        });
    }

    return { nodes, links };
}

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

    useEffect(() => {
        settingsRef.current.useVariedSize = useVariedSize;
    }, [useVariedSize]);

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

    // Rendering Loop
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let frameId = 0;
        let lastTime = performance.now();
        let frameCount = 0;
        let lastFpsTime = lastTime;

        const engine = engineRef.current;

        // Initial Spawn if empty
        if (engine.nodes.size === 0) {
            const { nodes, links } = generateRandomGraph(20, config.targetSpacing, config.initScale, seed);
            nodes.forEach(n => engine.addNode(n));
            links.forEach(l => engine.addLink(l));
        }

        // Init bounds
        if (canvas) {
            engine.updateBounds(canvas.width, canvas.height);
        }

        const render = () => {
            const now = performance.now();

            // 1. Calc Delta Time
            const dtMs = now - lastTime;
            const dt = Math.min(dtMs / 1000, 0.1); // Cap at 100ms
            lastTime = now;

            // 2. Physics Tick
            engine.tick(dt);

            // 3. Draw
            // Resize canvas to window (simple approach)
            if (canvas.width !== canvas.offsetWidth || canvas.height !== canvas.offsetHeight) {
                canvas.width = canvas.offsetWidth;
                canvas.height = canvas.offsetHeight;
                engine.updateBounds(canvas.width, canvas.height); // Sync bounds
            }

            const width = canvas.width;
            const height = canvas.height;

            ctx.clearRect(0, 0, width, height);

            // CAMERA LEASH CONTAINMENT
            // Calculate node AABB in world space
            const nodes = Array.from(engine.nodes.values());
            if (nodes.length > 0) {
                let minX = Infinity, maxX = -Infinity;
                let minY = Infinity, maxY = -Infinity;

                nodes.forEach(node => {
                    minX = Math.min(minX, node.x - node.radius);
                    maxX = Math.max(maxX, node.x + node.radius);
                    minY = Math.min(minY, node.y - node.radius);
                    maxY = Math.max(maxY, node.y + node.radius);
                });

                const aabbWidth = maxX - minX;
                const aabbHeight = maxY - minY;
                const aabbCenterX = (minX + maxX) / 2;
                const aabbCenterY = (minY + maxY) / 2;

                // Define safe rect (viewport inset by margin)
                const marginPx = Math.min(width, height) * 0.15;
                const safeWidth = width - 2 * marginPx;
                const safeHeight = height - 2 * marginPx;

                // Calculate required zoom to fit AABB in safe rect
                const zoomX = safeWidth / aabbWidth;
                const zoomY = safeHeight / aabbHeight;
                const requiredZoom = Math.min(zoomX, zoomY, 1.0); // Don't zoom in past 1.0

                // Calculate required pan to center AABB
                const requiredPanX = -aabbCenterX;
                const requiredPanY = -aabbCenterY;

                // Update camera targets
                const camera = cameraRef.current;
                camera.targetPanX = requiredPanX;
                camera.targetPanY = requiredPanY;
                camera.targetZoom = requiredZoom;

                // Smooth damping (fast settle ~200-300ms)
                const dampingFactor = 0.15; // Higher = faster
                camera.panX += (camera.targetPanX - camera.panX) * dampingFactor;
                camera.panY += (camera.targetPanY - camera.panY) * dampingFactor;
                camera.zoom += (camera.targetZoom - camera.zoom) * dampingFactor;
            }

            // Apply camera transform
            ctx.save();
            const camera = cameraRef.current;
            ctx.translate(width / 2, height / 2);
            ctx.scale(camera.zoom, camera.zoom);
            ctx.translate(camera.panX, camera.panY);

            // Apply global rotation (rotating reference frame)
            // Rotate entire graph around centroid
            const centroid = engine.getCentroid();
            const globalAngle = engine.getGlobalAngle();
            ctx.translate(centroid.x, centroid.y);
            ctx.rotate(globalAngle);
            ctx.translate(-centroid.x, -centroid.y);

            // Draw Links
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.lineWidth = 0.4;
            engine.links.forEach((link) => {
                const source = engine.nodes.get(link.source);
                const target = engine.nodes.get(link.target);
                if (source && target) {
                    ctx.beginPath();
                    ctx.moveTo(source.x, source.y);
                    ctx.lineTo(target.x, target.y);
                    ctx.stroke();
                }
            });

            // Draw Nodes
            engine.nodes.forEach((node) => {
                ctx.beginPath();

                // SIZE TOGGLE LOGIC
                const radius = settingsRef.current.useVariedSize ? node.radius : 5.0;

                ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);

                // Style dependent on state
                if (node.isFixed) {
                    ctx.fillStyle = '#ff4444';
                } else {
                    ctx.fillStyle = '#4488ff';
                }

                ctx.fill();
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 1;
                ctx.stroke();
            });

            ctx.restore();

            // FPS & Stats Calc
            frameCount++;
            const fpsDelta = now - lastFpsTime;

            if (fpsDelta >= 100) { // Update every 100ms
                const fps = Math.round((frameCount * 1000) / fpsDelta);

                // Calc Average Kinetic Energy / Velocity
                let totalVel = 0;
                let activeNodes = 0;
                engine.nodes.forEach(n => {
                    const v = Math.sqrt(n.vx * n.vx + n.vy * n.vy);
                    totalVel += v;
                    if (v > 0) activeNodes++;
                });
                const avgVel = engine.nodes.size > 0 ? totalVel / engine.nodes.size : 0;

                // Shape Analysis
                let distSum = 0;
                let distSqSum = 0;
                let minX = Infinity, maxX = -Infinity;
                let minY = Infinity, maxY = -Infinity;

                engine.nodes.forEach(n => {
                    const d = Math.sqrt(n.x * n.x + n.y * n.y);
                    distSum += d;
                    distSqSum += d * d;
                    minX = Math.min(minX, n.x);
                    maxX = Math.max(maxX, n.x);
                    minY = Math.min(minY, n.y);
                    maxY = Math.max(maxY, n.y);
                });

                const count = engine.nodes.size;
                const avgDist = count > 0 ? distSum / count : 0;
                const variance = count > 0 ? (distSqSum / count) - (avgDist * avgDist) : 0;
                const stdDist = Math.sqrt(Math.max(0, variance));

                const shapeW = maxX - minX;
                const shapeH = maxY - minY;
                const aspect = (shapeH > 0.1) ? shapeW / shapeH : 1.0;

                setMetrics({
                    nodes: engine.nodes.size,
                    links: engine.links.length,
                    fps: isNaN(fps) ? 0 : fps,
                    avgVel: avgVel,
                    activeNodes: activeNodes,
                    avgDist,
                    stdDist,
                    aspectRatio: aspect,
                    lifecycleMs: Math.round(engine.lifecycle * 1000)
                });

                frameCount = 0;
                lastFpsTime = now;
            }

            frameId = requestAnimationFrame(render);
        };

        frameId = requestAnimationFrame(render);
        return () => cancelAnimationFrame(frameId);
    }, []); // Run once on mount

    // ---------------------------------------------------------------------------
    // Interaction Handlers (Drag & Drop)
    // ---------------------------------------------------------------------------
    const getWorldPos = (e: React.MouseEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        // Transform screen coords to world coords (considering 0,0 center)
        const px = e.clientX - rect.left - canvas.width / 2;
        const py = e.clientY - rect.top - canvas.height / 2;
        return { x: px, y: py };
    };

    const handleMouseDown = (e: React.MouseEvent) => {
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
        <div style={CONTAINER_STYLE}>
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
