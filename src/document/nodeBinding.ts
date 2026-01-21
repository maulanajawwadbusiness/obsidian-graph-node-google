/**
 * Node Binding - Apply parsed text to node labels
 * Takes first 5 words from document and sets them as node labels
 * Attaches document references for reveal functionality
 */

import type { PhysicsEngine } from '../physics/engine';
import type { ParsedDocument } from './types';
import { makeThreeWordLabels } from '../ai/labelRewriter';
import { computeExcerpt, type NodeDocRefV1 } from './bridge/nodeDocRef';

// Generate simple UUID (v4-like)
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export function applyFirstWordsToNodes(
  engine: PhysicsEngine,
  document: ParsedDocument
): void {
  const text = document.text;
  const wordMatches = [...text.matchAll(/\S+/g)].slice(0, 5);
  const nodes = Array.from(engine.nodes.values()).slice(0, 5);

  nodes.forEach((node, i) => {
    const match = wordMatches[i];
    if (!match) return;

    const word = match[0];
    const start = match.index!;
    const end = start + word.length;

    // Set label
    node.label = word;

    // Create doc ref
    const ref: NodeDocRefV1 = {
      refId: generateUUID(),
      docId: document.id,
      normVersion: 1,
      range: { start, end },
      kind: 'label',
      excerpt: computeExcerpt(text, start, end),
      createdAtMs: Date.now(),
    };

    // Attach to node
    if (!node.docRefs) {
      node.docRefs = [];
    }
    node.docRefs = [ref];
    node.primaryDocRefId = ref.refId;

    console.log(`[NodeBinding] Node ${i}: "${word}" @ offset ${start}`);
  });

  console.log(`[NodeBinding] Applied ${wordMatches.length} words to ${nodes.length} nodes`);
}

/**
 * Apply AI-generated 3-word labels to nodes
 * @param engine - Physics engine containing nodes
 * @param words - Original 5 words to transform
 * @param documentId - ID of the document for race protection
 * @param getCurrentDocId - Function to get current active document ID
 * @param setAIActivity - Function to set AI activity state
 */
export async function applyAILabelsToNodes(
  engine: PhysicsEngine,
  words: string[],
  documentId: string,
  getCurrentDocId: () => string | null,
  setAIActivity: (active: boolean) => void
): Promise<void> {
  console.log(`[AI] Starting label rewrite for doc ${documentId.slice(0, 8)}...`);

  setAIActivity(true);  // Signal AI activity started

  try {
    // Call AI to generate 3-word sentences
    const aiLabels = await makeThreeWordLabels(words);

    // Gate check: is this still the active document?
    const currentDocId = getCurrentDocId();
    if (currentDocId !== documentId) {
      console.log(
        `[AI] Discarding stale results (expected ${documentId.slice(0, 8)}, got ${currentDocId?.slice(0, 8)})`
      );
      return;
    }

    // Apply AI labels to nodes
    const nodes = Array.from(engine.nodes.values()).slice(0, 5);
    nodes.forEach((node, i) => {
      if (aiLabels[i]) {
        node.label = aiLabels[i];
        console.log(`[AI] Node ${i}: "${aiLabels[i]}"`);
      }
    });

    console.log(`[AI] Applied ${aiLabels.length} AI labels`);
  } catch (error) {
    console.error('[AI] Label rewrite failed:', error);
    // Original words already applied, no action needed
  } finally {
    setAIActivity(false);  // Always signal AI activity ended
  }
}
