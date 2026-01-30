import React, { useEffect, useRef, useState } from 'react';
import { PhysicsEngine } from '../../physics/engine';

const COMPASS_STYLE: React.CSSProperties = {
    position: 'absolute',
    bottom: '20px',
    right: '20px',
    width: '40px',
    height: '40px',
    pointerEvents: 'none',
    zIndex: 100,
    opacity: 0.8,
    transition: 'opacity 0.3s ease',
};

const RING_STYLE: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    borderRadius: '50%',
    border: '2px solid rgba(128, 128, 128, 0.3)',
    boxSizing: 'border-box',
};

// North indicator (Red)
const NEEDLE_STYLE: React.CSSProperties = {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: '2px',
    height: '14px',
    background: 'linear-gradient(to top, rgba(255,100,100,0) 0%, rgba(255,50,50,1) 100%)',
    transformOrigin: 'bottom center',
    transform: 'translate(-50%, -100%)', // Tip points up
};

// Label style
const TEXT_STYLE: React.CSSProperties = {
    position: 'absolute',
    bottom: '-20px',
    width: '100%',
    textAlign: 'center',
    color: 'rgba(128, 128, 128, 0.6)',
    fontFamily: 'monospace',
    fontSize: '10px',
};

type Props = {
    engineRef: React.RefObject<PhysicsEngine>;
};

export const RotationCompass: React.FC<Props> = ({ engineRef }) => {
    const [angle, setAngle] = useState(0);
    const frameRef = useRef(0);

    useEffect(() => {
        const tick = () => {
            if (engineRef.current) {
                // Engine angle is Radians CCW.
                // Screen rotation is +angle => CCW rotation of world.
                // So "North" (screen UP) relates to world UP by -angle.
                // If world rotates +90 (CCW), then "Up" in world space is -90 (Left) on screen?
                // Wait.
                // CameraTransform: rotate(angle).
                // Screen = Rotate(World).
                // If World Up is (0, -1).
                // Rotate(+90) -> x = -1*-sin(90) = -1. y = -1*cos(90) = 0.
                // So World Up becomes (-1, 0) which is Screen Left.
                // So the "North" needle should point Left.
                // Visual rotation = +90 deg (CW) or -90 (CCW)?
                // CSS Rotate is CW.
                // If I want the needle to point to "World North", and "World North" is at Screen Left...
                // That means the needle must rotate -90deg.
                // So Needle Angle = -Engine Angle.

                setAngle(engineRef.current.getGlobalAngle());
            }
            frameRef.current = requestAnimationFrame(tick);
        };
        frameRef.current = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frameRef.current);
    }, []);

    // Threshold for visibility: only show if meaningful rotation (> 1 degree)
    // Actually, let's always show it if user wants to know orientation, 
    // but maybe dim it if near zero.
    // User asked for "instantly realize... direction doesn't feel wrong".
    // 1 deg is imperceptible. > 3 deg is visible.
    const isVisible = Math.abs(angle) > 0.05;

    // Convert rads to degrees for display
    const deg = (angle * 180 / Math.PI) % 360;

    // Needle rotation: -angle (Counter-rotate against camera)
    const needleRot = -angle;

    return (
        <div style={{ ...COMPASS_STYLE, opacity: isVisible ? 0.8 : 0 }}>
            {/* Static Ring */}
            <div style={RING_STYLE} />

            {/* Rotating World Frame (Needle points World Up) */}
            <div style={{
                ...NEEDLE_STYLE,
                transform: `translate(-50%, -100%) rotate(${needleRot}rad)`
            }} />

            {/* Axis hints (optional tiny cross) */}
            <div style={{
                position: 'absolute', top: '50%', left: '50%',
                width: '4px', height: '4px', background: 'rgba(128,128,128,0.5)',
                borderRadius: '50%', transform: 'translate(-50%, -50%)'
            }} />

            <div style={TEXT_STYLE}>
                {Math.round(deg)}°
            </div>
        </div>
    );
};
