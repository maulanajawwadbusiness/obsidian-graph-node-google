// src/graph/kgSpecToTopology.ts
function kgNodeToNodeSpec(node) {
  return {
    id: node.id,
    label: node.label || node.id,
    meta: {
      kind: node.kind,
      source: node.source,
      payload: node.payload
    }
  };
}
function kgLinkToDirectedLink(link) {
  return {
    from: link.from,
    to: link.to,
    kind: link.rel || "relates",
    weight: link.weight ?? 1,
    meta: {
      directed: link.directed !== false,
      ...link.meta
    }
  };
}
function toTopologyFromKGSpec(spec) {
  const topology = {
    nodes: spec.nodes.map(kgNodeToNodeSpec),
    links: spec.links.map(kgLinkToDirectedLink)
  };
  return topology;
}

// src/graph/directedLinkId.ts
function getRel(link) {
  return link.kind || "related";
}
function getComboKey(link) {
  return `${link.from}->${link.to}::${getRel(link)}`;
}
function generateDirectedLinkId(link, index = 0) {
  const rel = getRel(link);
  return `${link.from}->${link.to}::${rel}::${index}`;
}
function ensureDirectedLinkIds(links, existingLinks = []) {
  const existingIds = /* @__PURE__ */ new Set();
  const comboCounts = /* @__PURE__ */ new Map();
  for (const link of existingLinks) {
    if (link.id) {
      existingIds.add(link.id);
    }
    const comboKey = getComboKey(link);
    comboCounts.set(comboKey, (comboCounts.get(comboKey) || 0) + 1);
  }
  return links.map((link) => {
    if (link.id) {
      existingIds.add(link.id);
      const comboKey2 = getComboKey(link);
      comboCounts.set(comboKey2, (comboCounts.get(comboKey2) || 0) + 1);
      return link;
    }
    const comboKey = getComboKey(link);
    let index = comboCounts.get(comboKey) || 0;
    let id = generateDirectedLinkId(link, index);
    while (existingIds.has(id)) {
      index++;
      id = generateDirectedLinkId(link, index);
    }
    comboCounts.set(comboKey, index + 1);
    existingIds.add(id);
    return { ...link, id };
  });
}

// src/graph/providers/hashUtils.ts
function hashString(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) + hash + char;
  }
  return (hash >>> 0).toString(16).toUpperCase();
}
function hashObject(obj) {
  const canonical = JSON.stringify(obj, canonicalStringifyReplacer, 0);
  return hashString(canonical);
}
function canonicalStringifyReplacer(_key, value) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const sortedKeys = Object.keys(value).sort();
    const sortedObj = {};
    for (const k of sortedKeys) {
      sortedObj[k] = value[k];
    }
    return sortedObj;
  }
  return value;
}
function hashTopologySnapshot(nodes, links) {
  const canonical = {
    nodes: [...nodes].map((n) => ({ id: n.id, label: n.label })).sort((a, b) => a.id.localeCompare(b.id)),
    links: [...links].map((l) => ({
      id: l.id,
      from: l.from,
      to: l.to,
      kind: l.kind || "relates",
      weight: l.weight ?? 1,
      meta: l.meta
    })).sort((a, b) => {
      if (a.from !== b.from) return a.from.localeCompare(b.from);
      if (a.to !== b.to) return a.to.localeCompare(b.to);
      if (a.kind !== b.kind) return a.kind.localeCompare(b.kind);
      return hashObject(a).localeCompare(hashObject(b));
    })
  };
  return hashObject(canonical);
}

// src/graph/providers/KGSpecProvider.ts
var DEFAULT_OPTIONS = {
  sortById: true
};
function normalizeNodes(spec) {
  const nodes = spec.nodes.map((node) => ({
    ...node,
    label: node.label?.trim() || node.id
  }));
  const seenIds = /* @__PURE__ */ new Set();
  const duplicates = [];
  for (const node of nodes) {
    if (!node.id) {
      duplicates.push("(missing id)");
      continue;
    }
    if (seenIds.has(node.id)) {
      duplicates.push(node.id);
      continue;
    }
    seenIds.add(node.id);
  }
  if (duplicates.length > 0) {
    const sample = duplicates.slice(0, 10).join(", ");
    const suffix = duplicates.length > 10 ? ` (+${duplicates.length - 10} more)` : "";
    throw new Error(`KGSpecProvider: duplicate node id(s): ${sample}${suffix}`);
  }
  return nodes;
}
function normalizeLinks(spec) {
  return spec.links.map((link) => ({
    ...link,
    rel: link.rel?.trim() || "relates",
    weight: link.weight ?? 1
  }));
}
function buildLinkSortKey(link) {
  const rel = link.rel?.trim() || "relates";
  const hash = hashObject({
    from: link.from,
    to: link.to,
    rel,
    weight: link.weight ?? 1,
    directed: link.directed !== false,
    meta: link.meta
  });
  return `${link.from}|${link.to}|${rel}|${hash}`;
}
function normalizeSpecForHash(nodes, links) {
  const normalizedNodes = [...nodes].map((node) => ({
    id: node.id,
    label: node.label?.trim() || node.id,
    kind: node.kind,
    source: node.source,
    payload: node.payload
  })).sort((a, b) => a.id.localeCompare(b.id));
  const normalizedLinks = [...links].map((link) => ({
    from: link.from,
    to: link.to,
    rel: link.rel?.trim() || "relates",
    weight: link.weight ?? 1,
    directed: link.directed !== false,
    meta: link.meta
  })).sort((a, b) => buildLinkSortKey(a).localeCompare(buildLinkSortKey(b)));
  return { normalizedNodes, normalizedLinks };
}
var KGSpecProvider = {
  name: "kgSpec",
  buildSnapshot(spec) {
    const opts = DEFAULT_OPTIONS;
    const normalizedNodes = normalizeNodes(spec);
    const normalizedLinks = normalizeLinks(spec);
    const { normalizedLinks: hashLinks, normalizedNodes: hashNodes } = normalizeSpecForHash(normalizedNodes, normalizedLinks);
    const inputHash = hashObject({
      specVersion: spec.specVersion,
      docId: spec.docId,
      nodes: hashNodes,
      links: hashLinks
    });
    const topology = toTopologyFromKGSpec({
      ...spec,
      nodes: normalizedNodes,
      links: normalizedLinks
    });
    const sortedLinks = [...topology.links].sort((a, b) => {
      if (a.from !== b.from) return a.from.localeCompare(b.from);
      if (a.to !== b.to) return a.to.localeCompare(b.to);
      if ((a.kind || "relates") !== (b.kind || "relates")) {
        return (a.kind || "relates").localeCompare(b.kind || "relates");
      }
      const aKey = hashObject({
        from: a.from,
        to: a.to,
        kind: a.kind || "relates",
        weight: a.weight ?? 1,
        meta: a.meta
      });
      const bKey = hashObject({
        from: b.from,
        to: b.to,
        kind: b.kind || "relates",
        weight: b.weight ?? 1,
        meta: b.meta
      });
      return aKey.localeCompare(bKey);
    });
    const linksWithIds = ensureDirectedLinkIds(sortedLinks);
    if (opts.sortById) {
      topology.nodes.sort((a, b) => a.id.localeCompare(b.id));
      linksWithIds.sort((a, b) => (a.id || "").localeCompare(b.id || ""));
    }
    return {
      nodes: topology.nodes,
      directedLinks: linksWithIds,
      meta: {
        provider: "kgSpec",
        docId: spec.docId,
        inputHash
      }
    };
  },
  hashInput(spec) {
    const normalizedNodes = normalizeNodes(spec);
    const normalizedLinks = normalizeLinks(spec);
    const { normalizedLinks: hashLinks, normalizedNodes: hashNodes } = normalizeSpecForHash(normalizedNodes, normalizedLinks);
    return hashObject({
      specVersion: spec.specVersion,
      docId: spec.docId,
      nodes: hashNodes,
      links: hashLinks
    });
  }
};

// src/graph/providers/stabilityTest.ts
function mulberry32(seed) {
  let t = seed >>> 0;
  return () => {
    t += 1831565813;
    let r = Math.imul(t ^ t >>> 15, 1 | t);
    r ^= r + Math.imul(r ^ r >>> 7, 61 | r);
    return ((r ^ r >>> 14) >>> 0) / 4294967296;
  };
}
function shuffleArray(arr, seed) {
  const rand = mulberry32(seed);
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
function testProviderStability(spec, iterations = 5) {
  if (false) {
    console.warn("[StabilityTest] Running in production - should be dev-only");
  }
  const originalSnapshot = KGSpecProvider.buildSnapshot(spec);
  const originalHash = hashTopologySnapshot(
    originalSnapshot.nodes,
    originalSnapshot.directedLinks
  );
  console.log(`[StabilityTest] Original hash: ${originalHash}`);
  let allPassed = true;
  for (let i = 0; i < iterations; i++) {
    const shuffledSpec = {
      ...spec,
      nodes: shuffleArray(spec.nodes, i + 1),
      links: shuffleArray(spec.links, i + 101)
    };
    const shuffledSnapshot = KGSpecProvider.buildSnapshot(shuffledSpec);
    const shuffledHash = hashTopologySnapshot(
      shuffledSnapshot.nodes,
      shuffledSnapshot.directedLinks
    );
    const passed = shuffledHash === originalHash;
    console.log(
      `[StabilityTest] Iteration ${i + 1}: hash=${shuffledHash} ${passed ? "PASS" : "FAIL"}`
    );
    if (!passed) {
      allPassed = false;
    }
  }
  return {
    passed: allPassed,
    originalHash,
    shuffledHash: originalHash,
    // Same if passed
    iterations
  };
}
function runQuickStabilityTest() {
  console.log("[StabilityTest] Running quick stability test...");
  const testSpec = {
    specVersion: "kg/1",
    nodes: [
      { id: "Z" },
      { id: "A" },
      { id: "M" },
      { id: "B" }
    ],
    links: [
      { from: "A", to: "B", rel: "connects", weight: 1 },
      { from: "Z", to: "M", rel: "causes", weight: 0.5 },
      { from: "M", to: "A", rel: "supports", weight: 0.8 }
    ]
  };
  return testProviderStability(testSpec, 5);
}
export {
  runQuickStabilityTest,
  testProviderStability
};
