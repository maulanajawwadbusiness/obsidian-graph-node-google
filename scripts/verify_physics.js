
const { createPhysicsEngine } = require('../src/physics/engine/engine');
const { runPhysicsTick } = require('../src/physics/engine/engineTick');

// Mock Config
const config = {
    initStrategy: 'standard',
    minNodeDistance: 30,
    linkRestLength: 45,
    maxCorrectionPerFrame: 1.5,
    debugPerf: false
};

const runTest = (n, links) => {
    console.log(`\n=== Testing N=${n} ===`);
    const engine = createPhysicsEngine(config, 800, 600);

    // Add Nodes
    for (let i = 0; i < n; i++) {
        engine.addNode({ id: `n${i}`, x: Math.random() * 800, y: Math.random() * 600 });
    }
    // Add Links (Chain)
    for (let i = 0; i < n - 1; i++) {
        engine.links.push({ source: `n${i}`, target: `n${i + 1}` });
    }

    // Run 100 frames
    const scalars = [];
    for (let i = 0; i < 100; i++) {
        runPhysicsTick(engine, 0.016);
        if (i % 20 === 0) {
            console.log(`Frame ${i}: Degrade=${engine.degradeLevel.toFixed(3)} Settle=${engine.hudSettleState}`);
            scalars.push(engine.degradeLevel);
        }
    }

    return scalars;
};

// Run Scenarios
runTest(5, 4);
runTest(200, 199);
runTest(500, 499);
