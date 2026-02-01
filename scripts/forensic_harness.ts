
import { PhysicsEngine } from '../src/physics/engine';
import { ForceConfig } from '../src/physics/types';
import { DEFAULT_PHYSICS_CONFIG } from '../src/physics/config';

// Polyfill performance.now if needed (Node environment)
if (typeof performance === 'undefined') {
    (global as any).performance = {
        now: () => Date.now()
    };
}

const runTest = (nodeCount: number, durationSeconds: number) => {
    console.log(`\n=== TEST RUN: N=${nodeCount}, T=${durationSeconds}s ===`);

    // 1. Setup Engine
    const engine = new PhysicsEngine({
        ...DEFAULT_PHYSICS_CONFIG,
        // Override strict determinism flags if needed
        debugPerf: true
    });

    // 2. Spawn Nodes (Grid/Cluster)
    const gridSize = Math.ceil(Math.sqrt(nodeCount));
    const spacing = 50;

    for (let i = 0; i < nodeCount; i++) {
        const x = (i % gridSize) * spacing;
        const y = Math.floor(i / gridSize) * spacing;
        engine.addNode({
            id: `n${i}`,
            x, y,
            vx: (Math.random() - 0.5) * 10, // Initial noise
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

    const samples = {
        dt: [] as number[],
        speedSq: [] as number[],
        corrections: [] as number[],
        repulsionEvents: [] as number[],
        overlapCount: [] as number[],
        repelCorrAvg: [] as number[],
        pbdCorrAvg: [] as number[],
        pbdCorrMax: [] as number[]
    };

    console.log(`Config Dump:`, {
        linkRestLength: engine.config.linkRestLength,
        minNodeDistance: engine.config.minNodeDistance,
        repulsionStrength: engine.config.repulsionStrength,
        collisionPadding: engine.config.collisionPadding
    });

    for (let f = 0; f < totalFrames; f++) {
        // Mock time passing
        const frameStart = performance.now();

        // Tick
        engine.tick(dt);

        // Sampling
        const hud = engine.getHudSnapshot();
        const stats = engine.getDebugStats();

        // Store
        samples.dt.push(16.666); // Simulated fixed dt

        let avgSpeedSq = 0;
        const nodes = engine.getNodeList();
        for (const n of nodes) {
            avgSpeedSq += n.vx * n.vx + n.vy * n.vy;
        }
        avgSpeedSq /= (nodes.length || 1);
        samples.speedSq.push(avgSpeedSq);

        samples.corrections.push(hud.pbdCorrectionSum || 0);

        // Detailed PBD Stats
        if (stats) {
            const spacing = stats.passes['SpacingConstraints'];
            const safety = stats.passes['SafetyClamp'];

            // Overlap Count
            samples.overlapCount.push(stats.safety.penetrationCount);

            // Correction Avg/Max
            const spacingCorr = spacing ? spacing.correction : 0;
            const safetyCorr = safety ? safety.correction : 0;
            const totalCorr = spacingCorr + safetyCorr;
            const count = (spacing?.nodes || 0) + (safety?.nodes || 0);

            samples.pbdCorrAvg.push(count > 0 ? totalCorr / count : 0);
            samples.pbdCorrMax.push(spacing?.correctionMax || 0);

            samples.repulsionEvents.push(stats.safety.repulsionClampedCount);
        } else {
            samples.overlapCount.push(0);
            samples.pbdCorrAvg.push(0);
            samples.pbdCorrMax.push(0);
            samples.repulsionEvents.push(0);
        }
    }

    // 4. Summarize
    const calcStats = (arr: number[]) => {
        if (arr.length === 0) return { min: 0, max: 0, avg: 0 };
        return {
            min: Math.min(...arr),
            max: Math.max(...arr),
            avg: arr.reduce((a, b) => a + b, 0) / arr.length
        };
    };

    const speedStats = calcStats(samples.speedSq);
    const corrStats = calcStats(samples.corrections);
    const repelStats = calcStats(samples.repulsionEvents);
    const overlapStats = calcStats(samples.overlapCount);
    const pbdAvgStats = calcStats(samples.pbdCorrAvg);
    const pbdMaxStats = calcStats(samples.pbdCorrMax);

    console.log(`Results:`);
    console.log(`  SpeedSq: Min=${speedStats.min.toFixed(4)} Max=${speedStats.max.toFixed(4)} Avg=${speedStats.avg.toFixed(4)}`);
    console.log(`  PBD Corr Total: Min=${corrStats.min.toFixed(4)} Max=${corrStats.max.toFixed(4)} Avg=${corrStats.avg.toFixed(4)}`);
    console.log(`  PBD Corr Avg/Node: Avg=${pbdAvgStats.avg.toFixed(4)} Max=${pbdAvgStats.max.toFixed(4)}`);
    console.log(`  PBD Corr Peak: Max=${pbdMaxStats.max.toFixed(4)}`);
    console.log(`  Repulsion Clamps: Avg=${repelStats.avg.toFixed(2)}`);
    console.log(`  Overlap Count: Avg=${overlapStats.avg.toFixed(2)} Max=${overlapStats.max.toFixed(0)}`);
};

// Run Scenarios
runTest(5, 5);  // Warmup/Small
runTest(20, 5); // Medium
runTest(60, 5); // Large
