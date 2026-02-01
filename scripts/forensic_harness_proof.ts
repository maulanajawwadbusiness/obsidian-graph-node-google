
import { PhysicsEngine } from '../src/physics/engine';
import { ForceConfig } from '../src/physics/types';
import { DEFAULT_PHYSICS_CONFIG } from '../src/physics/config';

// Polyfill removed (Node 22 has native performance)

type ScenarioResult = {
    name: string;
    dtMin: number; dtAvg: number; dtMax: number;
    overlapAvg: number; overlapMax: number;
    repulsionClampsAvg: number;
    pbdCorrAvg: number; pbdCorrMax: number;
    speedAvg: number; speedMax: number;
    gateActiveAvg: number;
};

const runScenario = (
    name: string,
    nodeCount: number,
    durationSeconds: number,
    forcePBD: boolean
): ScenarioResult => {
    console.log(`\n=== RUN: ${name} (N=${nodeCount}, ForcePBD=${forcePBD}) ===`);

    // 1. Setup Engine
    const config: ForceConfig = { ...DEFAULT_PHYSICS_CONFIG };

    // Override for Proof
    if (forcePBD) {
        config.spacingGateOnEnergy = 1000;
        config.spacingGateOffEnergy = 2000;
        config.spacingGateRampStart = 1000;
        config.spacingGateRampEnd = 0;
        config.spacingGateEnableThreshold = 0; // Always enable
    }

    // Enable Perf Stats
    config.debugPerf = true;

    const engine = new PhysicsEngine(config);

    // 2. Spawn Nodes (Grid 50px)
    // N=20 -> 5x4 grid. 50 * 5 = 250px wide. World is ~2000.
    const gridSize = Math.ceil(Math.sqrt(nodeCount));
    const spacing = 50;

    for (let i = 0; i < nodeCount; i++) {
        const x = (i % gridSize) * spacing;
        const y = Math.floor(i / gridSize) * spacing;
        engine.addNode({
            id: `n${i}`,
            x, y,
            vx: (Math.random() - 0.5) * 10, // Energy ~8
            vy: (Math.random() - 0.5) * 10,
            fx: 0, fy: 0,
            mass: 1,
            radius: 10,
            isFixed: false
        });
    }

    // 3. Run Loop
    const hz = 60;
    const dt = 1.0 / hz;
    const totalFrames = durationSeconds * hz;

    const stats = {
        dt: [] as number[],
        overlap: [] as number[],
        repulsionClamps: [] as number[],
        pbdAvg: [] as number[],
        pbdMax: [] as number[],
        speed: [] as number[],
        gate: [] as number[]
    };

    for (let f = 0; f < totalFrames; f++) {
        const start = performance.now();
        engine.tick(dt);
        const end = performance.now();

        const debug = engine.getDebugStats();
        const nodes = engine.getNodeList();

        // Metrics
        stats.dt.push(end - start); // Actual JS time, not physics dt

        if (debug) {
            stats.overlap.push(debug.safety.penetrationCount);
            stats.repulsionClamps.push(debug.safety.repulsionClampedCount);

            // PBD Stats
            const spacer = debug.passes['SpacingConstraints'];
            const safety = debug.passes['SafetyClamp'];

            const totalCorr = (spacer?.correction || 0) + (safety?.correction || 0);
            const count = (spacer?.nodes || 0) + (safety?.nodes || 0);
            stats.pbdAvg.push(count > 0 ? totalCorr / count : 0);
            stats.pbdMax.push(Math.max(spacer?.correctionMax || 0, 0)); // Safety stats don't track max explicitly in my interface, relying on spacer

            stats.gate.push(engine['spacingGate'] || 0);
        }

        let avgSpeed = 0;
        let maxSpeed = 0;
        for (const n of nodes) {
            const s = Math.sqrt(n.vx * n.vx + n.vy * n.vy);
            avgSpeed += s;
            if (s > maxSpeed) maxSpeed = s;
        }
        stats.speed.push(avgSpeed / nodes.length);
    }

    const calc = (arr: number[]) => {
        if (arr.length === 0) return { min: 0, max: 0, avg: 0 };
        let sum = 0, min = arr[0], max = arr[0];
        for (const v of arr) {
            sum += v;
            if (v < min) min = v;
            if (v > max) max = v;
        }
        return { min, max, avg: sum / arr.length };
    };

    const dtS = calc(stats.dt);
    const ovS = calc(stats.overlap);
    const rpS = calc(stats.repulsionClamps);
    const pbdAS = calc(stats.pbdAvg);
    const pbdMS = calc(stats.pbdMax);
    const spS = calc(stats.speed);
    const gateS = calc(stats.gate);

    return {
        name,
        dtMin: dtS.min, dtAvg: dtS.avg, dtMax: dtS.max,
        overlapAvg: ovS.avg, overlapMax: ovS.max,
        repulsionClampsAvg: rpS.avg,
        pbdCorrAvg: pbdAS.avg, pbdCorrMax: pbdMS.max,
        speedAvg: spS.avg, speedMax: spS.max,
        gateActiveAvg: gateS.avg
    };
};

const printResult = (r: ScenarioResult) => {
    console.log(`\nRESULTS: ${r.name}`);
    console.log(`  dt(ms):       Min=${r.dtMin.toFixed(2)} Avg=${r.dtAvg.toFixed(2)} Max=${r.dtMax.toFixed(2)}`);
    console.log(`  Speed(px/f):  Avg=${r.speedAvg.toFixed(2)} Max=${r.speedMax.toFixed(2)}`);
    console.log(`  Overlap:      Avg=${r.overlapAvg.toFixed(1)} Max=${r.overlapMax.toFixed(0)}`);
    console.log(`  RepelClamps:  Avg=${r.repulsionClampsAvg.toFixed(2)}`);
    console.log(`  PBD Corr(px): Avg=${r.pbdCorrAvg.toFixed(4)} Max=${r.pbdCorrMax.toFixed(4)}`);
    console.log(`  Gate(0-1):    Avg=${r.gateActiveAvg.toFixed(2)}`);
};

// 4. Execution Plan
const results = [];
try {
    results.push(runScenario("Baseline N=5", 5, 1, false));
    results.push(runScenario("Baseline N=20", 20, 1, false));
    results.push(runScenario("ForcedPBD N=20", 20, 1, true)); // Proof of Life
} catch (e) {
    console.error("CRASH:", e);
}

console.log("\n=== FINAL SUMMARY TABLE ===");
console.log("| Scenario | dt(ms) | Speed | Overlap | PBD Avg | PBD Max | Gate |");
console.log("| :--- | :--- | :--- | :--- | :--- | :--- | :--- |");
results.forEach(r => {
    console.log(`| ${r.name} | ${r.dtAvg.toFixed(2)} | ${r.speedAvg.toFixed(1)} | ${r.overlapAvg.toFixed(1)} | ${r.pbdCorrAvg.toFixed(4)} | ${r.pbdCorrMax.toFixed(4)} | ${r.gateActiveAvg.toFixed(2)} |`);
});
