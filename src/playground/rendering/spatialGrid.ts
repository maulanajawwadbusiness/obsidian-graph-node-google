export class SpatialGrid {
    private cellSize: number;
    private buckets: Map<number, number[]>;
    // Cache array reuse to reduce GC
    private arrayPool: number[][] = [];
    private poolIndex: number = 0;

    constructor(cellSize: number = 100) {
        this.cellSize = cellSize;
        this.buckets = new Map();
    }

    public clear() {
        // Return arrays to pool logic? 
        // Simpler: iterate buckets, clear them (length=0), keep them in map?
        // Actually, just clearing the map is cleaner but allocs new buckets.
        // Let's reuse arrays.
        for (const bucket of this.buckets.values()) {
            bucket.length = 0;
            if (this.poolIndex < this.arrayPool.length) {
                this.arrayPool[this.poolIndex] = bucket;
            } else {
                this.arrayPool.push(bucket);
            }
            this.poolIndex++;
        }
        this.buckets.clear();
        // Reset pool index for next frame use? No, wait.
        // We put them INTO the pool.
        // When we need a bucket, we take from pool.
    }

    private getKey(x: number, y: number): number {
        // Int32 hash: key = (x & 0xFFFF) | ((y & 0xFFFF) << 16)
        // Works fine for reasonable coordinate ranges.
        // Shift x, y to positive domain if usage implies logic, 
        // but bitwise on floats truncates toward zero.
        // We use Math.floor
        const cx = Math.floor(x / this.cellSize);
        const cy = Math.floor(y / this.cellSize);
        // Scramble to reduce collisions if needed, but simple shift is usually fine for visual grid
        // Limit to 16 bits to fit in SMI.
        return ((cx & 0xFFFF) << 16) | (cy & 0xFFFF);
    }

    public add(x: number, y: number, index: number) {
        const key = this.getKey(x, y);
        let bucket = this.buckets.get(key);
        if (!bucket) {
            if (this.poolIndex > 0) {
                this.poolIndex--;
                bucket = this.arrayPool[this.poolIndex];
            } else {
                bucket = [];
            }
            this.buckets.set(key, bucket);
        }
        bucket.push(index);
    }

    public query(x: number, y: number, callback: (index: number) => void) {
        const key = this.getKey(x, y);
        // Check center and 8 neighbors
        // ... Or just checking center for point hit? 
        // Nodes have radius. We need neighbors.

        // Optimize: just iterate 3x3
        const cx = Math.floor(x / this.cellSize);
        const cy = Math.floor(y / this.cellSize);

        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                const k = (((cx + dx) & 0xFFFF) << 16) | ((cy + dy) & 0xFFFF);
                const bucket = this.buckets.get(k);
                if (bucket) {
                    for (let i = 0; i < bucket.length; i++) {
                        callback(bucket[i]);
                    }
                }
            }
        }
    }
}
