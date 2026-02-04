type Input = {
  ids: string[];           // may include whitespace, empty strings, duplicates
  weights?: number[];      // optional; may include NaN/Infinity/out-of-range
};

type Output = {
  ids: string[];           // trimmed, non-empty, unique, preserve first-seen order
  weights: number[];       // same length as ids; defaults to 1.0
  warnings: string[];      // human-readable warnings
};

export function normalizeInput(input: Input): Output {
  const { ids, weights } = input;
  const resultIds: string[] = [];
  const resultWeights: number[] = [];
  const warnings: string[] = [];
  const seenIds = new Set<string>();

  // Process each ID with its corresponding weight
  for (let i = 0; i < ids.length; i++) {
    // Trim the ID and check if it's empty
    const trimmedId = ids[i]?.trim() || '';

    if (trimmedId === '') {
      continue; // Skip empty IDs
    }

    // Skip if we've already seen this ID
    if (seenIds.has(trimmedId)) {
      continue;
    }

    // Get the corresponding weight or default to 1.0
    let weight = 1.0;
    if (weights && i < weights.length) {
      weight = weights[i];
    }

    // Check if weight is valid (finite number)
    if (!Number.isFinite(weight)) {
      warnings.push(`Skipping ID "${trimmedId}" due to invalid weight: ${weight}`);
      continue;
    }

    // Clamp weight to [0, 1] range if needed
    if (weight < 0 || weight > 1) {
      const originalWeight = weight;
      weight = Math.max(0, Math.min(1, weight));
      warnings.push(`Clamped weight for ID "${trimmedId}" from ${originalWeight} to ${weight} (range [0,1])`);
    }

    // If we reach this point, the ID and weight are valid
    // Mark this ID as seen and add to results
    seenIds.add(trimmedId);
    resultIds.push(trimmedId);
    resultWeights.push(weight);
  }

  return {
    ids: resultIds,
    weights: resultWeights,
    warnings
  };
}