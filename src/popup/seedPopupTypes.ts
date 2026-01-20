/**
 * Seed Popup Interface Contract
 * 
 * Defines the interface for a future pluggable SVG animation module.
 * This module will handle the 4-phase "seed popup" animation:
 * - Phase 0-1: Seed expansion from node
 * - Phase 2-3: Throat elongation
 * - Phase 4: Content reveal (readyReadable)
 * 
 * The normal popup and seed popup will share:
 * - Same popup state machine
 * - Same anchor geometry provider
 * - Same overlay portal space
 */

export type SeedPopupPhase = 0 | 1 | 2 | 3 | 4;

export interface SeedPopupConfig {
    /** Origin point (node center + radius) */
    fromDot: { x: number; y: number; radius: number };

    /** Destination rectangle for final popup */
    toRect: { x: number; y: number; width: number; height: number };

    /** Stable content to render (won't resize during animation) */
    contentNode: React.ReactNode;

    /** Theme preference */
    theme: 'light' | 'dark';

    /** Optional animation duration override (ms) */
    animationDuration?: number;
}

export interface SeedPopupCallbacks {
    /** Called when animation phase changes */
    onPhaseChange?: (phase: SeedPopupPhase) => void;

    /** Called at phase 4 when content is readable and interactive */
    onReadyReadable?: () => void;

    /** Called when popup closes */
    onClose?: () => void;
}

/**
 * Future Seed Popup Module Interface
 * 
 * Implementation will be a separate module that:
 * 1. Creates fullscreen overlay (SVG + masked content host)
 * 2. Runs 60fps rAF animation
 * 3. Emits callbacks for phase changes
 * 4. Only enables pointer events at phase 4
 */
export interface SeedPopupModule {
    /** Open seed popup with animation */
    open(config: SeedPopupConfig, callbacks: SeedPopupCallbacks): void;

    /** Close and cleanup */
    close(): void;

    /** Check if currently open */
    isOpen(): boolean;

    /** Get current phase */
    getCurrentPhase(): SeedPopupPhase;
}

/**
 * Geometry Provider Interface
 * 
 * Both normal and seed popups need consistent geometry from nodes.
 * This interface defines what geometry providers must supply.
 */
export interface NodeGeometryProvider {
    /** Get screen position + radius for a node ID */
    getNodeGeometry(nodeId: string): {
        x: number;      // Screen X
        y: number;      // Screen Y
        radius: number; // Screen radius (accounts for zoom)
    } | null;

    /** Update when camera/node moves (for live tracking) */
    subscribe(callback: () => void): () => void;
}
