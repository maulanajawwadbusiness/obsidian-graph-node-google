/**
 * Text/Markdown parser
 * Handles plain text files (.txt, .md, and other text-based formats)
 */

import type { DocumentParser, ParserTimingCallback } from './types';
import type { ParsedDocument } from '../types';

export class TextParser implements DocumentParser {
    canHandle(file: File): boolean {
        // Handle text files by MIME type
        if (file.type.startsWith('text/')) return true;

        // Handle by extension for files without MIME type
        const ext = file.name.split('.').pop()?.toLowerCase();
        return ext === 'txt' || ext === 'md' || ext === 'markdown';
    }

    async parse(file: File, onTiming?: ParserTimingCallback): Promise<ParsedDocument> {
        const text = await file.text();
        onTiming?.('file_read_done');
        onTiming?.('text_extract_done');
        const words = text.trim().split(/\s+/).filter(w => w.length > 0);

        return {
            id: crypto.randomUUID(),
            fileName: file.name,
            mimeType: file.type || 'text/plain',
            sourceType: file.name.endsWith('.md') || file.name.endsWith('.markdown') ? 'md' : 'txt',
            text,
            warnings: [],
            meta: {
                wordCount: words.length,
                charCount: text.length
            }
        };
    }
}
