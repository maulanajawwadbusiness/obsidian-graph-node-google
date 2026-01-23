/**
 * PDF parser using pdfjs-dist
 * Extracts text from PDF documents (text-based only, no OCR)
 */

import * as pdfjsLib from 'pdfjs-dist';
import type { DocumentParser, ParserTimingCallback } from './types';
import type { ParsedDocument } from '../types';

// Configure worker source (using CDN for worker in browser environment)
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

export class PdfParser implements DocumentParser {
    canHandle(file: File): boolean {
        // Handle PDF files by MIME type
        if (file.type === 'application/pdf') {
            return true;
        }

        // Handle by extension for files without MIME type
        const ext = file.name.split('.').pop()?.toLowerCase();
        return ext === 'pdf';
    }

    async parse(file: File, onTiming?: ParserTimingCallback): Promise<ParsedDocument> {
        // Convert File to ArrayBuffer for pdfjs
        const arrayBuffer = await file.arrayBuffer();
        onTiming?.('file_read_done');

        // Load PDF document
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;

        const warnings: string[] = [];
        const textParts: string[] = [];

        // Extract text from all pages
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const textContent = await page.getTextContent();

            // Concatenate text items from this page
            const pageText = textContent.items
                .map((item: any) => {
                    // Check if item has 'str' property (TextItem)
                    return 'str' in item ? item.str : '';
                })
                .join(' ');

            textParts.push(pageText);
        }

        const text = textParts.join('\n\n');
        onTiming?.('text_extract_done');

        // Warn if no text was extracted (likely scanned PDF)
        if (text.trim().length === 0) {
            warnings.push('No text extracted - this may be a scanned PDF requiring OCR');
        }

        // Count words and characters
        const words = text.trim().split(/\s+/).filter(w => w.length > 0);

        return {
            id: crypto.randomUUID(),
            fileName: file.name,
            mimeType: file.type || 'application/pdf',
            sourceType: 'pdf',
            text,
            warnings,
            meta: {
                pages: pdf.numPages,
                wordCount: words.length,
                charCount: text.length
            }
        };
    }
}
