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
