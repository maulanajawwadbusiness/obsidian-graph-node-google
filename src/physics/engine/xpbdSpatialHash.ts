export class XpbdSpatialHash {
    private cellSize: number;
    private buckets: Map<number, number[]>;
    private arrayPool: number[][] = [];
    private poolIndex: number = 0;

    constructor(cellSize: number = 120) {
        this.cellSize = cellSize;
        this.buckets = new Map();
    }

    public setCellSize(size: number) {
        if (Number.isFinite(size) && size > 0) {
            this.cellSize = size;
        }
    }

    public clear() {
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
    }

    private getKey(x: number, y: number): number {
        const cx = Math.floor(x / this.cellSize);
        const cy = Math.floor(y / this.cellSize);
        return ((cx & 0xffff) << 16) | (cy & 0xffff);
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
        const cx = Math.floor(x / this.cellSize);
        const cy = Math.floor(y / this.cellSize);

        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                const key = (((cx + dx) & 0xffff) << 16) | ((cy + dy) & 0xffff);
                const bucket = this.buckets.get(key);
                if (!bucket) continue;
                for (let i = 0; i < bucket.length; i++) {
                    callback(bucket[i]);
                }
            }
        }
    }
}
