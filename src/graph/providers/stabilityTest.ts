/**
 * Stability Test Utilities
 *
 * Tests that provider output is stable regardless of input order.
 *
 * DEV ONLY: Not for production use.
 */

import type { KGSpec } from '../kgSpec';
import { KGSpecProvider } from './KGSpecProvider';
import { hashTopologySnapshot } from './hashUtils';

/**
 * Shuffle an array in place (Fisher-Yates).
 *
 * @param arr Array to shuffle
 * @returns The same array (shuffled)
 */
function mulberry32(seed: number): () => number {
    let t = seed >>> 0;
    return () => {
        t += 0x6D2B79F5;
        let r = Math.imul(t ^ (t >>> 15), 1 | t);
        r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
        return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
}

function shuffleArray<T>(arr: T[], seed: number): T[] {
    const rand = mulberry32(seed);
    const result = [...arr];
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
}

/**
 * Stability test result
 */
export interface StabilityTestResult {
    /** Whether test passed */
    passed: boolean;
    /** Hash of original topology */
    originalHash: string;
    /** Hash of shuffled topology */
    shuffledHash: string;
    /** Number of iterations tested */
    iterations: number;
}

/**
 * Test that KGSpecProvider produces stable output regardless of input order.
 *
 * @param spec Input KGSpec
 * @param iterations Number of shuffle iterations (default: 5)
 * @returns Test result
 */
export function testProviderStability(
    spec: KGSpec,
    iterations = 5
): StabilityTestResult {
    if (!import.meta.env.DEV) {
        console.warn('[StabilityTest] Running in production - should be dev-only');
    }

    // Build original topology
    const originalSnapshot = KGSpecProvider.buildSnapshot(spec);
    const originalHash = hashTopologySnapshot(
        originalSnapshot.nodes,
        originalSnapshot.directedLinks
    );

    console.log(`[StabilityTest] Original hash: ${originalHash}`);

    // Test multiple shuffle iterations
    let allPassed = true;
    for (let i = 0; i < iterations; i++) {
        // Shuffle spec
        const shuffledSpec: KGSpec = {
            ...spec,
            nodes: shuffleArray(spec.nodes, i + 1),
            links: shuffleArray(spec.links, i + 101)
        };

        // Build shuffled topology
        const shuffledSnapshot = KGSpecProvider.buildSnapshot(shuffledSpec);
        const shuffledHash = hashTopologySnapshot(
            shuffledSnapshot.nodes,
            shuffledSnapshot.directedLinks
        );

        const passed = shuffledHash === originalHash;
        console.log(
            `[StabilityTest] Iteration ${i + 1}: hash=${shuffledHash} ` +
            `${passed ? 'PASS' : 'FAIL'}`
        );

        if (!passed) {
            allPassed = false;
        }
    }

    return {
        passed: allPassed,
        originalHash,
        shuffledHash: originalHash, // Same if passed
        iterations
    };
}

/**
 * Run a quick stability test with an example spec.
 *
 * @returns Test result
 */
export function runQuickStabilityTest(): StabilityTestResult {
    console.log('[StabilityTest] Running quick stability test...');

    const testSpec: KGSpec = {
        specVersion: 'kg/1',
        nodes: [
            { id: 'Z' },
            { id: 'A' },
            { id: 'M' },
            { id: 'B' }
        ],
        links: [
            { from: 'A', to: 'B', rel: 'connects', weight: 1.0 },
            { from: 'Z', to: 'M', rel: 'causes', weight: 0.5 },
            { from: 'M', to: 'A', rel: 'supports', weight: 0.8 }
        ]
    };

    return testProviderStability(testSpec, 5);
}
