/**
 * Node Binding - Apply AI analysis output to graph dots.
 */

import type { PhysicsEngine } from '../physics/engine';
import type { ParsedDocument } from './types';
import { setTopology, getTopology } from '../graph/topologyControl';
import { deriveSpringEdges } from '../graph/springDerivation';
import { springEdgesToPhysicsLinks } from '../graph/springToPhysics';
import type { DirectedLink } from '../graph/topologyTypes';
import { buildSavedInterfaceDedupeKey, type SavedInterfaceRecordV1 } from '../store/savedInterfacesStore';

import { analyzeDocument } from '../ai/paperAnalyzer';

function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

function toAnalysisErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  const normalized = raw.trim().toLowerCase();
  if (
    normalized.includes('401') ||
    normalized.includes('403') ||
    normalized.includes('unauthorized') ||
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
      .sort((a, b) => a.id.localeCompare(b.id));
    const nodeCount = orderedNodes.length;

    if (nodeCount === 0) {
      console.warn('[AI] No nodes available for analysis binding');
      return;
    }

    // Call AI Analyzer
    const { points, links, paperTitle } = await analyzeDocument(documentText, { nodeCount });

    // Gate check
    const currentDocId = getCurrentDocId();
    if (currentDocId !== documentId) {
      console.log(
        `[AI] Discarding stale analysis (expected ${documentId.slice(0, 8)}, got ${currentDocId?.slice(0, 8)})`
      );
      return;
    }

    const pointByIndex = new Map(points.map(p => [p.index, p]));
    const indexToNodeId = new Map<number, string>();

    // Apply points to nodes (by stable index)
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

    // Build directed links from AI output
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

    const finalTopology = getTopology();
    const springs = finalTopology.springs && finalTopology.springs.length > 0
      ? finalTopology.springs
      : deriveSpringEdges(finalTopology, engine.config);
    const physicsLinks = springEdgesToPhysicsLinks(springs);

    const nodesSnapshot = [...orderedNodes];
    engine.clear();
    nodesSnapshot.forEach(n => engine.addNode(n));
    physicsLinks.forEach(l => engine.addLink(l));
    engine.resetLifecycle();

    // Dispatch Inferred Title (Main Topic)
    const inferred = paperTitle || points[0]?.title;
    if (inferred) {
      setInferredTitle(inferred);
      console.log(`[AI] Inferred Title: "${inferred}"`);
    }

    const interfaceTitle = inferred || 'Untitled Interface';
    const nodesById: Record<string, { sourceTitle?: string; sourceSummary?: string }> = {};
    let summaryCount = 0;
    for (const node of orderedNodes) {
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

    console.log(`[AI] Applied ${points.length} analysis points`);
    console.log(`[AI] Applied ${directedLinks.length} directed links`);

  } catch (error) {
    console.error('[AI] Analysis failed:', error);
    setAIError(toAnalysisErrorMessage(error));
    throw error;
  } finally {
    setAIActivity(false);
  }
}
