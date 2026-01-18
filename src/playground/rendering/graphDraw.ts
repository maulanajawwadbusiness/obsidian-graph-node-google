import type { MutableRefObject } from 'react';
import type { PhysicsEngine } from '../../physics/engine';
import { getNodeRadius, getOcclusionRadius, lerpColor } from '../../visual/theme';
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
            const radius = getNodeRadius(baseRadius, theme);
            ctx.globalAlpha = 1;
            ctx.globalCompositeOperation = 'source-over';
            ctx.setLineDash([]);
            ctx.shadowBlur = 0;
            ctx.shadowColor = 'transparent';
            ctx.filter = 'none';

            if (theme.nodeStyle === 'ring') {
                const occlusionRadius = getOcclusionRadius(radius, theme);
                ctx.beginPath();
                ctx.arc(node.x, node.y, occlusionRadius, 0, Math.PI * 2);
                ctx.fillStyle = theme.occlusionColor;
                ctx.fill();

                if (theme.useTwoLayerGlow) {
                    drawTwoLayerGlow(ctx, node.x, node.y, radius, theme);
                } else if (theme.glowEnabled) {
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

                if (theme.useGradientRing) {
                    const isHoveredNode = node.id === hoverStateRef.current.hoveredNodeId;
                    const nodeEnergy = isHoveredNode ? hoverStateRef.current.energy : 0;

                    const primaryBlue = node.isFixed
                        ? theme.nodeFixedColor
                        : lerpColor(theme.primaryBlueDefault, theme.primaryBlueHover, nodeEnergy);

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

export const drawHoverDebugOverlay = (
    ctx: CanvasRenderingContext2D,
    engine: PhysicsEngine,
    hoverStateRef: MutableRefObject<HoverState>
) => {
    withCtx(ctx, () => {
        const hoveredNode = engine.nodes.get(hoverStateRef.current.hoveredNodeId ?? '');
        if (!hoveredNode) return;

        const r = hoverStateRef.current.renderedRadius;
        const hitR = hoverStateRef.current.hitRadius;
        const halo = hoverStateRef.current.haloRadius;
        const energy = hoverStateRef.current.energy;
        const targetEnergy = hoverStateRef.current.targetEnergy;
        const dist = hoverStateRef.current.hoveredDistPx;
        const decision = hoverStateRef.current.lastDecision;
        const nearestId = hoverStateRef.current.nearestCandidateId;
        const nearestDist = hoverStateRef.current.nearestCandidateDist;
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

        ctx.font = '10px monospace';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.fillText(
            `e=${energy.toFixed(2)} t=${targetEnergy.toFixed(2)} d=${dist.toFixed(0)}`,
            hoveredNode.x + r + 5,
            hoveredNode.y - 5
        );
        ctx.fillText(
            `id=${hoverStateRef.current.hoveredNodeId} near=${nearestId ?? 'null'} nd=${isFinite(nearestDist) ? nearestDist.toFixed(0) : 'inf'} ${decision}`,
            hoveredNode.x + r + 5,
            hoveredNode.y + 8
        );
        ctx.fillText(
            `dt=${dtRaw.toFixed(1)}ms clamped=${dtUsed.toFixed(1)}ms a=${alpha.toFixed(3)}`,
            hoveredNode.x + r + 5,
            hoveredNode.y + 21
        );
        ctx.fillText(
            `scan=${hoverStateRef.current.nodesScannedLastSelection} sel/s=${hoverStateRef.current.selectionRunsPerSecond} en/s=${hoverStateRef.current.energyUpdatesPerSecond}`,
            hoveredNode.x + r + 5,
            hoveredNode.y + 34
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
