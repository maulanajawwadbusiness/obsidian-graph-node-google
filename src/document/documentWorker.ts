/**
 * Web Worker for document parsing
 * Runs heavy parsing operations off the main thread to prevent UI blocking
 */

import { TextParser } from './parsers/textParser';
import { DocxParser } from './parsers/docxParser';
import { PdfParser } from './parsers/pdfParser';
import type { ParsedDocument } from './types';

// Worker message types
type WorkerRequest = {
    type: 'PARSE';
    requestId: string;
    file: File;
};

type WorkerResponse =
    | { type: 'PROGRESS'; requestId: string; percent: number }
    | { type: 'COMPLETE'; requestId: string; document: ParsedDocument }
    | { type: 'ERROR'; requestId: string; error: string };

// Available parsers
const parsers = [
    new TextParser(),
    new DocxParser(),
    new PdfParser()
];

// Message handler
self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
    const { type, requestId, file } = e.data;

    if (type !== 'PARSE') {
        postResponse({ type: 'ERROR', requestId, error: 'Unknown request type' });
        return;
    }

    try {
        // Find parser that can handle this file
        const parser = parsers.find(p => p.canHandle(file));

        if (!parser) {
            postResponse({
                type: 'ERROR',
                requestId,
                error: `No parser available for file type: ${file.type || file.name}`
            });
            return;
        }

        // Parse the file
        const document = await parser.parse(file);

        // Send completion
        postResponse({ type: 'COMPLETE', requestId, document });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown parsing error';
        postResponse({ type: 'ERROR', requestId, error: errorMessage });
    }
};

function postResponse(response: WorkerResponse) {
    self.postMessage(response);
}

// Export empty object to make this a module
export { };
