import { PhysicsEngine } from '../../physics/engine';
// (Unused import removed)
import { SpatialGrid } from './spatialGrid';

export class RenderScratch {
    // Visible Node Indices (into engine.getNodeList())
    public visibleNodeIndices: number[] = [];
    public visibleNodesCount: number = 0;

    // Spatial Hit Test Grid
    public hitGrid: SpatialGrid = new SpatialGrid(100);

    // Label Placement Grid (for decluttering)
    // 2D grid: key -> boolean (occupied)
    public labelGrid: Set<number> = new Set();
    public labelCellSize: number = 50;

    public prepare(
        engine: PhysicsEngine,
        visibleBounds: { minX: number; maxX: number; minY: number; maxY: number }
    ) {
        // 1. Reset
        this.visibleNodesCount = 0;
        // Don't clear array, just reset count. We will overwrite.
        // (But JS arrays don't work like C pointers, we push.
        //  Actually, better to .length = 0 to trust JS engine optimization?)
        this.visibleNodeIndices.length = 0;

        this.hitGrid.clear();
        this.labelGrid.clear();

        // 2. Cull & Populate
        const nodes = engine.getNodeList(); // Cached list
        for (let i = 0; i < nodes.length; i++) {
            const node = nodes[i];

            // World Cull
            if (
                node.x + node.radius < visibleBounds.minX ||
                node.x - node.radius > visibleBounds.maxX ||
                node.y + node.radius < visibleBounds.minY ||
                node.y - node.radius > visibleBounds.maxY
            ) {
                continue;
            }

            // Visible
            this.visibleNodeIndices.push(i);
            this.visibleNodesCount++;

            // Add to Hit Grid
            this.hitGrid.add(node.x, node.y, i);
        }
    }
}
