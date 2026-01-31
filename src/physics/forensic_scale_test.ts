
import { PhysicsEngine } from './engine.ts';
import { DEFAULT_PHYSICS_CONFIG } from './config.ts';
import { generateRandomGraph } from '../playground/graphRandom.ts';

// Mock performance if needed (Node 16+ has it globally, but just in case)
const now = () => performance.now();

async function runScenario(n: number, durationTicks: number = 300) {
    console.log(`\n--- SCENARIO N=${n} ---`);

    // 1. Setup
    const config = { ...DEFAULT_PHYSICS_CONFIG };
    // Clone config to avoid mutation pollution
    const engine = new PhysicsEngine(config);

    // 2. Spawn
    const { nodes, links } = generateRandomGraph(n, config.targetSpacing, config.initScale, 12345);
    nodes.forEach(node => engine.addNode(node));
    links.forEach(link => engine.addLink(link));

    console.log(`Spawned ${nodes.length} nodes, ${links.length} links.`);

    // 3. Run Loop
    const dt = 16.666; // 60hz fixed
    const dtSec = dt / 1000;


    let settledAt = -1;
    let maxOvershoot = 0;
    let jitterSum = 0;
    let jitterSamples = 0;
    let pbdDispSum = 0;
    let pbdOpposing = 0;
    let pbdTotalChecks = 0;

    // Fix: Access private energy/perfMode via cast
    const engineAny = engine as any;

    const energyHistory: number[] = [];

    for (let i = 0; i < durationTicks; i++) {
        engine.tick(dtSec);

        // Compute energy manually or grab from secret state if available
        // approximate from lifecycle if needed, or better: read velocity
        // But engineTick claims to compute it.
        // Let's just sum velocity squared as a proxy for Kinetic Energy
        let totalEk = 0;
        for (const node of engine.nodes.values()) {
            totalEk += (node.vx * node.vx + node.vy * node.vy);
        }
        const energy = totalEk / n; // Average kinetic energy per node
        energyHistory.push(energy);

        // Settle check (heuristic)
        if (settledAt === -1 && energy < 0.001) { // Threshold for "visual stillness"
            settledAt = i * dt;
        }

        // Jitter (if settled)
        if (settledAt !== -1) {
            let vSum = 0;
            for (const node of engine.nodes.values()) {
                vSum += Math.sqrt(node.vx * node.vx + node.vy * node.vy);
            }
            const vAvg = vSum / n;
            jitterSum += vAvg;
            jitterSamples++;
        }

        // Overshoot (max radius from center)
        let maxR = 0;
        for (const node of engine.nodes.values()) {
            const r = Math.sqrt(node.x * node.x + node.y * node.y);
            if (r > maxR) maxR = r;
        }
        maxOvershoot = Math.max(maxOvershoot, maxR);

        // PBD Stats Accumulation
        const stats = engine.getDebugStats();
        if (stats && stats.pbd) {
            pbdDispSum += stats.pbd.totalDisplacement;
            pbdOpposing += stats.pbd.opposingCount;
            pbdTotalChecks += (stats.pbd.opposingCount + stats.pbd.alignedCount);
        }
    }

    const jitterAvg = jitterSamples > 0 ? (jitterSum / jitterSamples).toFixed(4) : "N/A";
    const settledText = settledAt !== -1 ? `${settledAt.toFixed(0)}ms` : "NEVER";
    const pbdPerFrame = (pbdDispSum / durationTicks).toFixed(2);
    const conflictRatio = pbdTotalChecks > 0 ? ((pbdOpposing / pbdTotalChecks) * 100).toFixed(1) + "%" : "0%";

    console.log(`Result N=${n}:`);
    console.log(`  Settle Time: ${settledText}`);
    console.log(`  Max Overshoot: ${maxOvershoot.toFixed(1)}px`);
    console.log(`  Rest Jitter: ${jitterAvg} px/frame`);
    console.log(`  Final Energy: ${energyHistory[energyHistory.length - 1].toFixed(4)}`);
    console.log(`  PBD Disp/Frame: ${pbdPerFrame}px`);
    console.log(`  Conflict Ratio: ${conflictRatio} (Corrections opposing Velocity)`);
    console.log(`  Perf Mode: ${engineAny.perfMode}`); // Access private field

    return {
        n,
        settleMs: settledAt,
        maxOvershoot,
        jitterAvg,
        finalEnergy: energyHistory[energyHistory.length - 1],
        pbdPerFrame,
        conflictRatio,
        perfMode: engineAny.perfMode
    };
}


import * as fs from 'fs';

async function main() {
    console.log("Starting Forensic Scale Test...");

    const results = [];
    results.push(await runScenario(5));
    results.push(await runScenario(20));
    results.push(await runScenario(60));

    // Optional stress test
    // await runScenario(250); 



    const fs = await import('fs'); // Dynamic import to be safe with vite-node handle
    const path = await import('path');

    try {
        const outFile = path.resolve(process.cwd(), 'forensic_results.json');
        fs.writeFileSync(outFile, JSON.stringify(results, null, 2));
        console.log(`JSON_WRITTEN to ${outFile}`);
    } catch (e) {
        console.error("FAILED_TO_WRITE_JSON", e);
    }
}

main().catch(err => console.error(err));
