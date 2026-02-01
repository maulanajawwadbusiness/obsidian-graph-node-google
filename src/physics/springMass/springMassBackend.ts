import type { ForceConfig, PhysicsLink, PhysicsNode } from '../types';
import { getNowMs } from '../engine/engineTime';

type SpringMassWorld = {
    nodes: Map<string, PhysicsNode>;
    links: PhysicsLink[];
    config: ForceConfig;
    getNodeList: () => PhysicsNode[];
};

type SpringMassHudStats = {
    energyProxy: number;
    avgSpeed: number;
    settleState: 'moving' | 'cooling' | 'sleep';
    lastSettleMs: number;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const makeLinkKey = (link: PhysicsLink) => {
    return link.source < link.target ? `${link.source}:${link.target}` : `${link.target}:${link.source}`;
};

export class SpringMassBackend {
    private world: SpringMassWorld | null = null;
    private enabled = false;
    private accumulator = 0;
    private restLengths = new Map<string, number>();
    private fixedDt = 1 / 60;

    private lastEnergyProxy = 0;
    private lastAvgSpeed = 0;
    private settleState: SpringMassHudStats['settleState'] = 'moving';
    private settleStateAtMs = getNowMs();

    bindToWorld(world: SpringMassWorld) {
        if (this.world !== world) {
            this.world = world;
            this.restLengths.clear();
            this.accumulator = 0;
        }
    }

    setEnabled(flag: boolean) {
        if (this.enabled !== flag) {
            this.enabled = flag;
            this.accumulator = 0;
            if (this.world?.config.debugPerf) {
                console.log(`[PhysicsPerf] spring-mass backend ${flag ? 'enabled' : 'disabled'}`);
            }
        }
    }

    step(dtIn: number) {
        if (!this.enabled || !this.world) {
            return;
        }

        const dtFixed = this.fixedDt;
        const maxSteps = Math.max(1, this.world.config.maxStepsPerFrame || 1);
        this.accumulator += dtIn;
        const maxAccum = dtFixed * maxSteps;
        if (this.accumulator > maxAccum) {
            this.accumulator = maxAccum;
        }

        let steps = 0;
        while (this.accumulator >= dtFixed && steps < maxSteps) {
            this.stepFixed(dtFixed);
            this.accumulator -= dtFixed;
            steps += 1;
        }
    }

    getHudStats(): SpringMassHudStats {
        return {
            energyProxy: this.lastEnergyProxy,
            avgSpeed: this.lastAvgSpeed,
            settleState: this.settleState,
            lastSettleMs: Math.max(0, getNowMs() - this.settleStateAtMs)
        };
    }

    private stepFixed(dt: number) {
        if (!this.world) return;

        const { nodes, links, config } = this.world;
        const nodeList = this.world.getNodeList();
        const kSpring = config.springStiffness ?? 0.15;
        const damping = clamp(config.damping ?? 0.9, 0, 1);
        const maxVelocity = Math.max(1, config.maxVelocity ?? 80);
        const maxVelocitySq = maxVelocity * maxVelocity;
        const maxSpringForce = 2400;
        const centerPull = config.gravityCenterStrength ?? 0.002;
        const settleSpeedSq = 0.0004; // ~0.02px/frame

        for (const node of nodeList) {
            node.fx = 0;
            node.fy = 0;
        }

        for (const link of links) {
            const source = nodes.get(link.source);
            const target = nodes.get(link.target);
            if (!source || !target) continue;

            const dx = target.x - source.x;
            const dy = target.y - source.y;
            const lenSq = dx * dx + dy * dy;
            if (lenSq < 1e-12) {
                continue;
            }
            const len = Math.sqrt(lenSq);
            const invLen = 1 / len;
            const dirX = dx * invLen;
            const dirY = dy * invLen;

            const linkRest = link.length;
            let restLength = linkRest;
            if (restLength === undefined) {
                const key = makeLinkKey(link);
                const cached = this.restLengths.get(key);
                if (cached !== undefined) {
                    restLength = cached;
                } else {
                    restLength = len;
                    this.restLengths.set(key, restLength);
                }
            }

            const stretch = len - restLength;
            let forceMag = (link.strength ?? kSpring) * stretch;
            forceMag = clamp(forceMag, -maxSpringForce, maxSpringForce);
            const fx = forceMag * dirX;
            const fy = forceMag * dirY;

            if (!source.isFixed) {
                source.fx += fx;
                source.fy += fy;
            }
            if (!target.isFixed) {
                target.fx -= fx;
                target.fy -= fy;
            }
        }

        for (const node of nodeList) {
            if (node.isFixed) {
                node.vx = 0;
                node.vy = 0;
                continue;
            }
            node.fx += -node.x * centerPull;
            node.fy += -node.y * centerPull;
        }

        let energySum = 0;
        for (const node of nodeList) {
            if (node.isFixed) continue;

            const invMass = node.mass > 0 ? 1 / node.mass : 1;
            const ax = node.fx * invMass;
            const ay = node.fy * invMass;

            node.vx += ax * dt;
            node.vy += ay * dt;

            const vSq = node.vx * node.vx + node.vy * node.vy;
            if (vSq > maxVelocitySq) {
                const scale = maxVelocity / Math.sqrt(vSq);
                node.vx *= scale;
                node.vy *= scale;
            }

            node.x += node.vx * dt;
            node.y += node.vy * dt;

            node.vx *= damping;
            node.vy *= damping;

            const vSqPost = node.vx * node.vx + node.vy * node.vy;
            if (vSqPost < settleSpeedSq) {
                node.vx = 0;
                node.vy = 0;
            }

            energySum += node.vx * node.vx + node.vy * node.vy;
        }

        this.lastEnergyProxy = energySum;
        const count = nodeList.length || 1;
        this.lastAvgSpeed = Math.sqrt(energySum / count);

        const nextState = this.lastAvgSpeed < 0.02 ? 'sleep' : this.lastAvgSpeed < 0.08 ? 'cooling' : 'moving';
        if (nextState !== this.settleState) {
            this.settleState = nextState;
            this.settleStateAtMs = getNowMs();
        }
    }
}
