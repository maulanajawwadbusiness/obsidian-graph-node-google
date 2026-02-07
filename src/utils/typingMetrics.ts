export function nowMs(): number {
    return performance.now();
}

export function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

export function avg(nums: number[]): number {
    if (nums.length === 0) return 0;
    let sum = 0;
    for (let i = 0; i < nums.length; i += 1) {
        sum += nums[i];
    }
    return sum / nums.length;
}

function pickQuantile(sorted: number[], q: number): number {
    if (sorted.length === 0) return 0;
    const index = Math.floor(clamp(q, 0, 1) * (sorted.length - 1));
    return sorted[index];
}

export function quantiles(nums: number[]): {
    p50: number;
    p90: number;
    p95: number;
    p99: number;
    max: number;
} {
    if (nums.length === 0) {
        return { p50: 0, p90: 0, p95: 0, p99: 0, max: 0 };
    }
    const sorted = [...nums].sort((a, b) => a - b);
    return {
        p50: pickQuantile(sorted, 0.5),
        p90: pickQuantile(sorted, 0.9),
        p95: pickQuantile(sorted, 0.95),
        p99: pickQuantile(sorted, 0.99),
        max: sorted[sorted.length - 1],
    };
}
