import React from 'react';
import { DEFAULT_PHYSICS_CONFIG } from '../../physics/config';
import { ForceConfig } from '../../physics/types';
import { SIDEBAR_CLOSE_STYLE, SIDEBAR_STYLE } from '../graphPlaygroundStyles';

type SidebarControlsProps = {
    config: ForceConfig;
    onClose: () => void;
    onConfigChange: (key: keyof ForceConfig, value: number) => void;
    onLogPreset: () => void;
    onReset: () => void;
    onSpawn: () => void;
    onToggleVariedSize: (checked: boolean) => void;
    seed: number;
    setSeed: (value: number) => void;
    setSpawnCount: (value: number) => void;
    spawnCount: number;
    useVariedSize: boolean;
};

export const SidebarControls: React.FC<SidebarControlsProps> = ({
    config,
    onClose,
    onConfigChange,
    onLogPreset,
    onReset,
    onSpawn,
    onToggleVariedSize,
    seed,
    setSeed,
    setSpawnCount,
    spawnCount,
    useVariedSize
}) => (
    <div className="gp-sidebar" style={SIDEBAR_STYLE}>
        <button
            type="button"
            style={SIDEBAR_CLOSE_STYLE}
            onClick={onClose}
            aria-label="Close controls"
            title="Close"
        >
            ✕
        </button>

        <h3 style={{ paddingRight: '36px' }}>Physics Playground</h3>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
            <button onClick={onSpawn}>Spawn New</button>
            <button onClick={onReset}>Explode</button>
            <button onClick={onLogPreset} style={{ backgroundColor: '#2a5' }}>Log Preset</button>
        </div>

        <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                    type="checkbox"
                    checked={useVariedSize}
                    onChange={(e) => onToggleVariedSize(e.target.checked)}
                />
                Varied Node Sizes
            </label>
        </div>

        <div>
            <label>Node Count: {spawnCount}</label>
            <input
                type="range" min="10" max="400" step="10"
                value={spawnCount}
                onChange={(e) => setSpawnCount(Number(e.target.value))}
                style={{ width: '100%' }}
            />
        </div>

        <div style={{ marginTop: '12px' }}>
            <label>Seed: {seed}</label>
            <input
                type="number"
                value={seed}
                onChange={(e) => setSeed(Number(e.target.value))}
                style={{ width: '100%', padding: '4px', marginTop: '4px', fontFamily: 'inherit' }}
                placeholder="Enter seed number"
            />
            <div style={{ fontSize: '11px', color: '#888', marginTop: '4px' }}>
                Same seed = identical graph. Click "Spawn New" to use current seed.
            </div>
        </div>

        <hr style={{ border: '0', borderTop: '1px solid #444', width: '100%' }} />

        {Object.keys(DEFAULT_PHYSICS_CONFIG).map((key) => {
            const k = key as keyof ForceConfig;
            const val = config[k];

            // Define ranges broadly for testing
            let min = 0;
            let max = 100;
            let step = 1;

            if (k === 'springStiffness' || k === 'damping' || k === 'gravityCenterStrength' || k === 'restForceScale') {
                max = 1.0;
                step = 0.01;
            }
            if (k === 'formingTime') {
                max = 10.0;
                step = 0.1;
            }
            if (k === 'repulsionStrength' || k === 'boundaryStrength' || k === 'collisionStrength') {
                max = 10000;
                step = 100;
            }
            if (k === 'repulsionDistanceMax' || k === 'springLength' || k === 'boundaryMargin' || k === 'gravityBaseRadius') {
                max = 500;
            }

            return (
                <div key={k}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                        <span>{k}</span>
                        <span>{val}</span>
                    </div>
                    <input
                        type="range"
                        min={min}
                        max={max}
                        step={step}
                        value={val}
                        onChange={(e) => onConfigChange(k, Number(e.target.value))}
                        style={{ width: '100%' }}
                    />
                </div>
            );
        })}
    </div>
);
