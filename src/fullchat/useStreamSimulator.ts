import { useState, useRef, useCallback } from 'react';

/**
 * useStreamSimulator - Mock streaming hook for UX development
 * 
 * Reveals text gradually to simulate real LLM streaming.
 * Controlled by speed constants for easy tuning.
 * Can be disabled by setting ENABLE_MOCK_STREAM to false.
 */

// ============================================================================
// TUNING CONSTANTS
// ============================================================================
export const ENABLE_MOCK_STREAM = true;       // Toggle for real backend
const STREAM_SPEED_MS = 25;                   // Interval between reveals
const STREAM_CHUNK_SIZE = 2;                  // Characters revealed per tick
const STREAM_START_DELAY = 300;               // Initial "thinking" delay

// ============================================================================
// HOOK
// ============================================================================

interface UseStreamSimulatorResult {
    startStream: (fullText: string, onUpdate: (text: string) => void, onComplete: () => void) => void;
    stopStream: () => void;
    isStreaming: boolean;
}

export function useStreamSimulator(): UseStreamSimulatorResult {
    const [isStreaming, setIsStreaming] = useState(false);
    const intervalRef = useRef<number | null>(null);
    const timeoutRef = useRef<number | null>(null);

    const stopStream = useCallback(() => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
        setIsStreaming(false);
    }, []);

    const startStream = useCallback((
        fullText: string,
        onUpdate: (text: string) => void,
        onComplete: () => void
    ) => {
        // Clean up any existing stream
        stopStream();

        if (!ENABLE_MOCK_STREAM) {
            // Instant mode - no streaming simulation
            onUpdate(fullText);
            onComplete();
            return;
        }

        setIsStreaming(true);
        let charIndex = 0;

        // Initial delay to simulate "thinking"
        timeoutRef.current = window.setTimeout(() => {
            intervalRef.current = window.setInterval(() => {
                charIndex += STREAM_CHUNK_SIZE;
                const revealedText = fullText.slice(0, charIndex);
                onUpdate(revealedText);

                if (charIndex >= fullText.length) {
                    stopStream();
                    onComplete();
                }
            }, STREAM_SPEED_MS);
        }, STREAM_START_DELAY);
    }, [stopStream]);

    return {
        startStream,
        stopStream,
        isStreaming,
    };
}
