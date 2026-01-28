/**
 * Node Binding - Apply parsed text to node labels
 * Takes first 5 words from document and sets them as node labels
 */

import type { PhysicsEngine } from '../physics/engine';
import type { ParsedDocument } from './types';


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
  setInferredTitle: (title: string | null) => void
): Promise<void> {
  console.log(`[AI] Starting paper analysis for doc ${documentId.slice(0, 8)}...`);

  setAIActivity(true);

  try {
    // Call AI Analyzer
    const { points } = await analyzeDocument(documentText);

    // Gate check
    const currentDocId = getCurrentDocId();
    if (currentDocId !== documentId) {
      console.log(
        `[AI] Discarding stale analysis (expected ${documentId.slice(0, 8)}, got ${currentDocId?.slice(0, 8)})`
      );
      return;
    }

    // Apply points to nodes
    const nodes = Array.from(engine.nodes.values()).slice(0, 5);
    nodes.forEach((node, i) => {
      const point = points[i];
      if (point) {
        // Update Label
        node.label = point.title;

        // Update Meta (Popup Knowledge)
        node.meta = {
          docId: documentId,
          sourceTitle: point.title,
          sourceSummary: point.summary
        };

        console.log(`[AI] Node ${i}: "${point.title}"`);
      }
    });

    // Dispatch Inferred Title (Main Topic)
    if (points.length > 0) {
      setInferredTitle(points[0].title);
      console.log(`[AI] Inferred Title: "${points[0].title}"`);
    }

    console.log(`[AI] Applied ${points.length} analysis points`);

  } catch (error) {
    console.error('[AI] Analysis failed:', error);
  } finally {
    setAIActivity(false);
  }
}
