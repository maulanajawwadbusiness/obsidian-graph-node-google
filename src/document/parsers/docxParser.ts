/**
 * DOCX parser using mammoth.js
 * Extracts raw text from Microsoft Word .docx files
 */

import mammoth from 'mammoth';
import type { DocumentParser, ParserTimingCallback } from './types';
import type { ParsedDocument } from '../types';

export class DocxParser implements DocumentParser {
    canHandle(file: File): boolean {
        // Handle DOCX files by MIME type
        if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            return true;
        }

        // Handle by extension for files without MIME type
        const ext = file.name.split('.').pop()?.toLowerCase();
        return ext === 'docx';
    }

    async parse(file: File, onTiming?: ParserTimingCallback): Promise<ParsedDocument> {
        // Convert File to ArrayBuffer for mammoth
        const arrayBuffer = await file.arrayBuffer();
        onTiming?.('file_read_done');

        // Extract raw text using mammoth
        const result = await mammoth.extractRawText({ arrayBuffer });

        const text = result.value;
        onTiming?.('text_extract_done');
        const warnings: string[] = result.messages
            .filter(msg => msg.type === 'warning')
            .map(msg => msg.message);

        // Count words and characters
        const words = text.trim().split(/\s+/).filter(w => w.length > 0);

        return {
            id: crypto.randomUUID(),
            fileName: file.name,
            mimeType: file.type || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            sourceType: 'docx',
            text,
            warnings,
            meta: {
                wordCount: words.length,
                charCount: text.length
            }
        };
    }
}
