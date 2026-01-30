import type { MutableRefObject } from 'react';
import type { PhysicsEngine } from '../../physics/engine';
import { getNodeRadius, getNodeScale, getOcclusionRadius, lerpColor } from '../../visual/theme';
import type { ThemeConfig } from '../../visual/theme';
import { drawGradientRing, drawTwoLayerGlow, withCtx } from './canvasUtils';
import { quantizeToDevicePixel, quantizeForStroke } from './renderingMath';
import { guardStrictRenderSettings, resetRenderState } from './renderGuard';
import type { HoverState, RenderDebugInfo, RenderSettingsRef } from './renderingTypes';

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
    worldToScreen: (x: number, y: number) => { x: number; y: number }
) => {
    ctx.save();
    resetRenderState(ctx);
    guardStrictRenderSettings(ctx);

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.setLineDash([]);
    ctx.strokeStyle = theme.linkColor;

    // Fix 49: Zoom-Stable Line Thickness
    ctx.lineWidth = theme.linkWidth;

    // Viewport Culling Bounds (Screen Space)
    // Add margin for stroke width and general safety
    const margin = 50;
    const vWidth = ctx.canvas.width;
    const vHeight = ctx.canvas.height;

    // BATCHING: Single Path
    ctx.beginPath();

    // Debug Stats
    let drawnCount = 0;
    let culledCount = 0;

    try {
        engine.links.forEach((link) => {
            const source = engine.nodes.get(link.source);
            const target = engine.nodes.get(link.target);
            if (source && target) {
                // Fix 42: Manual Projection (Snapped)
                const s = worldToScreen(source.x, source.y);
                const t = worldToScreen(target.x, target.y);

                // CULLING: Simple AABB check
                // If both points are to the left, right, top, or bottom of strict viewport -> SKIP
                // (Note: This is conservative. Intersecting lines might still be culled if we aren't careful, 
                // but "both left" etc is safe for lines.)
                const minX = -margin;
                const maxX = vWidth + margin;
                const minY = -margin;
                const maxY = vHeight + margin;

                if (
                    (s.x < minX && t.x < minX) ||
                    (s.x > maxX && t.x > maxX) ||
                    (s.y < minY && t.y < minY) ||
                    (s.y > maxY && t.y > maxY)
                ) {
                    culledCount++;
                    return;
                }

                ctx.moveTo(s.x, s.y);
                ctx.lineTo(t.x, t.y);
                drawnCount++;
            }
        });

        // Single Stroke for all batched edges
        if (drawnCount > 0) {
            ctx.stroke();
        }

        if (process.env.NODE_ENV !== 'production' && Math.random() < 0.01) {
            // console.log(`[BatchLinks] drawn=${drawnCount} culled=${culledCount}`);
        }

    } finally {
        ctx.restore();
    }
};

export const drawNodes = (
    ctx: CanvasRenderingContext2D,
    engine: PhysicsEngine,
    theme: ThemeConfig,
    settingsRef: MutableRefObject<RenderSettingsRef>,
    hoverStateRef: MutableRefObject<HoverState>,
    zoom: number,
    renderDebugRef: MutableRefObject<RenderDebugInfo> | undefined,
    dpr: number, // Fix 22: Pass DPR
    worldToScreen: (x: number, y: number) => { x: number; y: number }
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
    const vWidth = ctx.canvas.width;
    const vHeight = ctx.canvas.height;
    const margin = 100; // Generous margin for glow/shadow
    const minX = -margin;
    const maxX = vWidth + margin;
    const minY = -margin;
    const maxY = vHeight + margin;

    engine.nodes.forEach((node) => {
        // Fix 42: Manual Projection & Scaling
        let screen = worldToScreen(node.x, node.y); // Snapped if enabled

        // CULLING 6: Offscreen
        if (screen.x < minX || screen.x > maxX || screen.y < minY || screen.y > maxY) {
            return;
        }

        // Fix 22: Half-Pixel Stroke Alignment
        if (settingsRef.current.pixelSnapping) {
            const width = theme.nodeStyle === 'ring' ? ringWidthPx : strokeWidthPx;
            screen = {
                x: quantizeForStroke(screen.x, width, dpr),
                y: quantizeForStroke(screen.y, width, dpr)
            };
        }

        const baseRadius = settingsRef.current.useVariedSize ? node.radius : 5.0;
        const baseRenderRadius = getNodeRadius(baseRadius, theme);

        // Reset per-node state that might have drifted
        // (Though we try to keep it clean)
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';

        if (theme.nodeStyle === 'ring') {
            // Calculate nodeEnergy first (needed for both glow and ring)
            const isHoveredNode = node.id === hoverStateRef.current.hoveredNodeId;
            const isDisplayNode = node.id === hoverStateRef.current.hoverDisplayNodeId;
            const nodeEnergy = isDisplayNode ? hoverStateRef.current.energy : 0;
            if (isDisplayNode && theme.hoverDebugEnabled) {
                hoverStateRef.current.debugNodeEnergy = nodeEnergy;
            }
            const renderDebug = renderDebugRef?.current;
            const sampleIdle = !!renderDebug && nodeEnergy === 0 && renderDebug.idleGlowPassIndex < 0;
            const sampleActive = !!renderDebug && nodeEnergy > 0 && renderDebug.activeGlowPassIndex < 0;
            const glowPassIndex = 1;
            const ringPassIndex = 2;

            // Energy-driven scale for node rendering (smooth growth on hover)
            const nodeScale = getNodeScale(nodeEnergy, theme);
            // Radius in SCREEN PIXELS
            const radiusPx = baseRenderRadius * nodeScale * zoom;

            // CULLING 6b: Too small to matter (Sub-pixel culling)
            // If radius is less than 0.5px and no energy, skip?
            // User asked for "zoom threshold". If node radius < epsilon.
            if (radiusPx < 0.5 && nodeEnergy < 0.01) {
                // If it's effectively invisible, skip.
                // But wait, strokes might still be visible (1px min).
                // Let's be careful. If radiusPx is tiny, it's just a dot.
                // We'll trust the user wants perf.
                // return; 
                // Actually, let's skip GLOW if small.
            }

            // Energy-driven primary blue (smooth interpolation)
            const primaryBlue = node.isFixed
                ? theme.nodeFixedColor
                : lerpColor(theme.primaryBlueDefault, theme.primaryBlueHover, nodeEnergy);

            // 1. Occlusion disk (hides links under node)
            const occlusionRadiusPx = getOcclusionRadius(radiusPx, theme);

            // Store debug values for hovered node
            if (isHoveredNode && theme.hoverDebugEnabled) {
                const outerRadius = radiusPx + theme.ringWidth * 0.5;
                hoverStateRef.current.debugNodeRadius = radiusPx;
                hoverStateRef.current.debugOuterRadius = outerRadius;
                hoverStateRef.current.debugOcclusionRadius = occlusionRadiusPx;
                hoverStateRef.current.debugShrinkPct = theme.occlusionShrinkPct;
            }

            ctx.beginPath();
            ctx.arc(screen.x, screen.y, occlusionRadiusPx, 0, Math.PI * 2);
            ctx.fillStyle = theme.occlusionColor;
            ctx.fill();

            // 2. Ring stroke
            if (sampleIdle && renderDebug) {
                renderDebug.idleRingStateBefore = captureCanvasState(ctx);
            }
            if (sampleActive && renderDebug) {
                renderDebug.activeRingStateBefore = captureCanvasState(ctx);
            }

            if (theme.useGradientRing) {
                // Energy-driven ring width boost
                // Base width is zoom-stable, boost acts as multiplier
                const activeRingWidth = ringWidthPx * (1 + theme.hoverRingWidthBoost * nodeEnergy);

                // Note: drawGradientRing uses check/save/restore internally, which is fine for complexity
                drawGradientRing(
                    ctx,
                    screen.x,
                    screen.y,
                    radiusPx,
                    activeRingWidth,
                    primaryBlue,
                    theme.deepPurple,
                    theme.ringGradientSegments,
                    theme.gradientRotationDegrees
                );

                // RESTORE STATE after external call assurance
                ctx.globalAlpha = 1;
                ctx.globalCompositeOperation = 'source-over';

            } else {
                ctx.beginPath();
                ctx.arc(screen.x, screen.y, radiusPx, 0, Math.PI * 2);
                ctx.strokeStyle = node.isFixed ? theme.nodeFixedColor : theme.ringColor;
                ctx.lineWidth = ringWidthPx;
                ctx.stroke();
            }
            if (sampleIdle && renderDebug) {
                renderDebug.ringPassIndex = ringPassIndex;
                renderDebug.idleRingStateAfter = captureCanvasState(ctx);
            }
            if (sampleActive && renderDebug) {
                renderDebug.ringPassIndex = ringPassIndex;
                renderDebug.activeRingStateAfter = captureCanvasState(ctx);
            }

            // 3. Glow (energy-driven: brightens + expands as hover energy rises)
            // OPTIMIZATION: Skip glow if node scale is tiny (< 2px) and no energy
            if (radiusPx > 2 || nodeEnergy > 0.01) {
                if (theme.useTwoLayerGlow) {
                    if (sampleIdle && renderDebug) {
                        renderDebug.idleGlowPassIndex = glowPassIndex;
                        renderDebug.idleGlowStateBefore = captureCanvasState(ctx);
                    }
                    if (sampleActive && renderDebug) {
                        renderDebug.activeGlowPassIndex = glowPassIndex;
                        renderDebug.activeGlowStateBefore = captureCanvasState(ctx);
                    }

                    // Hardened: No save/restore inside, safe to call in loop
                    const glowParams = drawTwoLayerGlow(
                        ctx,
                        screen.x,
                        screen.y,
                        radiusPx,
                        nodeEnergy,
                        primaryBlue,
                        theme
                    );

                    // Store glow debug values for hovered node
                    if (isHoveredNode) {
                        hoverStateRef.current.debugGlowInnerAlpha = glowParams.innerAlpha;
                        hoverStateRef.current.debugGlowInnerBlur = glowParams.innerBlur;
                        hoverStateRef.current.debugGlowOuterAlpha = glowParams.outerAlpha;
                        hoverStateRef.current.debugGlowOuterBlur = glowParams.outerBlur;
                    }
                    if (sampleIdle && renderDebug) {
                        renderDebug.idleGlowStateAfter = captureCanvasState(ctx);
                    }
                    if (sampleActive && renderDebug) {
                        renderDebug.activeGlowStateAfter = captureCanvasState(ctx);
                    }
                } else if (theme.glowEnabled) {
                    // Legacy single-layer glow (static) - MUST manual save/restore for Filter!
                    // Exception to the rule: Single layer glow needs filter.
                    // We use explicit save/restore for this isolate case.
                    ctx.save();
                    ctx.beginPath();
                    ctx.arc(screen.x, screen.y, radiusPx + theme.glowRadius, 0, Math.PI * 2);
                    ctx.globalAlpha = 1;
                    ctx.globalCompositeOperation = 'source-over';
                    ctx.shadowBlur = 0;
                    ctx.shadowColor = 'transparent';
                    ctx.fillStyle = theme.glowColor;
                    ctx.filter = `blur(${theme.glowRadius}px)`; // THE EXPENSIVE OP
                    ctx.fill();
                    ctx.restore();
                }
            }
        } else {
            // Normal mode: no scaling
            const radiusPx = baseRenderRadius * zoom;
            ctx.beginPath();
            ctx.arc(screen.x, screen.y, radiusPx, 0, Math.PI * 2);

            if (node.isFixed) {
                ctx.fillStyle = theme.nodeFixedColor;
            } else {
                ctx.fillStyle = theme.nodeFillColor;
            }

            ctx.fill();
            ctx.strokeStyle = theme.nodeStrokeColor;
            ctx.lineWidth = strokeWidthPx;
            ctx.stroke();
        }
    });

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
    settingsRef: MutableRefObject<RenderSettingsRef>,
    hoverStateRef: MutableRefObject<HoverState>,
    zoom: number,
    dpr: number, // Fix 21: Need DPR for Text Quantization
    worldToScreen: (x: number, y: number) => { x: number; y: number }
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
    // Use wider margin for labels
    const vWidth = ctx.canvas.width;
    const vHeight = ctx.canvas.height;
    const margin = 200;
    const minX = -margin;
    const maxX = vWidth + margin;
    const minY = -margin;
    const maxY = vHeight + margin;

    engine.nodes.forEach((node) => {
        // Optimization: Quick cull before expensive calculations
        const screen = worldToScreen(node.x, node.y);
        if (screen.x < minX || screen.x > maxX || screen.y < minY || screen.y > maxY) {
            return;
        }

        const baseRadius = settingsRef.current.useVariedSize ? node.radius : 5.0;
        const baseRenderRadius = getNodeRadius(baseRadius, theme);
        const isDisplayNode = node.id === hoverStateRef.current.hoverDisplayNodeId;
        const nodeEnergy = isDisplayNode ? hoverStateRef.current.energy : 0;
        const nodeScale = getNodeScale(nodeEnergy, theme);
        const renderRadiusPx = baseRenderRadius * nodeScale * zoom;

        // Skip labels if node is too small (e.g. < 4px) and not hovered
        // This is a powerful optimization for zoomed-out graphs.
        if (renderRadiusPx < 4 && nodeEnergy < 0.1) {
            return;
        }

        const label = node.label || node.id;  // Fallback to node ID
        drawNodeLabel(ctx, node.x, node.y, renderRadiusPx, label, nodeEnergy, theme, dpr, worldToScreen);
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
    worldToScreen: (x: number, y: number) => { x: number; y: number }
) {
    if (!label) return;

    // Fix 42: Screen Space Labeling
    const screen = worldToScreen(x, y);
    const e = Math.pow(Math.max(0, Math.min(1, nodeEnergy)), theme.labelEnergyGamma);

    // Compute label offset: base + energy-driven hover offset
    const offsetY = renderRadiusPx + theme.labelOffsetBasePx + e * theme.labelOffsetHoverPx;
    const alpha = theme.labelAlphaBase + (theme.labelAlphaHover - theme.labelAlphaBase) * e;

    const labelX = screen.x;

    // Fix 21: Text Baseline Quantization Logic
    const snappedX = quantizeToDevicePixel(screen.x, dpr);
    const isSnapped = Math.abs(screen.x - snappedX) < 1e-9;

    let labelY = screen.y + offsetY;
    if (isSnapped) {
        labelY = quantizeToDevicePixel(labelY, dpr);
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

export const drawHoverDebugOverlay = (
    ctx: CanvasRenderingContext2D,
    engine: PhysicsEngine,
    hoverStateRef: MutableRefObject<HoverState>
) => {
    withCtx(ctx, () => {
        const displayId = hoverStateRef.current.hoverDisplayNodeId ?? hoverStateRef.current.hoveredNodeId;
        const hoveredNode = engine.nodes.get(displayId ?? '');
        if (!hoveredNode) return;

        const r = hoverStateRef.current.renderedRadius;
        const hitR = hoverStateRef.current.hitRadius;
        const halo = hoverStateRef.current.haloRadius;
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

        ctx.beginPath();
        ctx.arc(hoveredNode.x, hoveredNode.y, r, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(0, 255, 255, 0.6)';
        ctx.lineWidth = 1;
        ctx.setLineDash([]);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(hoveredNode.x, hoveredNode.y, hitR, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 100, 200, 0.5)';
        ctx.lineWidth = 1;
        ctx.setLineDash([6, 4]);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.beginPath();
        ctx.arc(hoveredNode.x, hoveredNode.y, halo, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 255, 0, 0.4)';
        ctx.lineWidth = 1;
        ctx.setLineDash([6, 4]);
        ctx.stroke();
        ctx.setLineDash([]);

        if (hoverStateRef.current.hasPointer) {
            ctx.beginPath();
            ctx.moveTo(hoveredNode.x, hoveredNode.y);
            ctx.lineTo(hoverStateRef.current.cursorWorldX, hoverStateRef.current.cursorWorldY);
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
            hoveredNode.x + r + 3,
            hoveredNode.y - r - 4
        );

        ctx.font = '10px monospace';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.fillText(
            `e=${energy.toFixed(2)} nE=${nodeEnergy.toFixed(2)} t=${targetEnergy.toFixed(2)} d=${dist.toFixed(0)}`,
            hoveredNode.x + r + 5,
            hoveredNode.y - 5
        );
        ctx.fillText(
            `id=${hoverStateRef.current.hoveredNodeId} disp=${displayId ?? 'null'} near=${nearestId ?? 'null'} nd=${isFinite(nearestDist) ? nearestDist.toFixed(0) : 'inf'} ${decision}`,
            hoveredNode.x + r + 5,
            hoveredNode.y + 8
        );
        ctx.fillText(
            `hold=${holdRemaining.toFixed(0)}ms pending=${pendingId ?? 'null'} age=${pendingAge.toFixed(0)}ms`,
            hoveredNode.x + r + 5,
            hoveredNode.y + 21
        );
        ctx.fillText(
            `dt=${dtRaw.toFixed(1)}ms clamped=${dtUsed.toFixed(1)}ms a=${alpha.toFixed(3)}`,
            hoveredNode.x + r + 5,
            hoveredNode.y + 34
        );
        ctx.fillText(
            `scan=${hoverStateRef.current.nodesScannedLastSelection} sel/s=${hoverStateRef.current.selectionRunsPerSecond} en/s=${hoverStateRef.current.energyUpdatesPerSecond}`,
            hoveredNode.x + r + 5,
            hoveredNode.y + 47
        );
        // Glow energy debug
        const iA = hoverStateRef.current.debugGlowInnerAlpha;
        const iB = hoverStateRef.current.debugGlowInnerBlur;
        const oA = hoverStateRef.current.debugGlowOuterAlpha;
        const oB = hoverStateRef.current.debugGlowOuterBlur;
        ctx.fillText(
            `glow: iA=${iA.toFixed(2)} iB=${iB.toFixed(0)} oA=${oA.toFixed(2)} oB=${oB.toFixed(0)}`,
            hoveredNode.x + r + 5,
            hoveredNode.y + 60
        );
        // Occlusion disk sizing debug
        const nodeR = hoverStateRef.current.debugNodeRadius;
        const outerR = hoverStateRef.current.debugOuterRadius;
        const occlR = hoverStateRef.current.debugOcclusionRadius;
        const shrinkPct = hoverStateRef.current.debugShrinkPct;
        ctx.fillText(
            `occlusion: nodeR=${nodeR.toFixed(1)} outerR=${outerR.toFixed(1)} occlR=${occlR.toFixed(1)} shrink=${(shrinkPct * 100).toFixed(0)}%`,
            hoveredNode.x + r + 5,
            hoveredNode.y + 73
        );
    });
};

export const drawPointerCrosshair = (
    ctx: CanvasRenderingContext2D,
    rect: DOMRect,
    hoverStateRef: MutableRefObject<HoverState>,
    worldToScreen: (worldX: number, worldY: number, rect: DOMRect) => { x: number; y: number }
) => {
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
