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

// Generate a random graph
function generateRandomGraph(nodeCount: number, connectivity: number) {
    const nodes: PhysicsNode[] = [];
    const links: PhysicsLink[] = [];

    for (let i = 0; i < nodeCount; i++) {
        nodes.push({
            id: `n${i}`,
            // SINGULARITY START: No geometric shape. Just pressure.
            x: (Math.random() - 0.5) * 1.0,
            y: (Math.random() - 0.5) * 1.0,
            vx: 0,
            vy: 0,
            fx: 0,
            fy: 0,
            mass: 1, // uniform mass for now
            radius: 5.0, // Fixed size as requested
            isFixed: false,
        });
    }

    // Connect them randomly but deterministically biased
    for (let i = 0; i < nodeCount; i++) {
        for (let j = i + 1; j < nodeCount; j++) {
            if (Math.random() < connectivity) {
                const source = `n${i}`;
                const target = `n${j}`;

                // Deterministic bias based on link identity
                const hash = simpleHash(source + target);
                // Map hash to 0.7 - 1.3 range (approx +/- 30%)
                const normalized = (hash % 1000) / 1000; // 0.0 - 1.0
                const bias = 0.7 + (normalized * 0.6);

                links.push({
                    source,
                    target,
                    lengthBias: bias,
                    stiffnessBias: 1.0 // varied length is usually enough for "organic" look
                });
            }
        }
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

        const render = (time: number) => {
            // 1. Calc Delta Time
            // Cap dt to avoid explosion if tab becomes inactive
            const dtMs = time - lastTime;
            const dt = Math.min(dtMs / 1000, 0.1);
            lastTime = time;

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
            ctx.strokeStyle = '#555';
            ctx.lineWidth = 1;
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
                ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);

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
            if (time - lastFpsTime >= 500) { // Update every 500ms
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

                const width = maxX - minX;
                const height = maxY - minY;
                // Avoid divide by zero
                const aspect = (height > 0.1) ? width / height : 1.0;
                // Normalize aspect (always >= 1.0) for easier reading? User wanted raw logs.
                // Let's keep raw W/H ratio. 

                setMetrics({
                    nodes: engine.nodes.size,
                    links: engine.links.length,
                    fps: Math.round((frameCount * 1000) / (time - lastFpsTime)),
                    avgVel: avgVel,
                    activeNodes: activeNodes,
                    avgDist,
                    stdDist,
                    aspectRatio: aspect,
                    lifecycleMs: Math.round(engine.lifecycle * 1000)
                });

                frameCount = 0;
                lastFpsTime = time;
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
