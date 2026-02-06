/**
 * Node Binding - Apply parsed text to node labels
 * Takes first 5 words from document and sets them as node labels
 */

import type { PhysicsEngine } from '../physics/engine';
import type { ParsedDocument } from './types';
import { setTopology, getTopology } from '../graph/topologyControl';
import { deriveSpringEdges } from '../graph/springDerivation';
import { springEdgesToPhysicsLinks } from '../graph/springToPhysics';
import type { DirectedLink } from '../graph/topologyTypes';


export function applyFirstWordsToNodes(
  engine: PhysicsEngine,
  document: ParsedDocument
): void {
  const words = document.text
    .trim()
    .split(/\s+/)
    .filter(w => w.length > 0)
    .slice(0, 5);

  const nodes = Array.from(engine.nodes.values()).slice(0, 5);

  nodes.forEach((node, i) => {
    if (words[i]) {
      node.label = words[i];
      console.log(`[NodeBinding] Node ${i}: "${words[i]}"`);
    }
  });

  console.log(`[NodeBinding] Applied ${words.length} words to ${nodes.length} nodes`);
}

import { analyzeDocument } from '../ai/paperAnalyzer';

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
  setInferredTitle: (title: string | null) => void
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

    console.log(`[AI] Applied ${points.length} analysis points`);
    console.log(`[AI] Applied ${directedLinks.length} directed links`);

  } catch (error) {
    console.error('[AI] Analysis failed:', error);
    const raw = error instanceof Error ? error.message : 'analysis failed';
    const message = raw === 'unauthorized'
      ? 'We could not reach the server, so analysis did not run. Please log in and try again.'
      : 'We could not reach the server, so analysis did not run. Your graph is unchanged.';
    setAIError(message);
  } finally {
    setAIActivity(false);
  }
}
