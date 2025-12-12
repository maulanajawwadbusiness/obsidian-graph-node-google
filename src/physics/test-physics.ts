import { PhysicsEngine } from './engine';
import { PhysicsNode } from './types';

const engine = new PhysicsEngine();

// Add two nodes
const n1: PhysicsNode = { id: 'a', x: 0, y: 0, vx: 0, vy: 0, fx: 0, fy: 0, mass: 1, radius: 10, isFixed: false };
const n2: PhysicsNode = { id: 'b', x: 10, y: 0, vx: 0, vy: 0, fx: 0, fy: 0, mass: 1, radius: 10, isFixed: false };

engine.addNode(n1);
engine.addNode(n2);

// Add link
engine.addLink({ source: 'a', target: 'b' });

console.log('Initial State:', n1.x, n2.x);

// Tick
for (let i = 0; i < 100; i++) {
    engine.tick(0.016);
}

console.log('After 100 ticks:', n1.x, n2.x);
console.log('Distance:', Math.abs(n1.x - n2.x));
