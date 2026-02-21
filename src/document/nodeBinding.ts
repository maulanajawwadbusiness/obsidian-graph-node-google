/**
 * Node Binding - Apply AI analysis output to graph dots.
 */

import type { PhysicsEngine } from '../physics/engine';
import type { PhysicsNode } from '../physics/types';
import type { ParsedDocument } from './types';
import { setTopology, getTopology } from '../graph/topologyControl';
import { deriveSpringEdges } from '../graph/springDerivation';
import { springEdgesToPhysicsLinks } from '../graph/springToPhysics';
import type { DirectedLink } from '../graph/topologyTypes';
import { buildSavedInterfaceDedupeKey, type SavedInterfaceRecordV1 } from '../store/savedInterfacesStore';
import { isStaleAnalysisResult } from '../server/src/llm/analyze/analysisFlowGuards';

import { runAnalysis } from '../ai/analysisRouter';
import { applySkeletonTopologyToRuntime } from '../graph/skeletonTopologyRuntime';

function compareCodeUnit(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

type AnalysisErrorPayload = {
  code?: string;
  message?: string;
  status?: number;
  details?: unknown;
};

class AnalysisRunError extends Error {
  code?: string;
  status?: number;
  details?: unknown;

  constructor(payload: AnalysisErrorPayload) {
    const code = typeof payload.code === 'string' && payload.code.trim() ? payload.code.trim() : undefined;
    const message = typeof payload.message === 'string' && payload.message.trim() ? payload.message.trim() : undefined;
    super(message || code || 'analysis failed');
    this.name = 'AnalysisRunError';
    this.code = code;
    this.status = Number.isFinite(payload.status) ? Number(payload.status) : undefined;
    this.details = payload.details;
  }
}

function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

function toAnalysisErrorMessage(error: unknown): string {
  const status =
    error && typeof error === 'object' && Number.isFinite((error as { status?: unknown }).status)
      ? Number((error as { status: number }).status)
      : undefined;
  const code =
    error && typeof error === 'object' && typeof (error as { code?: unknown }).code === 'string'
      ? (error as { code: string }).code
      : undefined;
  const baseText = [code, error instanceof Error ? error.message : String(error)]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .join(' ')
    .trim();
  const raw = baseText || String(error ?? '');
  const normalized = raw.trim().toLowerCase();
  if (
    status === 401 ||
    status === 403 ||
    normalized.includes('unauthorized') ||
    normalized.includes('401') ||
    normalized.includes('403') ||
    normalized.includes('forbidden') ||
    normalized.includes('please log in')
  ) {
    return 'You are not logged in. Please log in and try again.';
  }
  if (normalized.includes('insufficient_balance') || normalized.includes('insufficient_rupiah')) {
    return 'Your balance is not sufficient for analysis. Please top up and try again.';
  }
  if (
    normalized.includes('failed to fetch') ||
    normalized.includes('network') ||
    normalized.includes('timeout')
  ) {
    return 'We could not reach the server, so analysis did not run. Your graph is unchanged.';
  }
  return 'Analysis failed. Please go back and try again.';
}

function mapSkeletonRoleToPhysicsRole(role: unknown): 'spine' | 'rib' | 'fiber' {
  if (role === 'claim' || role === 'context') return 'spine';
  if (role === 'method' || role === 'evidence') return 'rib';
  return 'fiber';
}

function buildPhysicsNodesFromTopology(args: {
  topologyNodes: Array<{ id: string; label?: string; meta?: Record<string, unknown> }>;
  initialPositions: Record<string, { x: number; y: number }>;
  documentId: string;
  spacing: number;
}): PhysicsNode[] {
  return args.topologyNodes.map((spec, index) => {
    const meta = spec.meta as Record<string, unknown> | undefined;
    const role = mapSkeletonRoleToPhysicsRole(meta?.role);
    const title = typeof spec.label === 'string' && spec.label.trim() ? spec.label.trim() : spec.id;
    const summaryRaw = typeof meta?.summary === 'string' ? meta.summary : title;
    const summary = summaryRaw.trim() || title;
    const pos = args.initialPositions[spec.id];
    const fallbackAngle = (Math.PI * 2 * index) / Math.max(1, args.topologyNodes.length);
    const fallbackX = Math.cos(fallbackAngle) * args.spacing;
    const fallbackY = Math.sin(fallbackAngle) * args.spacing;
    const radius = role === 'spine' ? 8 : role === 'rib' ? 6 : 5;
    const mass = role === 'spine' ? 3 : role === 'rib' ? 2 : 1;
    return {
      id: spec.id,
      x: Number.isFinite(pos?.x) ? pos.x : fallbackX,
      y: Number.isFinite(pos?.y) ? pos.y : fallbackY,
      vx: 0,
      vy: 0,
      fx: 0,
      fy: 0,
      mass,
      radius,
      isFixed: false,
      warmth: 1.0,
      role,
      label: title,
      meta: {
        docId: args.documentId,
        sourceTitle: title,
        sourceSummary: summary
      }
    };
  });
}

/**
 * Apply AI Analysis (5 Key Points) to nodes
 * Replaces the old "3-word label" logic with a richer Title + Summary binding
 */
export async function applyAnalysisToNodes(
  engine: PhysicsEngine,
  documentText: string,
  documentId: string,
  getCurrentDocId: () => string | null,
  setAIActivity: (active: boolean) => void,
  setAIError: (error: string | null) => void,
  setInferredTitle: (title: string | null) => void,
  onSavedInterfaceReady?: (record: SavedInterfaceRecordV1) => void
): Promise<void> {
  console.log(`[AI] Starting paper analysis for doc ${documentId.slice(0, 8)}...`);

  setAIActivity(true);
  setAIError(null);

  try {
    const orderedNodes = Array.from(engine.nodes.values())
      .sort((a, b) => compareCodeUnit(a.id, b.id));
    const nodeCount = orderedNodes.length;

    // Call AI Analyzer
    const analysis = await runAnalysis({ text: documentText, nodeCount });
    const currentDocId = getCurrentDocId();
    if (isStaleAnalysisResult(documentId, currentDocId)) {
      console.log(
        `[AI] Discarding stale analysis (expected ${documentId.slice(0, 8)}, got ${currentDocId?.slice(0, 8)})`
      );
      return;
    }
    if (analysis.kind === 'error') {
      throw new AnalysisRunError(analysis.error);
    }

    let finalTopology: ReturnType<typeof getTopology>;
    let runtimeNodes: PhysicsNode[] = [];
    let inferred: string | undefined;

    if (analysis.kind === 'classic') {
      if (nodeCount === 0) {
        console.warn('[AI] No nodes available for classic analysis binding');
        return;
      }

      const { points, links, paperTitle } = analysis.json;
      const pointByIndex = new Map(points.map(p => [p.index, p]));
      const indexToNodeId = new Map<number, string>();

      orderedNodes.forEach((node, i) => {
        indexToNodeId.set(i, node.id);
        const point = pointByIndex.get(i);
        if (point) {
          node.label = point.title;
          node.meta = {
            docId: documentId,
            sourceTitle: point.title,
            sourceSummary: point.summary
          };
          console.log(`[AI] Node ${i}: "${point.title}"`);
        }
      });

      const directedLinks: DirectedLink[] = [];
      let invalidLinkCount = 0;
      for (const link of links) {
        const fromId = indexToNodeId.get(link.fromIndex);
        const toId = indexToNodeId.get(link.toIndex);
        if (!fromId || !toId || fromId === toId) {
          invalidLinkCount += 1;
          continue;
        }
        const weight = Number.isFinite(link.weight)
          ? Math.max(0.05, Math.min(2.0, link.weight))
          : 1.0;
        directedLinks.push({
          from: fromId,
          to: toId,
          kind: link.type || 'relates',
          weight
        });
      }

      if (invalidLinkCount > 0) {
        console.warn(`[AI] Dropped ${invalidLinkCount} invalid link(s)`);
      }

      const topologyNodes = orderedNodes.map((node, i) => {
        const point = pointByIndex.get(i);
        return {
          id: node.id,
          label: point?.title || node.label,
          meta: { role: node.role }
        };
      });

      setTopology({
        nodes: topologyNodes,
        links: directedLinks
      }, engine.config, { source: 'setTopology', docId: documentId });

      finalTopology = getTopology();
      runtimeNodes = [...orderedNodes];
      inferred = paperTitle || points[0]?.title;
      console.log(`[AI] Applied ${points.length} analysis points`);
      console.log(`[AI] Applied ${directedLinks.length} directed links`);
    } else {
      const built = applySkeletonTopologyToRuntime(analysis.skeleton, {
        config: engine.config,
        meta: { source: 'setTopology', docId: documentId }
      });
      finalTopology = getTopology();
      const spacing = Math.max(120, engine.config.targetSpacing * 0.6);
      runtimeNodes = buildPhysicsNodesFromTopology({
        topologyNodes: finalTopology.nodes,
        initialPositions: built.initialPositions,
        documentId,
        spacing
      });
      inferred = typeof finalTopology.nodes[0]?.label === 'string' ? finalTopology.nodes[0].label : undefined;
      console.log(`[AI] Applied skeleton topology nodes=${finalTopology.nodes.length} links=${finalTopology.links.length}`);
    }

    const springs = finalTopology.springs && finalTopology.springs.length > 0
      ? finalTopology.springs
      : deriveSpringEdges(finalTopology, engine.config);
    const physicsLinks = springEdgesToPhysicsLinks(springs);

    engine.clear();
    runtimeNodes.forEach(n => engine.addNode(n));
    physicsLinks.forEach(l => engine.addLink(l));
    engine.resetLifecycle();

    if (inferred) {
      setInferredTitle(inferred);
      console.log(`[AI] Inferred Title: "${inferred}"`);
    }

    const interfaceTitle = inferred || 'Untitled Interface';
    const nodesById: Record<string, { sourceTitle?: string; sourceSummary?: string }> = {};
    let summaryCount = 0;
    for (const node of runtimeNodes) {
      const nodeMeta = node.meta as Record<string, unknown> | undefined;
      if (!nodeMeta) continue;
      const sourceTitle = typeof nodeMeta.sourceTitle === 'string' ? nodeMeta.sourceTitle : undefined;
      const sourceSummary = typeof nodeMeta.sourceSummary === 'string' ? nodeMeta.sourceSummary : undefined;
      if (!sourceTitle && !sourceSummary) continue;
      nodesById[node.id] = { sourceTitle, sourceSummary };
      if (sourceSummary) {
        summaryCount += 1;
      }
    }
    const analysisMeta = Object.keys(nodesById).length > 0
      ? {
        version: 1 as const,
        nodesById
      }
      : undefined;

    const parsedDocument: ParsedDocument = {
      id: documentId,
      fileName: interfaceTitle,
      mimeType: 'text/plain',
      sourceType: 'txt',
      text: documentText,
      warnings: [],
      meta: {
        wordCount: countWords(documentText),
        charCount: documentText.length
      }
    };

    const preview = {
      nodeCount: finalTopology.nodes.length,
      linkCount: finalTopology.links.length,
      charCount: parsedDocument.meta.charCount,
      wordCount: parsedDocument.meta.wordCount
    };
    const source = documentId.startsWith('pasted-')
      ? 'paste'
      : documentId.startsWith('dropped-')
        ? 'file'
        : 'unknown';

    const dedupeKey = buildSavedInterfaceDedupeKey({
      docId: documentId,
      title: interfaceTitle,
      topology: finalTopology
    });

    const savedRecord: SavedInterfaceRecordV1 = {
      id: `iface-${Date.now()}-${documentId}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      title: interfaceTitle,
      docId: documentId,
      source,
      fileName: parsedDocument.fileName,
      mimeType: parsedDocument.mimeType,
      parsedDocument,
      topology: finalTopology,
      analysisMeta,
      preview,
      dedupeKey
    };
    onSavedInterfaceReady?.(savedRecord);

    if (import.meta.env.DEV) {
      console.log(
        `[savedInterfaces] upsert_ready id=${savedRecord.id} docId=${documentId} nodes=${preview.nodeCount} links=${preview.linkCount}`
      );
      if (analysisMeta) {
        console.log(
          `[savedInterfaces] analysisMeta_saved id=${savedRecord.id} nodes=${Object.keys(analysisMeta.nodesById).length} summaries=${summaryCount}`
        );
      } else {
        console.log('[savedInterfaces] analysisMeta_save_skipped reason=no_runtime_node_meta');
      }
    }

  } catch (error) {
    console.error('[AI] Analysis failed:', error);
    setAIError(toAnalysisErrorMessage(error));
    throw error;
  } finally {
    setAIActivity(false);
  }
}
