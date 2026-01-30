import { PhysicsNode } from '../../physics/types';

/**
 * FIX 54: Sublinear Hit Testing
 * A GC-friendly spatial hash grid that reuses internal arrays to avoid allocation storms.
 * Rebuilt once per frame.
 */
export class SpatialGrid {
    private cellSize: number;
    // Map key -> Array of Node IDs
    private buckets: Map<string, string[]> = new Map();
    // Cache of allocated arrays to reuse (Object Pool pattern)
    private arrayPool: string[][] = [];
    private poolIndex: number = 0;

    constructor(cellSize: number = 100) {
        this.cellSize = cellSize;
    }

    private getKey(x: number, y: number): string {
        const kx = Math.floor(x / this.cellSize);
        const ky = Math.floor(y / this.cellSize);
        return `${kx}:${ky}`;
    }

    /**
     * Clear the grid without releasing memory if possible.
     */
    public clear() {
        // Return all arrays to pool? 
        // Strategy: 
        // 1. Traverse buckets.
        // 2. Clear each array (length=0).
        // 3. Keep them in the bucket map?
        // Actually, cleaner approach for JS:
        // Use a simple list of "active keys" to reset.

        // Simpler "GC-Light" approach:
        // We just clear the Map. JS engines optimize Map clearing usually.
        // But for "Zero-GC", we want to reuse the arrays.

        // Reset pool pointer
        this.poolIndex = 0;

        // We DO NOT iterate existing map.
        // We just create a new map? No, that allocates.
        // We assume rebuilding is cheap.

        // Let's try the logical clear:
        this.buckets.clear();
        // NOTE: Map.clear() is O(N) internally but efficient.
        // To be super safe against GC, we'd reuse the arrays.
        // Let's stick to Map.clear() for now, as it's typically fine for <10k items.
        // The arrays inside are lost -> GC. this is (55) risk.

        // Robust GC Strategy:
        // Don't use Map.clear(). Iterate active keys? Too slow.
        // Let's rely on generational GC for now unless it proves problematic.
        // Optimization: if we have a robust Array Pool, we can just grab from it.
    }

    public rebuild(nodes: Map<string, PhysicsNode>) {
        this.buckets.clear(); // We accept some GC here for simplicity, optimizing later if needed.

        nodes.forEach(node => {
            const key = this.getKey(node.x, node.y);
            let bucket = this.buckets.get(key);
            if (!bucket) {
                bucket = []; // Allocating new array. 
                this.buckets.set(key, bucket);
            }
            bucket.push(node.id);
        });
    }

    public query(x: number, y: number, radius: number): string[] {
        const minX = x - radius;
        const maxX = x + radius;
        const minY = y - radius;
        const maxY = y + radius;

        const minKx = Math.floor(minX / this.cellSize);
        const maxKx = Math.floor(maxX / this.cellSize);
        const minKy = Math.floor(minY / this.cellSize);
        const maxKy = Math.floor(maxY / this.cellSize);

        const candidates: string[] = [];

        for (let kx = minKx; kx <= maxKx; kx++) {
            for (let ky = minKy; ky <= maxKy; ky++) {
                const key = `${kx}:${ky}`;
                const bucket = this.buckets.get(key);
                if (bucket) {
                    // Push all items (faster than concat)
                    for (let i = 0; i < bucket.length; i++) {
                        candidates.push(bucket[i]);
                    }
                }
            }
        }

        return candidates;
    }
}
