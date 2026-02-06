import { useState, useEffect } from 'react';

let fullscreenControllerSingleton: FullscreenController | null = null;

export class FullscreenController {
    private isFullscreenState: boolean = false;
    private listeners: Set<(isFullscreen: boolean) => void> = new Set();

    constructor() {
        if (typeof document === 'undefined') return;

        this.isFullscreenState = !!document.fullscreenElement;

        const handleFullscreenChange = () => {
            this.isFullscreenState = !!document.fullscreenElement;
            this.notifyListeners();
        };

        document.addEventListener('fullscreenchange', handleFullscreenChange);
    }

    get isFullscreen(): boolean {
        return this.isFullscreenState;
    }

    subscribe(callback: (isFullscreen: boolean) => void): () => void {
        this.listeners.add(callback);
        return () => {
            this.listeners.delete(callback);
        };
    }

    private notifyListeners(): void {
        this.listeners.forEach((cb) => cb(this.isFullscreenState));
    }

    async enterFullscreen(): Promise<void> {
        if (typeof document === 'undefined') return;
        if (this.isFullscreenState) return;

        try {
            await document.documentElement.requestFullscreen();
        } catch (e) {
            console.warn('[fullscreen] Failed to enter fullscreen:', e);
            throw e;
        }
    }

    async exitFullscreen(): Promise<void> {
        if (typeof document === 'undefined') return;
        if (!this.isFullscreenState) return;

        try {
            await document.exitFullscreen();
        } catch (e) {
            console.warn('[fullscreen] Failed to exit fullscreen:', e);
            throw e;
        }
    }

    async toggleFullscreen(): Promise<void> {
        if (this.isFullscreenState) {
            await this.exitFullscreen();
        } else {
            await this.enterFullscreen();
        }
    }
}

export function useFullscreen(): {
    isFullscreen: boolean;
    enterFullscreen: () => Promise<void>;
    exitFullscreen: () => Promise<void>;
    toggleFullscreen: () => Promise<void>;
} {
    const [controller] = useState(() => {
        if (!fullscreenControllerSingleton) {
            fullscreenControllerSingleton = new FullscreenController();
        }
        return fullscreenControllerSingleton;
    });

    const [isFullscreen, setIsFullscreen] = useState(controller.isFullscreen);

    useEffect(() => {
        const unsubscribe = controller.subscribe((isFs) => {
            setIsFullscreen(isFs);
        });

        return unsubscribe;
    }, [controller]);

    return {
        isFullscreen,
        enterFullscreen: () => controller.enterFullscreen(),
        exitFullscreen: () => controller.exitFullscreen(),
        toggleFullscreen: () => controller.toggleFullscreen(),
    };
}
