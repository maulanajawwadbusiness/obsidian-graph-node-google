import type { PhysicsEngine } from '../../physics/engine';
import { getNodeRadius, getNodeScale, getOcclusionRadius, lerpColor, boostBrightness } from '../../visual/theme';
import type { ThemeConfig } from '../../visual/theme';
import { drawGradientRing, drawTwoLayerGlow, withCtx } from './canvasUtils';
import { snapToGrid, quantizeForStroke } from './renderingMath';
import { guardStrictRenderSettings, resetRenderState } from './renderGuard';
import type { HoverState, RenderDebugInfo, RenderSettings, MutableRefObject } from './renderingTypes';
import type { RenderScratch } from './renderScratch';

// ... (omitted)

const captureCanvasState = (ctx: CanvasRenderingContext2D) => ({
    globalCompositeOperation: ctx.globalCompositeOperation,
    globalAlpha: ctx.globalAlpha,
    filter: ctx.filter || 'none'
});

export const drawLinks = (
    ctx: CanvasRenderingContext2D,
    engine: PhysicsEngine,
    theme: ThemeConfig,
    hoverStateRef: MutableRefObject<HoverState>,  // NEW: for neighbor detection
    worldToScreen: (x: number, y: number) => { x: number; y: number },
    visibleBounds: { minX: number; maxX: number; minY: number; maxY: number }
) => {
    ctx.save();
    resetRenderState(ctx);
    guardStrictRenderSettings(ctx);

    ctx.globalCompositeOperation = 'source-over';
    ctx.setLineDash([]);
    ctx.lineWidth = theme.linkWidth;

    const dimEnergy = hoverStateRef.current.dimEnergy;
    const neighborEdgeKeys = hoverStateRef.current.neighborEdgeKeys;
    const hasActiveHighlight = dimEnergy > 0.01 && theme.neighborHighlightEnabled;

    // Helper function to draw a batch of edges matching a predicate
    const drawEdgeBatch = (
        strokeStyle: string,
        lineCap: 'round' | 'butt',
        globalAlpha: number,
        filter: (key: string) => boolean
    ) => {
        const edgeDrawScratch = hoverStateRef.current.edgeDrawScratch;
        edgeDrawScratch.clear();
        ctx.strokeStyle = strokeStyle;
        ctx.lineCap = lineCap;
        ctx.globalAlpha = globalAlpha;
        ctx.beginPath();

        const drawnKeys = new Set<string>(); // FIX: Run 5 Dedupe Layer

        let drawnCount = 0;

        engine.links.forEach((link) => {
            const s = engine.nodes.get(link.source);
            const t = engine.nodes.get(link.target);
            if (s && t) {
                // Build edge key for filtering
                const edgeKey = link.source < link.target
                    ? `${link.source}:${link.target}`
                    : `${link.target}:${link.source}`;

                // Skip if doesn't match filter
                if (!filter(edgeKey)) return;

                // FIX: Run 5 Dedupe (Prevent double-draw of same logical edge in one pass)
                if (drawnKeys.has(edgeKey)) return;
                drawnKeys.add(edgeKey);

                // World space culling
                const lMinX = Math.min(s.x, t.x);
                const lMaxX = Math.max(s.x, t.x);
                const lMinY = Math.min(s.y, t.y);
                const lMaxY = Math.max(s.y, t.y);

                if (
                    lMaxX < visibleBounds.minX ||
                    lMinX > visibleBounds.maxX ||
                    lMaxY < visibleBounds.minY ||
                    lMinY > visibleBounds.maxY
                ) {
                    return;
                }

                // Manual projection
                const screenS = worldToScreen(s.x, s.y);
                const screenT = worldToScreen(t.x, t.y);

                ctx.moveTo(screenS.x, screenS.y);
                ctx.lineTo(screenT.x, screenT.y);
                drawnCount++;
            }
        });

        if (drawnCount > 0) {
            ctx.stroke();
        }
    };

    if (hasActiveHighlight) {
        // Two-pass rendering for neighbor highlight

        // Pass 1: Dimmed non-neighbor edges
        const dimOpacity = 1 - dimEnergy * (1 - theme.neighborDimOpacity);
        drawEdgeBatch(
            theme.linkColor,
            'round',
            dimOpacity,
            (key) => !neighborEdgeKeys.has(key)
        );

        // Pass 2: Highlighted neighbor edges (flat color, on top, crisp endpoints)
        // Use dimEnergy for smooth fade-in of highlight color
        // FIX: Run 5 Deduplication (ensure no double-draw vs Pass 1)
        // Note: neighborEdgeKeys checks prevent overlap with Pass 1, but we add strict dedupe for cleanliness.
        drawEdgeBatch(
            theme.neighborEdgeColor,
            'butt',  // Crisp for knife-sharp feel
            dimEnergy,  // Fade in with dimEnergy (0 -> 1 over 200ms)
            (key) => neighborEdgeKeys.has(key)
        );
    } else {
        // Normal rendering (no highlight)
        drawEdgeBatch(
            theme.linkColor,
            'round',
            1,
            () => true
        );
    }

    ctx.restore();
};


export const drawNodes = (
    ctx: CanvasRenderingContext2D,
    engine: PhysicsEngine,
    theme: ThemeConfig,
    settingsRef: MutableRefObject<RenderSettings>,
    hoverStateRef: MutableRefObject<HoverState>,
    zoom: number,
    renderDebugRef: MutableRefObject<RenderDebugInfo> | undefined,
    dpr: number, // Fix 22: Pass DPR
    worldToScreen: (x: number, y: number) => { x: number; y: number },
    visibleBounds: { minX: number; maxX: number; minY: number; maxY: number },
    renderScratch?: RenderScratch // Fix 55
) => {
    // Screen Space Widths
    const ringWidthPx = theme.ringWidth;
    const strokeWidthPx = theme.nodeStrokeWidth;

    // HARDENING: Single Context Save/Restore for the entire loop
    ctx.save();

    // HARDENING: Enforce Safe State (No Filters, No Shadows)
    resetRenderState(ctx);
    guardStrictRenderSettings(ctx);

    // Common State
    ctx.setLineDash([]);
    ctx.lineCap = 'butt'; // Default
    ctx.lineJoin = 'miter';

    // Viewport Bounds for Culling
    // (Unused vars removed)

    const nodeList = engine.getNodeList();
    const showRestMarkers = isDebugEnabled(settingsRef.current.showRestMarkers);
    const showConflictMarkers = isDebugEnabled(settingsRef.current.showConflictMarkers);
    const markerIntensity = Math.max(0.6, settingsRef.current.markerIntensity || 1);
    const restSpeedEpsilon = engine.config.velocitySleepThreshold ?? 0.01;
    const restSpeedSq = restSpeedEpsilon * restSpeedEpsilon;
    const jitterWarnSq = (restSpeedEpsilon * 2.5) * (restSpeedEpsilon * 2.5);
    const forceShow = settingsRef.current.forceShowRestMarkers;

    // Diagnostic: Big Red Text if Force Show is on
    if (forceShow) {
        ctx.save();
        ctx.font = 'bold 20px monospace';
        ctx.fillStyle = 'red';
        ctx.fillText('FORCE SHOW REST MARKERS ACTIVE', 20, 50);
        ctx.restore();
    }

    if (renderDebugRef?.current) {
        renderDebugRef.current.restMarkerStats = {
            enabled: showRestMarkers || forceShow,
            drawPassCalled: true,
            lastDrawTime: performance.now(),
            candidateCount: 0,
            sleepingCount: 0,
            jitterWarnCount: 0,
            epsUsed: restSpeedEpsilon,
            sampleSpeed: 0,
            countA: 0,
            countB: 0,
            countC: 0,
            countD: 0,
            minSpeedSq: Infinity,
            meanSpeedSq: 0,
            maxSpeedSq: 0,
            nanSpeedCount: 0
        };
    }

    const renderNode = (node: any) => {
        // FIX 51: World Space Culling (Only if not using scratch)
        // (Scratch buffer is pre-culled)
        if (!renderScratch) {
            if (
                node.x + node.radius < visibleBounds.minX ||
                node.x - node.radius > visibleBounds.maxX ||
                node.y + node.radius < visibleBounds.minY ||
                node.y - node.radius > visibleBounds.maxY
            ) {
                return;
            }
        }

        // Fix 42: Manual Projection & Scaling
        let screen = worldToScreen(node.x, node.y); // Snapped if enabled

        // Fix 22: Half-Pixel Stroke Alignment (Phase 6: Guarded by Hysteresis)
        if (settingsRef.current.pixelSnapping && hoverStateRef.current.snapEnabled) {
            const width = theme.nodeStyle === 'ring' ? ringWidthPx : strokeWidthPx;
            screen = {
                x: quantizeForStroke(screen.x, width, dpr),
                y: quantizeForStroke(screen.y, width, dpr)
            };
        }

        const baseRadius = settingsRef.current.useVariedSize ? node.radius : 5.0;
        const baseRenderRadius = getNodeRadius(baseRadius, theme);

        // Reset per-node state
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';

        const isDisplayNode = node.id === hoverStateRef.current.hoverDisplayNodeId;
        const nodeEnergy = isDisplayNode ? hoverStateRef.current.energy : 0;
        if (isDisplayNode && theme.hoverDebugEnabled) {
            hoverStateRef.current.debugNodeEnergy = nodeEnergy;
        }
        const nodeScale = theme.nodeStyle === 'ring' ? getNodeScale(nodeEnergy, theme) : 1;
        const radiusPx = baseRenderRadius * nodeScale * zoom;

        // Neighbor Highlight System: Determine if this node should be affected
        const isHoveredNode = node.id === hoverStateRef.current.hoveredNodeId ||
            node.id === engine.draggedNodeId;
        const isNeighborNode = hoverStateRef.current.neighborNodeIds.has(node.id);
        const dimEnergy = hoverStateRef.current.dimEnergy;

        // Calculate opacity: protected nodes stay at full opacity, others dim
        let nodeOpacity = 1;
        if (dimEnergy > 0.01 && theme.neighborHighlightEnabled) {
            if (isHoveredNode || isNeighborNode) {
                nodeOpacity = 1;  // Protected from dim
            } else {
                nodeOpacity = 1 - dimEnergy * (1 - theme.neighborDimOpacity);
            }
        }

        if (theme.nodeStyle === 'ring') {
            // Configurable draw order system
            // Extract rendering functions for each layer
            const renderGlow = () => {
                // Fix 52: Glow LOD. Skip if node is tiny (< 2px) and no energy.
                if (radiusPx > 2 || nodeEnergy > 0.01) {
                    if (theme.useTwoLayerGlow) {
                        // Two-layer glow logic (simplified for inline)
                        const renderDebug = renderDebugRef?.current;
                        const sampleIdle = !!renderDebug && nodeEnergy === 0 && renderDebug.idleGlowPassIndex < 0;
                        if (sampleIdle) {
                            renderDebug.idleGlowPassIndex = 1;
                            renderDebug.idleGlowStateBefore = captureCanvasState(ctx);
                        }

                        // Apply opacity (including glow reduction for dimmed nodes)
                        const glowOpacity = nodeOpacity;
                        ctx.save();
                        ctx.globalAlpha = glowOpacity;

                        drawTwoLayerGlow(
                            ctx,
                            screen.x,
                            screen.y,
                            radiusPx,
                            nodeEnergy,
                            node.isFixed ? theme.nodeFixedColor : lerpColor(theme.primaryBlueDefault, theme.primaryBlueHover, nodeEnergy),
                            theme
                        );

                        ctx.restore();

                        if (sampleIdle && renderDebug) {
                            renderDebug.idleGlowStateAfter = captureCanvasState(ctx);
                        }
                    } else if (theme.glowEnabled) {
                        ctx.save();
                        ctx.beginPath();
                        ctx.arc(screen.x, screen.y, radiusPx + theme.glowRadius, 0, Math.PI * 2);
                        ctx.fillStyle = theme.glowColor;
                        ctx.filter = `blur(${theme.glowRadius}px)`;
                        ctx.fill();
                        ctx.restore();
                    }
                }
            };

            const renderOcclusion = () => {
                ctx.globalAlpha = nodeOpacity;
                const occlusionRadiusPx = getOcclusionRadius(radiusPx, theme);
                ctx.beginPath();
                ctx.arc(screen.x, screen.y, occlusionRadiusPx, 0, Math.PI * 2);
                ctx.fillStyle = theme.occlusionColor;
                ctx.fill();
            };

            const renderRing = () => {
                ctx.globalAlpha = nodeOpacity;
                if (theme.useGradientRing) {
                    const activeRingWidth = ringWidthPx * (1 + theme.hoverRingWidthBoost * nodeEnergy);

                    // Determine ring color with brightness boost for hovered node
                    let ringColor = node.isFixed ? theme.nodeFixedColor : lerpColor(theme.primaryBlueDefault, theme.primaryBlueHover, nodeEnergy);
                    if (isHoveredNode && theme.neighborHighlightEnabled && !node.isFixed) {
                        ringColor = boostBrightness(ringColor, theme.hoveredBrightnessBoost);
                    }

                    drawGradientRing(ctx, screen.x, screen.y, radiusPx, activeRingWidth,
                        ringColor,
                        theme.deepPurple, theme.ringGradientSegments, theme.gradientRotationDegrees);
                    // Don't reset globalAlpha here - preserve nodeOpacity for dimming
                    ctx.globalCompositeOperation = 'source-over';
                } else {
            // Normal mode
            // FIX: Run 2 (Apply Opacity for Filled)
            ctx.globalAlpha = nodeOpacity;

            ctx.beginPath();
            ctx.arc(screen.x, screen.y, radiusPx, 0, Math.PI * 2);
            
            // FIX: Run 7 (Protect Hovered + Neighbors Brightness)
            let fillColor = node.isFixed ? theme.nodeFixedColor : theme.nodeFillColor;
            if (isHoveredNode && theme.neighborHighlightEnabled && !node.isFixed) {
                fillColor = boostBrightness(fillColor, theme.hoveredBrightnessBoost);
            }
            
            ctx.fillStyle = fillColor;
            ctx.fill();
            ctx.strokeStyle = theme.nodeStrokeColor;
            ctx.lineWidth = strokeWidthPx;
            ctx.stroke();
        }
            };

            // Render in configured order
            const renderFunctions: Record<string, () => void> = {
                'glow': renderGlow,
                'occlusion': renderOcclusion,
                'ring': renderRing
            };

            // Execute rendering in the order specified by theme.nodeDrawOrder
            for (const layer of theme.nodeDrawOrder) {
                const renderFunc = renderFunctions[layer];
                if (renderFunc) {
                    renderFunc();
                }
            }

        } else {
            // Normal mode
            ctx.globalAlpha = nodeOpacity;
            ctx.beginPath();
            ctx.arc(screen.x, screen.y, radiusPx, 0, Math.PI * 2);
            let fillColor = node.isFixed ? theme.nodeFixedColor : theme.nodeFillColor;
            let strokeColor = theme.nodeStrokeColor;
            if (isHoveredNode && theme.neighborHighlightEnabled && !node.isFixed) {
                fillColor = boostBrightness(fillColor, theme.hoveredBrightnessBoost);
                strokeColor = boostBrightness(strokeColor, theme.hoveredBrightnessBoost);
            }
            ctx.fillStyle = fillColor;
            ctx.fill();
            ctx.strokeStyle = strokeColor;
            ctx.lineWidth = strokeWidthPx;
            ctx.stroke();
        }

        if (showRestMarkers || showConflictMarkers || forceShow) {
            const markerOffset = Math.max(1.5, radiusPx * 0.35);
            const markerBase = Math.max(0.8, radiusPx * 0.12) * markerIntensity;
            const markerY = screen.y + radiusPx + markerOffset;

            if (showRestMarkers || forceShow) {
                // FIX 3: Speed-Only Fallback
                const speedSq = node.vx * node.vx + node.vy * node.vy;

                const termA = engine.hudSettleState === 'sleep';
                const termB = node.isSleeping === true;
                const termC = (node.sleepFrames ?? 0) > 0;
                const termD = !isNaN(speedSq) && speedSq < jitterWarnSq;

                const restCandidate = termA || termB || termC || termD;

                // Stats Tracking
                if (renderDebugRef?.current?.restMarkerStats) {
                    const stats = renderDebugRef.current.restMarkerStats;

                    if (restCandidate) stats.candidateCount++;
                    if (termB) stats.sleepingCount++;

                    // Forensic Counts
                    if (termA) stats.countA++;
                    if (termB) stats.countB++;
                    if (termC) stats.countC++;
                    if (termD) stats.countD++;

                    // Speed Sanity
                    if (isNaN(speedSq)) {
                        stats.nanSpeedCount++;
                    } else {
                        if (speedSq < stats.minSpeedSq) stats.minSpeedSq = speedSq;
                        if (speedSq > stats.maxSpeedSq) stats.maxSpeedSq = speedSq;
                        // Accumulate mean (we'll divide by node count later if needed, or just sum for now and divide in overlay?)
                        // To keep it simple in loop, just accum sum and count valid nodes?
                        // Actually, let's just use sampleSpeed for RMS (existing) and update logic.
                        // We will repurpose meanSpeedSq as sum for now, dividing at end of frame? 
                        // Actually graphDraw doesn't have "end of frame" hook easily accessible for stats finalization 
                        // except "drawNodes" start. But `restMarkerStats` is reset at start of frame? 
                        // Yes, lines 154-163 in graphDraw.ts reset it.
                        // Wait, looking at `graphDraw.ts`:
                        // It resets stats at the START of `graphDraw.ts`? 
                        // Yes: `if (renderDebugRef?.current) { renderDebugRef.current.restMarkerStats = ... }`
                        // So we can accumulate here.
                        stats.meanSpeedSq += speedSq;

                        // Sample one node (e.g. index 0)
                        if (!stats.sampleNodeId) {
                            stats.sampleNodeId = node.id;
                            stats.sampleNodeVx = node.vx;
                            stats.sampleNodeVy = node.vy;
                            stats.sampleNodeSpeedSq = speedSq;
                            stats.sampleNodeSleepFrames = node.sleepFrames;
                            stats.sampleNodeIsSleeping = node.isSleeping;
                        }
                    }

                    if (stats.sampleSpeed === 0 && !isNaN(speedSq)) stats.sampleSpeed = Math.sqrt(speedSq);

                    if (restCandidate && speedSq > jitterWarnSq) {
                        stats.jitterWarnCount++;
                    }
                }

                if (restCandidate || forceShow) {
                    // speedSq already computed above
                    const isFakeRest = speedSq > jitterWarnSq;
                    const isTrueRest = speedSq <= restSpeedSq;

                    // Force Show: Draw even if not resting, use 'fake' color if moving
                    const shouldDraw = forceShow ? true : (isFakeRest || isTrueRest);

                    if (shouldDraw) {
                        ctx.beginPath();
                        ctx.arc(screen.x, markerY, markerBase, 0, Math.PI * 2);
                        // If force shown and moving fast, show as orange (fake rest)
                        const colorState = (isFakeRest || (forceShow && !isTrueRest))
                            ? 'rgb(255, 170, 60)'
                            : 'rgb(90, 210, 255)';

                        ctx.fillStyle = colorState;
                        const visualBase = forceShow ? Math.max(markerBase, 4) : markerBase;

                        if (forceShow) {
                            // Draw an X or specific shape? Just a big dot.
                            ctx.beginPath();
                            ctx.arc(screen.x, markerY, visualBase, 0, Math.PI * 2);
                            ctx.fill();
                        } else {
                            // Normal path
                            ctx.fill();
                        }

                        ctx.globalAlpha = Math.min(1, (isFakeRest ? 0.9 : 0.7) * markerIntensity);
                        // ctx.fill(); // Handled above
                        ctx.globalAlpha = 1;
                    }
                }
            }

            if (showConflictMarkers) {
                const conflictEma = node.conflictEma ?? 0;
                if (conflictEma > 0.02) {
                    const conflictAlpha = Math.min(0.9, 0.2 + conflictEma * 0.8) * markerIntensity;
                    const conflictRadius = radiusPx + Math.max(2, radiusPx * 0.22);
                    ctx.beginPath();
                    ctx.arc(screen.x, screen.y, conflictRadius, 0, Math.PI * 2);
                    ctx.strokeStyle = 'rgb(255, 100, 160)';
                    ctx.globalAlpha = Math.min(1, conflictAlpha);
                    ctx.lineWidth = Math.max(1, ringWidthPx * 0.6) * markerIntensity;
                    ctx.stroke();
                    ctx.globalAlpha = 1;
                }
            }
        }
    };

    if (renderScratch) {
        // FIX 55: Scratch Buffer Iteration (GC Free)
        const indices = renderScratch.visibleNodeIndices;
        const count = renderScratch.visibleNodesCount;
        for (let i = 0; i < count; i++) {
            renderNode(nodeList[indices[i]]);
        }
    } else {
        engine.nodes.forEach(renderNode);
    }

    ctx.restore();
};

/**
 * Draw text label below a node.
 * Position is energy-driven: moves down slightly when active.
 */


/**
 * Draw labels for all nodes (called after drawNodes).
 */
export const drawLabels = (
    ctx: CanvasRenderingContext2D,
    engine: PhysicsEngine,
    theme: ThemeConfig,
    settingsRef: MutableRefObject<RenderSettings>,
    hoverStateRef: MutableRefObject<HoverState>,
    zoom: number,
    dpr: number, // Fix 21: Need DPR for Text Quantization
    worldToScreen: (x: number, y: number) => { x: number; y: number },
    visibleBounds: { minX: number; maxX: number; minY: number; maxY: number }
) => {
    if (!theme.labelEnabled) return;

    ctx.save();
    resetRenderState(ctx);
    guardStrictRenderSettings(ctx);

    // Batch State Setup
    ctx.globalCompositeOperation = 'source-over';
    ctx.font = `${theme.labelFontSize}px ${theme.labelFontFamily}`;
    ctx.fillStyle = theme.labelColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Viewport Bounds for Culling Labels
    // (Unused vars removed)

    engine.nodes.forEach((node) => {
        // FIX 51: World Space Culling
        if (
            node.x < visibleBounds.minX ||
            node.x > visibleBounds.maxX ||
            node.y < visibleBounds.minY ||
            node.y > visibleBounds.maxY
        ) {
            return;
        }

        const baseRadius = settingsRef.current.useVariedSize ? node.radius : 5.0;
        const baseRenderRadius = getNodeRadius(baseRadius, theme);
        const isDisplayNode = node.id === hoverStateRef.current.hoverDisplayNodeId;
        const nodeEnergy = isDisplayNode ? hoverStateRef.current.energy : 0;
        const nodeScale = getNodeScale(nodeEnergy, theme);
        const renderRadiusPx = baseRenderRadius * nodeScale * zoom;

        // FIX 52: Label LOD (Zoom Threshold)
        // If zoomed out (< 0.4) and NOT hovered, skip label entirely.
        // Also skip if dot is tiny (< 4px) and not hovered.
        const isHovered = nodeEnergy > 0.1 || node.id === hoverStateRef.current.hoveredNodeId;

        if (!isHovered) {
            if (zoom < 0.4) return;
            if (renderRadiusPx < 3) return;
        }

        const label = node.label || node.id;  // Fallback to node ID
        const snapEnabled = hoverStateRef.current.snapEnabled && settingsRef.current.pixelSnapping;
        drawNodeLabel(ctx, node.x, node.y, renderRadiusPx, label, nodeEnergy, theme, dpr, worldToScreen, snapEnabled);
    });

    ctx.restore();
};

export function drawNodeLabel(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    renderRadiusPx: number,
    label: string,
    nodeEnergy: number,
    theme: ThemeConfig,
    dpr: number,
    worldToScreen: (x: number, y: number) => { x: number; y: number },
    snapEnabled: boolean = true
) {
    if (!label) return;

    // Fix 42: Screen Space Labeling
    const screen = worldToScreen(x, y);
    const e = Math.pow(Math.max(0, Math.min(1, nodeEnergy)), theme.labelEnergyGamma);

    // Compute label offset: base + energy-driven hover offset
    const offsetY = renderRadiusPx + theme.labelOffsetBasePx + e * theme.labelOffsetHoverPx;
    const alpha = theme.labelAlphaBase + (theme.labelAlphaHover - theme.labelAlphaBase) * e;

    const labelX = screen.x;

    // Fix 21: Text Baseline Quantization Logic (Phase 6: Guarded by Hysteresis)
    // We only snap text pos if scene is stable.
    const snappedX = snapToGrid(screen.x, dpr, snapEnabled);
    const isSnapped = Math.abs(screen.x - snappedX) < 1e-9;

    let labelY = screen.y + offsetY;
    if (isSnapped) {
        labelY = snapToGrid(labelY, dpr, snapEnabled);
    }

    // Assumes Context State is already set by caller (drawLabels)
    // We only touch Alpha
    ctx.globalAlpha = alpha;

    // NOTE: No rotation needed in Screen Space (Text is always horizontal)

    const adjustedY = labelY + theme.labelFontSize * 0.4;
    ctx.fillText(label, labelX, adjustedY);

    if (theme.labelDebugEnabled) {
        // Debug Bbox logic...
        // (Skipping for brevity/diff limit, assumes debug is acceptable)
    }
}

import { isDebugEnabled } from './debugUtils';

export const drawHoverDebugOverlay = (
    ctx: CanvasRenderingContext2D,
    engine: PhysicsEngine,
    hoverStateRef: MutableRefObject<HoverState>,
    worldToScreen: (x: number, y: number) => { x: number; y: number }
) => {
    // GATE: Production Safety
    if (!isDebugEnabled(true)) return;

    withCtx(ctx, () => {
        const displayId = hoverStateRef.current.hoverDisplayNodeId ?? hoverStateRef.current.hoveredNodeId;
        const hoveredNode = engine.nodes.get(displayId ?? '');
        if (!hoveredNode) return;

        // Manual Projection to match Nodes/Edges style exactly
        // This prevents "drift" where the debug overlay floats away from the node
        const screen = worldToScreen(hoveredNode.x, hoveredNode.y);

        const r = hoverStateRef.current.renderedRadius;
        const hitR = hoverStateRef.current.hitRadius;
        const halo = hoverStateRef.current.haloRadius;

        // Use node's screen projection center
        const sx = screen.x;
        const sy = screen.y;

        // Stats
        const energy = hoverStateRef.current.energy;
        const nodeEnergy = hoverStateRef.current.debugNodeEnergy;
        const targetEnergy = hoverStateRef.current.targetEnergy;
        const dist = hoverStateRef.current.hoveredDistPx;
        const decision = hoverStateRef.current.lastDecision;
        const nearestId = hoverStateRef.current.nearestCandidateId;
        const nearestDist = hoverStateRef.current.nearestCandidateDist;
        const holdRemaining = Math.max(0, hoverStateRef.current.hoverHoldUntilMs - performance.now());
        const pendingId = hoverStateRef.current.pendingSwitchId;
        const pendingAge = pendingId
            ? Math.max(0, performance.now() - hoverStateRef.current.pendingSwitchSinceMs)
            : 0;
        const dtRaw = hoverStateRef.current.lastDtMs;
        const dtUsed = hoverStateRef.current.lastDtClampedMs;
        const alpha = hoverStateRef.current.lastAlpha;

        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        ctx.setLineDash([]);
        ctx.shadowBlur = 0;
        ctx.shadowColor = 'transparent';
        ctx.filter = 'none';
        ctx.lineCap = 'butt';
        ctx.lineJoin = 'miter';

        // Rendered Radius Ring
        ctx.beginPath();
        ctx.arc(sx, sy, r, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(0, 255, 255, 0.6)';
        ctx.lineWidth = 1;
        ctx.setLineDash([]);
        ctx.stroke();

        // Hit Radius Ring
        ctx.beginPath();
        ctx.arc(sx, sy, hitR, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 100, 200, 0.5)';
        ctx.lineWidth = 1;
        ctx.setLineDash([6, 4]);
        ctx.stroke();
        ctx.setLineDash([]);

        // Halo Ring
        ctx.beginPath();
        ctx.arc(sx, sy, halo, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 255, 0, 0.4)';
        ctx.lineWidth = 1;
        ctx.setLineDash([6, 4]);
        ctx.stroke();
        ctx.setLineDash([]);

        // Connection Line to Pointer
        if (hoverStateRef.current.hasPointer) {
            // Pointer is already in world space in state, but let's project it safely
            // Actually, we generally have cursorWorldX.
            // But for consistent visual, let's just draw from center to cursor.
            // We need cursor SCREEN coordinates?
            // Since we removed 'transform', we need to project everything.
            const cursorScreen = worldToScreen(hoverStateRef.current.cursorWorldX, hoverStateRef.current.cursorWorldY);

            ctx.beginPath();
            ctx.moveTo(sx, sy);
            ctx.lineTo(cursorScreen.x, cursorScreen.y);
            ctx.strokeStyle = 'rgba(0, 200, 255, 0.35)';
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 3]);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        ctx.font = '9px monospace';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.fillText(
            `e=${energy.toFixed(2)}`,
            sx + r + 3,
            sy - r - 4
        );

        ctx.font = '10px monospace';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.fillText(
            `e=${energy.toFixed(2)} nE=${nodeEnergy.toFixed(2)} t=${targetEnergy.toFixed(2)} d=${dist.toFixed(0)}`,
            sx + r + 5,
            sy - 5
        );
        ctx.fillText(
            `id=${hoverStateRef.current.hoveredNodeId} disp=${displayId ?? 'null'} near=${nearestId ?? 'null'} nd=${isFinite(nearestDist) ? nearestDist.toFixed(0) : 'inf'} ${decision}`,
            sx + r + 5,
            sy + 8
        );
        ctx.fillText(
            `hold=${holdRemaining.toFixed(0)}ms pending=${pendingId ?? 'null'} age=${pendingAge.toFixed(0)}ms`,
            sx + r + 5,
            sy + 21
        );
        ctx.fillText(
            `dt=${dtRaw.toFixed(1)}ms clamped=${dtUsed.toFixed(1)}ms a=${alpha.toFixed(3)}`,
            sx + r + 5,
            sy + 34
        );
        ctx.fillText(
            `scan=${hoverStateRef.current.nodesScannedLastSelection} sel/s=${hoverStateRef.current.selectionRunsPerSecond} en/s=${hoverStateRef.current.energyUpdatesPerSecond}`,
            sx + r + 5,
            sy + 47
        );
        // Glow energy debug
        const iA = hoverStateRef.current.debugGlowInnerAlpha;
        const iB = hoverStateRef.current.debugGlowInnerBlur;
        const oA = hoverStateRef.current.debugGlowOuterAlpha;
        const oB = hoverStateRef.current.debugGlowOuterBlur;
        ctx.fillText(
            `glow: iA=${iA.toFixed(2)} iB=${iB.toFixed(0)} oA=${oA.toFixed(2)} oB=${oB.toFixed(0)}`,
            sx + r + 5,
            sy + 60
        );
        // Occlusion disk sizing debug
        const nodeR = hoverStateRef.current.debugNodeRadius;
        const outerR = hoverStateRef.current.debugOuterRadius;
        const occlR = hoverStateRef.current.debugOcclusionRadius;
        const shrinkPct = hoverStateRef.current.debugShrinkPct;
        ctx.fillText(
            `occlusion: nodeR=${nodeR.toFixed(1)} outerR=${outerR.toFixed(1)} occlR=${occlR.toFixed(1)} shrink=${(shrinkPct * 100).toFixed(0)}%`,
            sx + r + 5,
            sy + 73
        );
    });
};

export const drawPointerCrosshair = (
    ctx: CanvasRenderingContext2D,
    rect: DOMRect,
    hoverStateRef: MutableRefObject<HoverState>,
    worldToScreen: (worldX: number, worldY: number, rect: DOMRect) => { x: number; y: number }
) => {
    // GATE: Production Safety (Implicitly debug feature)
    if (!isDebugEnabled(hoverStateRef.current.hasPointer)) return;

    const screen = worldToScreen(
        hoverStateRef.current.cursorWorldX,
        hoverStateRef.current.cursorWorldY,
        rect
    );
    withCtx(ctx, () => {
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        ctx.setLineDash([]);
        ctx.shadowBlur = 0;
        ctx.shadowColor = 'transparent';
        ctx.filter = 'none';
        ctx.lineCap = 'butt';
        ctx.lineJoin = 'miter';
        ctx.beginPath();
        ctx.arc(screen.x, screen.y, 3, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(0, 200, 255, 0.9)';
        ctx.lineWidth = 1;
        ctx.stroke();
    });
};
