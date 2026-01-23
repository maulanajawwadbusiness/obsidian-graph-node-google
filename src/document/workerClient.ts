/**
 * Worker client for main thread
 * Handles communication with the document parsing worker
 */

import type { ParsedDocument } from './types';
import { markDocViewerPerf } from './viewer/docViewerPerf';

type WorkerRequest = {
    type: 'PARSE';
    requestId: string;
    file: File;
};

type WorkerResponse =
    | { type: 'PROGRESS'; requestId: string; percent: number }
    | { type: 'TIMING'; requestId: string; stage: 'file_read_done' | 'text_extract_done' }
    | { type: 'COMPLETE'; requestId: string; document: ParsedDocument }
    | { type: 'ERROR'; requestId: string; error: string };

export class WorkerClient {
    private worker: Worker;
    private pendingRequests: Map<string, {
        resolve: (doc: ParsedDocument) => void;
        reject: (error: Error) => void;
    }> = new Map();

    constructor() {
        // Create worker using Vite's worker import syntax
        this.worker = new Worker(
            new URL('./documentWorker.ts', import.meta.url),
            { type: 'module' }
        );

        // Handle worker messages
        this.worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
            const response = e.data;
            const pending = this.pendingRequests.get(response.requestId);

            if (!pending) {
                console.warn('[WorkerClient] Received response for unknown request:', response.requestId);
                return;
            }

            switch (response.type) {
                case 'PROGRESS':
                    // TODO: Could emit progress events if needed
                    console.log(`[WorkerClient] Progress: ${response.percent}%`);
                    break;
                case 'TIMING':
                    markDocViewerPerf(response.stage);
                    break;

                case 'COMPLETE':
                    this.pendingRequests.delete(response.requestId);
                    pending.resolve(response.document);
                    break;

                case 'ERROR':
                    this.pendingRequests.delete(response.requestId);
                    pending.reject(new Error(response.error));
                    break;
            }
        };

        // Handle worker errors
        this.worker.onerror = (error) => {
            console.error('[WorkerClient] Worker error:', error);
            // Reject all pending requests
            this.pendingRequests.forEach(({ reject }) => {
                reject(new Error('Worker crashed'));
            });
            this.pendingRequests.clear();
        };
    }

    /**
     * Parse a file in the worker
     */
    async parseFile(file: File): Promise<ParsedDocument> {
        const requestId = crypto.randomUUID();

        return new Promise((resolve, reject) => {
            this.pendingRequests.set(requestId, { resolve, reject });

            const request: WorkerRequest = {
                type: 'PARSE',
                requestId,
                file
            };

            this.worker.postMessage(request);
        });
    }

    /**
     * Terminate the worker (cleanup)
     */
    terminate() {
        this.worker.terminate();
        this.pendingRequests.clear();
    }
}
