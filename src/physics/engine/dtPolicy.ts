export type DtPolicyConfig = {
    minDtMs: number;
    maxDtMs: number;      // Safety Cap (e.g. 50ms)
    spikeDtMs: number;    // Definition of a spike (e.g. 200ms)
    targetHz: number;
};

export type DtPolicyResult = {
    dtUseMs: number;
    dtUseSec: number;
    isSpike: boolean;
    quarantineStrength: number; // 0.0 (Normal) to 1.0 (Full Quarantine)
    substeps: number;
    spikeCount: number;
};

export const DEFAULT_DT_CONFIG: DtPolicyConfig = {
    minDtMs: 2.0,      // Minimum useful step
    maxDtMs: 50.0,     // Cap at 20fps equivalent steps
    spikeDtMs: 150.0,  // Anything > 150ms is suspicious
    targetHz: 60.0
};

// Rolling history for jitter smoothing (EMA)
// We keep this purely functional if possible, but EMA requires state.
// We'll return a helper class or just valid functions.
export class TimePolicy {
    private spikeCounter = 0;
    private quarantineLevel = 0; // 0..1

    get currentQuarantineLevel() { return this.quarantineLevel; }
    get currentSpikeCount() { return this.spikeCounter; }

    constructor(public config: DtPolicyConfig = DEFAULT_DT_CONFIG) { }

    evaluate(dtRawMs: number): DtPolicyResult {
        const { minDtMs, maxDtMs, spikeDtMs } = this.config;

        let dtUseMs = dtRawMs;
        let isSpike = false;

        // 1. Spike Detection
        if (dtRawMs > spikeDtMs) {
            isSpike = true;
            this.spikeCounter++;
            this.quarantineLevel = 1.0;
            // Clamp heavily during spike
            dtUseMs = maxDtMs;
        } else {
            // Decay quarantine
            this.quarantineLevel *= 0.9;
            if (this.quarantineLevel < 0.01) this.quarantineLevel = 0;
        }

        // 2. Safety Clamp
        if (dtUseMs > maxDtMs) {
            dtUseMs = maxDtMs;
        }
        if (dtUseMs < minDtMs) {
            // If too small, effectively zero or skip?
            // For stability, we might clamp UP to minDt or just accept it.
            // Accepting tiny steps is usually fine, just wasteful.
        }

        // 3. Smoothing (EMA) for Logic (Not Integration)
        // Integration should arguably use the clamped "Real" time to keep wall-clock sync.
        // But for "Feel" (damping), filtered DT is nice.
        // However, standard physics engines integrate with `dt`.
        // We will return `dtUseMs` for integration.

        return {
            dtUseMs,
            dtUseSec: dtUseMs / 1000.0,
            isSpike,
            quarantineStrength: this.quarantineLevel,
            substeps: 1, // Future: adaptive substepping
            spikeCount: this.spikeCounter,
        };
    }
}
