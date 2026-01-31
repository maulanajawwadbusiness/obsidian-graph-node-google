import { PhysicsLink, PhysicsNode } from '../physics/types';
import { SeededRandom } from '../utils/seededRandom';

// -----------------------------------------------------------------------------
// Helper: Random Graph Generator
// -----------------------------------------------------------------------------

// Generate a "Spine-Rib-Fiber" Topology
// KEY UPDATE: "Structural Seeding". Nodes are placed relative to their parents
// to break radial symmetry at t=0.
export function generateRandomGraph(
    nodeCount: number,
    targetSpacing: number = 500,
    initScale: number = 0.1,
    seed: number = Date.now(),
    initStrategy: 'spread' | 'legacy' = 'legacy'
) {
    const nodes: PhysicsNode[] = [];
    const links: PhysicsLink[] = [];

    // Initialize seeded RNG for deterministic generation
    const rng = new SeededRandom(seed);

    const minSpawnSpacing = 2; // 2px epsilon to avoid singularity overlaps

    const generateSpreadPositions = () => {
        const positions: Array<{ x: number; y: number }> = [];
        const goldenAngle = Math.PI * (3 - Math.sqrt(5));
        const radiusBase = Math.max(targetSpacing * 0.8, targetSpacing * Math.sqrt(nodeCount) * 0.2);
        const minSpacingSq = minSpawnSpacing * minSpawnSpacing;

        for (let i = 0; i < nodeCount; i++) {
            const t = (i + 0.5) / nodeCount;
            const baseRadius = Math.sqrt(t) * radiusBase;
            let angle = i * goldenAngle + (rng.next() - 0.5) * 0.35;
            let radius = baseRadius;
            let x = Math.cos(angle) * radius;
            let y = Math.sin(angle) * radius;

            for (let attempt = 0; attempt < 6; attempt++) {
                let tooClose = false;
                for (const pos of positions) {
                    const dx = x - pos.x;
                    const dy = y - pos.y;
                    if (dx * dx + dy * dy < minSpacingSq) {
                        tooClose = true;
                        break;
                    }
                }
                if (!tooClose) break;
                angle += goldenAngle * 0.35;
                radius = baseRadius + minSpawnSpacing * (attempt + 1) * 0.5;
                x = Math.cos(angle) * radius;
                y = Math.sin(angle) * radius;
            }

            positions.push({ x, y });
        }

        return positions;
    };

    // 0. Helper: Create Node (initially at 0,0, moved later)
    // SPAWN MICRO-CLOUD: Hash-based disc distribution to destroy symmetry bowl
    const createNode = (id: string, roleRadius: number, roleMass: number, role: 'spine' | 'rib' | 'fiber'): PhysicsNode => {
        // Compute deterministic jitter from node ID hash
        let hash = 0;
        for (let i = 0; i < id.length; i++) {
            hash = ((hash << 5) - hash) + id.charCodeAt(i);
            hash |= 0;
        }

        // Angle: full circle from hash
        const jitterAngle = (Math.abs(hash) % 1000) / 1000 * 2 * Math.PI;

        // Radius: 2-6px with sqrt for uniform area distribution
        // sqrt(uniform) gives uniform area coverage in disc
        const hashRadius = (Math.abs(hash >> 10) % 1000) / 1000;  // 0-1
        const sqrtRadius = Math.sqrt(hashRadius);  // Uniform area
        const jitterRadius = 2 + sqrtRadius * 4;  // 2-6px

        const jitterX = Math.cos(jitterAngle) * jitterRadius;
        const jitterY = Math.sin(jitterAngle) * jitterRadius;

        return {
            id,
            x: jitterX, y: jitterY,  // Start in micro-cloud, not origin
            vx: 0, vy: 0, fx: 0, fy: 0,
            mass: roleMass,
            radius: roleRadius,
            isFixed: false,
            warmth: 1.0,
            role,
            label: `Node ${id.substring(1)}`
        };
    };

    // 1. Roles & Counts
    const spineCount = Math.max(3, Math.min(5, Math.floor(nodeCount * 0.1))); // 3-5 Spine nodes
    const remaining = nodeCount - spineCount;
    const ribRatio = 0.6 + rng.next() * 0.15; // 60-75% Ribs
    const ribCount = Math.floor(remaining * ribRatio);
    const fiberCount = remaining - ribCount;

    // Arrays to track indices
    const spineIndices: number[] = [];
    const ribIndices: number[] = [];
    const fiberIndices: number[] = [];

    let globalIdx = 0;

    // 2. Build Spine (The Axis)
    // Intentional Asymmetry: Diagonal Axis (1, 0.5)
    // Start offset (clamped to prevent singularity at targetSpacing=0)
    const currentPos = {
        x: (rng.next() - 0.5) * Math.max(40, targetSpacing * initScale * 5),
        y: (rng.next() - 0.5) * Math.max(40, targetSpacing * initScale * 5)
    };

    const spineStep = {
        x: Math.max(8, targetSpacing * initScale),  // Min 8px to prevent circle mode
        y: Math.max(4, targetSpacing * initScale * 0.5)  // Min 4px
    };

    for (let i = 0; i < spineCount; i++) {
        const id = `n${globalIdx}`;
        spineIndices.push(globalIdx);
        globalIdx++;

        const node = createNode(id, 8.0, 4.0, 'spine'); // Heavy, Big

        // PLACEMENT: Sequential
        if (i === 0) {
            node.x = currentPos.x;
            node.y = currentPos.y;
        } else {
            // Move "forward" along axis (jitter clamped)
            currentPos.x += spineStep.x + (rng.next() - 0.5) * Math.max(2, targetSpacing * initScale * 0.3);
            currentPos.y += spineStep.y + (rng.next() - 0.5) * Math.max(2, targetSpacing * initScale * 0.3);
            node.x = currentPos.x;
            node.y = currentPos.y;
        }

        nodes.push(node);

        // LINKING
        if (i > 0) {
            // Crooked Chain: Occasional branching (Y-shape)
            let targetStep = 1;
            if (i > 1 && rng.next() < 0.2) targetStep = 2; // Connect to grandparent

            const prevIdx = spineIndices[i - targetStep];
            links.push({
                source: `n${prevIdx}`,
                target: id,
                lengthBias: 0.5, // SHORT
                stiffnessBias: 1.0 // STIFF
            });
        }
    }

    // 3. Build Ribs (The Body)
    // Anchored to Spine
    for (let i = 0; i < ribCount; i++) {
        const id = `n${globalIdx}`;
        ribIndices.push(globalIdx);
        globalIdx++;

        const node = createNode(id, 6.0, 2.0, 'rib'); // Medium

        // Pick Anchor
        const spineAnchorIdx = spineIndices[Math.floor(rng.next() * spineIndices.length)];
        const spineAnchor = nodes[spineAnchorIdx];

        // PLACEMENT: Offset from Normal (clamped to prevent singularity)
        // "Normal" to (1, 0.5) is (-0.5, 1) or (0.5, -1).
        // Let's alternate sides based on index parity to create "volume"
        const side = (i % 2 === 0) ? 1 : -1;
        const ribOffset = {
            x: -Math.max(2, targetSpacing * initScale * 0.25) * side,
            y: Math.max(4, targetSpacing * initScale * 0.5) * side
        };

        node.x = spineAnchor.x + ribOffset.x + (rng.next() - 0.5) * Math.max(2, targetSpacing * initScale * 0.3);
        node.y = spineAnchor.y + ribOffset.y + (rng.next() - 0.5) * Math.max(2, targetSpacing * initScale * 0.3);

        nodes.push(node);

        // LINKING
        links.push({
            source: spineAnchor.id,
            target: id,
            lengthBias: 1.0, // NORMAL
            stiffnessBias: 0.8 // FIRM
        });

        // Cage (20% chance double link)
        if (rng.next() < 0.2) {
            const anchor2Idx = spineIndices[Math.floor(rng.next() * spineIndices.length)];
            if (anchor2Idx !== spineAnchorIdx) {
                links.push({
                    source: `n${anchor2Idx}`,
                    target: id,
                    lengthBias: 1.0,
                    stiffnessBias: 0.8
                });
            }
        }
    }

    // 4. Build Fibers (The Detail)
    // Anchored to Ribs
    for (let i = 0; i < fiberCount; i++) {
        const id = `n${globalIdx}`;
        fiberIndices.push(globalIdx);
        globalIdx++;

        const node = createNode(id, 4.0, 1.0, 'fiber'); // Light

        // Pick Anchor
        const ribAnchorIdx = ribIndices[Math.floor(rng.next() * ribIndices.length)];
        const ribAnchor = nodes[ribAnchorIdx];

        // PLACEMENT: Small outward offset (clamped to prevent singularity)
        // Just extend further out
        const fiberOffset = {
            x: (rng.next() - 0.5) * Math.max(6, targetSpacing * initScale * 0.67),
            y: (rng.next() - 0.5) * Math.max(6, targetSpacing * initScale * 0.67)
        };

        node.x = ribAnchor.x + fiberOffset.x;
        node.y = ribAnchor.y + fiberOffset.y;

        nodes.push(node);

        // LINKING
        links.push({
            source: ribAnchor.id,
            target: id,
            lengthBias: 1.5, // LONG
            stiffnessBias: 0.4 // LOOSE (Soft)
        });
    }

    if (initStrategy === 'spread') {
        const spreadPositions = generateSpreadPositions();
        for (let i = 0; i < nodes.length; i++) {
            const pos = spreadPositions[i];
            if (!pos) continue;
            nodes[i].x = pos.x;
            nodes[i].y = pos.y;
        }
    }

    return { nodes, links };
}
