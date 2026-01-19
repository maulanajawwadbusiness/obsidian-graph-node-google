import type { MutableRefObject } from 'react';
import type { PhysicsEngine } from '../../physics/engine';
import { getNodeRadius, getNodeScale, getOcclusionRadius, lerpColor } from '../../visual/theme';
import type { ThemeConfig } from '../../visual/theme';
import { drawGradientRing, drawTwoLayerGlow, withCtx } from './canvasUtils';
import type { HoverState, RenderSettingsRef } from './renderingTypes';

export const drawLinks = (
    ctx: CanvasRenderingContext2D,
    engine: PhysicsEngine,
    theme: ThemeConfig
) => {
    withCtx(ctx, () => {
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        ctx.setLineDash([]);
        ctx.shadowBlur = 0;
        ctx.shadowColor = 'transparent';
        ctx.filter = 'none';
        ctx.strokeStyle = theme.linkColor;
        ctx.lineWidth = theme.linkWidth;
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
    });
};

export const drawNodes = (
    ctx: CanvasRenderingContext2D,
    engine: PhysicsEngine,
    theme: ThemeConfig,
    settingsRef: MutableRefObject<RenderSettingsRef>,
    hoverStateRef: MutableRefObject<HoverState>
) => {
    engine.nodes.forEach((node) => {
        withCtx(ctx, () => {
            const baseRadius = settingsRef.current.useVariedSize ? node.radius : 5.0;
            const baseRenderRadius = getNodeRadius(baseRadius, theme);
            ctx.globalAlpha = 1;
            ctx.globalCompositeOperation = 'source-over';
            ctx.setLineDash([]);
            ctx.shadowBlur = 0;
            ctx.shadowColor = 'transparent';
            ctx.filter = 'none';

            if (theme.nodeStyle === 'ring') {
                // Calculate nodeEnergy first (needed for both glow and ring)
                const isHoveredNode = node.id === hoverStateRef.current.hoveredNodeId;
                const isDisplayNode = node.id === hoverStateRef.current.hoverDisplayNodeId;
                const nodeEnergy = isDisplayNode ? hoverStateRef.current.energy : 0;
                if (isDisplayNode && theme.hoverDebugEnabled) {
                    hoverStateRef.current.debugNodeEnergy = nodeEnergy;
                }

                // Energy-driven scale for node rendering (smooth growth on hover)
                const nodeScale = getNodeScale(nodeEnergy, theme);
                const radius = baseRenderRadius * nodeScale;

                // Energy-driven primary blue (smooth interpolation)
                const primaryBlue = node.isFixed
                    ? theme.nodeFixedColor
                    : lerpColor(theme.primaryBlueDefault, theme.primaryBlueHover, nodeEnergy);

                // 1. Occlusion disk (hides links under node)
                const occlusionRadius = getOcclusionRadius(radius, theme);
                ctx.beginPath();
                ctx.arc(node.x, node.y, occlusionRadius, 0, Math.PI * 2);
                ctx.fillStyle = theme.occlusionColor;
                ctx.fill();

                // 2. Glow (energy-driven: brightens + expands as hover energy rises)
                if (theme.useTwoLayerGlow) {
                    const glowParams = drawTwoLayerGlow(
                        ctx,
                        node.x,
                        node.y,
                        radius,
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
                } else if (theme.glowEnabled) {
                    // Legacy single-layer glow (static)
                    withCtx(ctx, () => {
                        ctx.beginPath();
                        ctx.arc(node.x, node.y, radius + theme.glowRadius, 0, Math.PI * 2);
                        ctx.globalAlpha = 1;
                        ctx.globalCompositeOperation = 'source-over';
                        ctx.shadowBlur = 0;
                        ctx.shadowColor = 'transparent';
                        ctx.fillStyle = theme.glowColor;
                        ctx.filter = `blur(${theme.glowRadius}px)`;
                        ctx.fill();
                    });
                }

                // 3. Ring stroke
                if (theme.useGradientRing) {
                    // Energy-driven ring width boost
                    const ringWidth = theme.ringWidth * (1 + theme.hoverRingWidthBoost * nodeEnergy);

                    drawGradientRing(
                        ctx,
                        node.x,
                        node.y,
                        radius,
                        ringWidth,
                        primaryBlue,
                        theme.deepPurple,
                        theme.ringGradientSegments,
                        theme.gradientRotationDegrees
                    );
                } else {
                    ctx.beginPath();
                    ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
                    ctx.strokeStyle = node.isFixed ? theme.nodeFixedColor : theme.ringColor;
                    ctx.lineWidth = theme.ringWidth;
                    ctx.stroke();
                }
            } else {
                // Normal mode: no scaling
                const radius = baseRenderRadius;
                ctx.beginPath();
                ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);

                if (node.isFixed) {
                    ctx.fillStyle = theme.nodeFixedColor;
                } else {
                    ctx.fillStyle = theme.nodeFillColor;
                }

                ctx.fill();
                ctx.strokeStyle = theme.nodeStrokeColor;
                ctx.lineWidth = theme.nodeStrokeWidth;
                ctx.stroke();
            }
        });
    });
};

/**
 * Draw text label below a node.
 * Position is energy-driven: moves down slightly when active.
 */
export function drawNodeLabel(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    renderRadius: number,
    label: string,
    nodeEnergy: number,
    theme: ThemeConfig
) {
    if (!theme.labelEnabled || !label) return;

    const e = Math.pow(Math.max(0, Math.min(1, nodeEnergy)), theme.labelEnergyGamma);

    // Compute label offset: base + energy-driven hover offset
    const offsetY = renderRadius + theme.labelOffsetBasePx + e * theme.labelOffsetHoverPx;

    // Compute alpha: interpolate from base to hover
    const alpha = theme.labelAlphaBase + (theme.labelAlphaHover - theme.labelAlphaBase) * e;

    const labelX = x;
    const labelY = y + offsetY;

    withCtx(ctx, () => {
        ctx.globalAlpha = alpha;
        ctx.globalCompositeOperation = 'source-over';
        ctx.font = `${theme.labelFontSize}px ${theme.labelFontFamily}`;
        ctx.fillStyle = theme.labelColor;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';

        // Counter-rotate to force horizontal text (cancels camera rotation)
        if (theme.labelForceHorizontal && globalAngle !== 0) {
            ctx.translate(labelX, labelY);
            ctx.rotate(-globalAngle);
            ctx.translate(-labelX, -labelY);
        }

        ctx.fillText(label, labelX, labelY);

        // Debug: show rotation angle being canceled
        if (theme.labelDebugEnabled && theme.labelForceHorizontal && globalAngle !== 0) {
            ctx.fillStyle = ''rgba(100, 200, 255, 0.9)'';
            ctx.font = ''8px monospace'';
            ctx.fillText("rot: ${(globalAngle * 180 / Math.PI).toFixed(1)}", labelX, labelY + theme.labelFontSize + 2);
        }

        // Debug: draw anchor cross + bbox estimate
        if (theme.labelDebugEnabled) {
            const metrics = ctx.measureText(label);
            const textWidth = metrics.width;
            const textHeight = theme.labelFontSize;

            // Anchor cross
            ctx.strokeStyle = 'rgba(255, 100, 100, 0.8)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(labelX - 4, labelY);
            ctx.lineTo(labelX + 4, labelY);
            ctx.moveTo(labelX, labelY - 4);
            ctx.lineTo(labelX, labelY + 4);
            ctx.stroke();

            // Bounding box
            ctx.strokeStyle = 'rgba(100, 255, 100, 0.5)';
            ctx.setLineDash([2, 2]);
            ctx.strokeRect(labelX - textWidth / 2, labelY, textWidth, textHeight);
            ctx.setLineDash([]);
        }
    });
}

/**
 * Draw labels for all nodes (called after drawNodes).
 */
export const drawLabels = (
    ctx: CanvasRenderingContext2D,
    engine: PhysicsEngine,
    theme: ThemeConfig,
    settingsRef: MutableRefObject<RenderSettingsRef>,
    hoverStateRef: MutableRefObject<HoverState>,
    globalAngle: number  // Camera rotation angle to counter-rotate
) => {
    if (!theme.labelEnabled) return;

    engine.nodes.forEach((node) => {
        const baseRadius = settingsRef.current.useVariedSize ? node.radius : 5.0;
        const baseRenderRadius = getNodeRadius(baseRadius, theme);
        const isDisplayNode = node.id === hoverStateRef.current.hoverDisplayNodeId;
        const nodeEnergy = isDisplayNode ? hoverStateRef.current.energy : 0;
        const nodeScale = getNodeScale(nodeEnergy, theme);
        const renderRadius = baseRenderRadius * nodeScale;

        const label = node.label || node.id;  // Fallback to node ID

        drawNodeLabel(ctx, node.x, node.y, renderRadius, label, nodeEnergy, theme, globalAngle);
    });
};

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
