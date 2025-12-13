import React, { useRef, useEffect, useState, useCallback } from 'react';
import { PhysicsEngine } from '../physics/engine';
import { PhysicsNode, PhysicsLink, ForceConfig } from '../physics/types';
import { DEFAULT_PHYSICS_CONFIG } from '../physics/config';

// -----------------------------------------------------------------------------
// Styles (Inline for simplicity, as requested)
// -----------------------------------------------------------------------------
const CONTAINER_STYLE: React.CSSProperties = {
    display: 'flex',
    width: '100vw',
    height: '100vh',
    overflow: 'hidden',
    fontFamily: 'sans-serif',
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
};

const DEBUG_OVERLAY_STYLE: React.CSSProperties = {
    position: 'absolute',
    top: '16px',
    left: '16px',
    padding: '8px 12px',
    background: 'rgba(0, 0, 0, 0.7)',
    borderRadius: '4px',
    pointerEvents: 'none',
    fontSize: '12px',
    fontFamily: 'monospace',
};

// -----------------------------------------------------------------------------
// Helper: Random Graph Generator
// -----------------------------------------------------------------------------

/**
 * Simple string hash for deterministic "randomness".
 */
function simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash |= 0; // Convert to 32bit integer
    }
    return Math.abs(hash);
}

// Generate a "Spine-Rib-Fiber" Topology
// This guarantees asymmetry by creating a "Vertebrate" structure.
function generateRandomGraph(nodeCount: number, connectivity: number) {
    const nodes: PhysicsNode[] = [];
    const links: PhysicsLink[] = [];

    // 1. Create all nodes first (Singularity Position)
    for (let i = 0; i < nodeCount; i++) {
        nodes.push({
            id: `n${i}`,
            x: (Math.random() - 0.5) * 1.0,
            y: (Math.random() - 0.5) * 1.0,
            vx: 0, vy: 0, fx: 0, fy: 0,
            mass: 1.0,
            radius: 5.0,
            isFixed: false,
        });
    }

    // 2. Identify Roles
    const spineCount = Math.max(3, Math.min(5, Math.floor(nodeCount * 0.1))); // 3-5 Spine nodes
    const remaining = nodeCount - spineCount;
    // RIB Count: Randomize 60-75%
    const ribRatio = 0.6 + Math.random() * 0.15;
    const ribCount = Math.floor(remaining * ribRatio);
    const fiberCount = remaining - ribCount;

    const spineNodes: number[] = [];
    const ribNodes: number[] = [];
    const fiberNodes: number[] = [];

    let idx = 0;
    for (let i = 0; i < spineCount; i++) spineNodes.push(idx++);
    for (let i = 0; i < ribCount; i++) ribNodes.push(idx++);
    for (let i = 0; i < fiberCount; i++) fiberNodes.push(idx++);

    // 3. Build Spine (The Axis)
    // CROOKED SPINE: Offset from center
    const startOffset = {
        x: (Math.random() - 0.5) * 50,
        y: (Math.random() - 0.5) * 50
    };

    for (let i = 0; i < spineNodes.length; i++) {
        const nIdx = spineNodes[i];
        const node = nodes[nIdx];

        // Offset Initial Position slightly to bias the unfolding
        node.x += startOffset.x;
        node.y += startOffset.y;

        // Physics: Heavy Anchor
        node.mass = 4.0;
        node.radius = 8.0;

        if (i > 0) {
            // Crooked Chain: Occasional branching
            // 20% chance to connect to i-2 instead of i-1 (Branching Y)
            let targetDiff = 1;
            if (i > 1 && Math.random() < 0.2) targetDiff = 2;

            const prevIdx = spineNodes[i - targetDiff];
            links.push({
                source: `n${prevIdx}`,
                target: `n${nIdx}`,
                lengthBias: 0.5, // SHORT
                stiffnessBias: 1.0 // STIFF
            });
        }
    }

    // 4. Build Ribs (The Body)
    // Attach to random spine nodes
    for (const nIdx of ribNodes) {
        const node = nodes[nIdx];

        // Physics: Medium Body
        node.mass = 2.0;
        node.radius = 6.0;

        // Cage (2 links) or Flail (1 link)?
        const isCage = Math.random() < 0.2; // 20% Cage

        // First Link
        const spineTarget = spineNodes[Math.floor(Math.random() * spineNodes.length)];
        links.push({
            source: `n${spineTarget}`,
            target: `n${nIdx}`,
            lengthBias: 1.0, // NORMAL
            stiffnessBias: 0.8 // FIRM
        });

        // Second Link (Cage)
        if (isCage) {
            const spineTarget2 = spineNodes[Math.floor(Math.random() * spineNodes.length)];
            if (spineTarget2 !== spineTarget) {
                links.push({
                    source: `n${spineTarget2}`,
                    target: `n${nIdx}`,
                    lengthBias: 1.0,
                    stiffnessBias: 0.8
                });
            }
        }
    }

    // 5. Build Fibers (The Detail)
    // Attach to random Rib nodes
    for (const nIdx of fiberNodes) {
        const node = nodes[nIdx];

        // Physics: Light Detail
        node.mass = 1.0;
        node.radius = 4.0;

        const ribTarget = ribNodes[Math.floor(Math.random() * ribNodes.length)];
        links.push({
            source: `n${ribTarget}`,
            target: `n${nIdx}`,
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
    const [useVariedSize, setUseVariedSize] = useState(true); // Toggle State
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

    // Ref for Loop Access
    const settingsRef = useRef({ useVariedSize: true });

    useEffect(() => {
        settingsRef.current.useVariedSize = useVariedSize;
    }, [useVariedSize]);

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
            const { nodes, links } = generateRandomGraph(20, 0.05);
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

            // Camera: Center (0,0) at screen center
            ctx.save();
            ctx.translate(width / 2, height / 2);

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
                    ctx.fillStyle = '#ff4444'; // Red if fixed (unused currently but good for debug)
                } else {
                    ctx.fillStyle = '#4488ff'; // Blue default
                }

                // Highlight dragged node
                // (We can't easily access private draggedNodeId, but we know if we are rendering)

                ctx.fill();
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 1; // node.isFixed ? 2 : 1; 
                ctx.stroke();
            });

            ctx.restore();

            // FPS & Stats Calc
            frameCount++;
            const fpsDelta = now - lastFpsTime;

            if (fpsDelta >= 500) { // Update every 500ms
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
                // Avoid divide by zero
                const aspect = (shapeH > 0.1) ? shapeW / shapeH : 1.0;
                // Normalize aspect (always >= 1.0) for easier reading? User wanted raw logs.
                // Let's keep raw W/H ratio. 

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
        const { nodes, links } = generateRandomGraph(spawnCount, 0.05);
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

                {/* Debug Overlay */}
                <div style={DEBUG_OVERLAY_STYLE}>
                    <strong>Time: T+{metrics.lifecycleMs}ms</strong><br />
                    <br />
                    <strong>Performance</strong><br />
                    FPS: {metrics.fps} <br />
                    Nodes: {metrics.nodes} (Active: {metrics.activeNodes}) <br />
                    Links: {metrics.links} <br />
                    Avg Vel: {metrics.avgVel.toFixed(4)} <br />
                    <br />
                    <strong>Shape Diagnostics</strong><br />
                    Spread (R_mean): {metrics.avgDist.toFixed(2)} px <br />
                    Irregularity (R_std): {metrics.stdDist.toFixed(2)} px <br />
                    CV (Std/Mean): {(metrics.avgDist > 0 ? (metrics.stdDist / metrics.avgDist) : 0).toFixed(3)} <br />
                    Aspect Ratio (W/H): {metrics.aspectRatio.toFixed(3)}
                </div>
            </div>

            {/* Sidebar Controls */}
            <div style={SIDEBAR_STYLE}>
                <h3>Physics Playground</h3>

                {/* Actions */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                    <button onClick={handleSpawn}>Spawn New</button>
                    <button onClick={handleReset}>Explode</button>
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
                    if (k === 'repulsionStrength' || k === 'boundaryStrength') {
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
        </div>
    );
};
