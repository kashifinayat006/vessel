/**
 * Text chunking utilities for RAG
 *
 * Splits documents into smaller chunks for embedding and retrieval.
 * Uses overlapping windows to preserve context across chunk boundaries.
 */

import type { DocumentChunk } from './types.js';

/** Default chunk size in characters (roughly ~128 tokens) */
const DEFAULT_CHUNK_SIZE = 512;

/** Default overlap between chunks */
const DEFAULT_OVERLAP = 50;

/** Minimum chunk size to avoid tiny fragments */
const MIN_CHUNK_SIZE = 50;

/**
 * Chunking options
 */
export interface ChunkOptions {
	/** Target chunk size in characters */
	chunkSize?: number;
	/** Overlap between consecutive chunks */
	overlap?: number;
	/** Prefer splitting at sentence boundaries */
	respectSentences?: boolean;
	/** Prefer splitting at paragraph boundaries */
	respectParagraphs?: boolean;
}

/**
 * Split text into overlapping chunks (synchronous version)
 */
export function chunkText(
	text: string,
	documentId: string,
	options: ChunkOptions = {}
): DocumentChunk[] {
	const {
		chunkSize = DEFAULT_CHUNK_SIZE,
		overlap = DEFAULT_OVERLAP,
		respectSentences = true,
		respectParagraphs = true
	} = options;

	if (!text || text.length === 0) {
		return [];
	}

	// For very short texts, return as single chunk
	if (text.length <= chunkSize) {
		return [{
			id: crypto.randomUUID(),
			documentId,
			content: text.trim(),
			startIndex: 0,
			endIndex: text.length
		}];
	}

	const chunks: DocumentChunk[] = [];
	let currentIndex = 0;
	let previousIndex = -1;

	while (currentIndex < text.length) {
		// Prevent infinite loop - if we haven't advanced, we're stuck
		if (currentIndex === previousIndex) {
			break;
		}
		previousIndex = currentIndex;

		// Calculate end position for this chunk
		let endIndex = Math.min(currentIndex + chunkSize, text.length);

		// If not at end of text, try to find a good break point
		if (endIndex < text.length) {
			endIndex = findBreakPoint(text, currentIndex, endIndex, {
				respectSentences,
				respectParagraphs
			});
		}

		// Extract chunk content
		const content = text.slice(currentIndex, endIndex).trim();

		// Only add non-empty chunks above minimum size
		if (content.length >= MIN_CHUNK_SIZE) {
			chunks.push({
				id: crypto.randomUUID(),
				documentId,
				content,
				startIndex: currentIndex,
				endIndex
			});
		}

		// If we've reached the end, we're done
		if (endIndex >= text.length) {
			break;
		}

		// Move to next chunk position (with overlap)
		currentIndex = endIndex - overlap;

		// Safety: ensure we always advance
		if (currentIndex <= previousIndex) {
			currentIndex = previousIndex + 1;
		}
	}

	return chunks;
}

/**
 * Split text into overlapping chunks (async version that yields to event loop)
 * Use this for large files to avoid blocking the UI
 */
export async function chunkTextAsync(
	text: string,
	documentId: string,
	options: ChunkOptions = {}
): Promise<DocumentChunk[]> {
	const {
		chunkSize = DEFAULT_CHUNK_SIZE,
		overlap = DEFAULT_OVERLAP,
		respectSentences = true,
		respectParagraphs = true
	} = options;

	if (!text || text.length === 0) {
		return [];
	}

	// For very short texts, return as single chunk
	if (text.length <= chunkSize) {
		return [{
			id: crypto.randomUUID(),
			documentId,
			content: text.trim(),
			startIndex: 0,
			endIndex: text.length
		}];
	}

	const chunks: DocumentChunk[] = [];
	let currentIndex = 0;
	let iterationCount = 0;
	let previousIndex = -1;

	while (currentIndex < text.length) {
		// Yield every 10 chunks to let UI breathe
		if (iterationCount > 0 && iterationCount % 10 === 0) {
			await new Promise(r => setTimeout(r, 0));
		}
		iterationCount++;

		// Prevent infinite loop - if we haven't advanced, we're stuck
		if (currentIndex === previousIndex) {
			break;
		}
		previousIndex = currentIndex;

		// Calculate end position for this chunk
		let endIndex = Math.min(currentIndex + chunkSize, text.length);

		// If not at end of text, try to find a good break point
		if (endIndex < text.length) {
			endIndex = findBreakPoint(text, currentIndex, endIndex, {
				respectSentences,
				respectParagraphs
			});
		}

		// Extract chunk content
		const content = text.slice(currentIndex, endIndex).trim();

		// Only add non-empty chunks above minimum size
		if (content.length >= MIN_CHUNK_SIZE) {
			chunks.push({
				id: crypto.randomUUID(),
				documentId,
				content,
				startIndex: currentIndex,
				endIndex
			});
		}

		// If we've reached the end, we're done
		if (endIndex >= text.length) {
			break;
		}

		// Move to next chunk position (with overlap)
		currentIndex = endIndex - overlap;

		// Safety: ensure we always advance
		if (currentIndex <= previousIndex) {
			currentIndex = previousIndex + 1;
		}
	}

	return chunks;
}

/**
 * Find a good break point for chunking
 * Prefers paragraph breaks > sentence breaks > word breaks
 */
function findBreakPoint(
	text: string,
	startIndex: number,
	endIndex: number,
	options: { respectSentences: boolean; respectParagraphs: boolean }
): number {
	const searchWindow = text.slice(startIndex, endIndex);
	const windowLength = searchWindow.length;

	// Look for break points in last 20% of chunk
	const searchStart = Math.floor(windowLength * 0.8);

	// Try paragraph break first
	if (options.respectParagraphs) {
		const paragraphBreak = findLastMatchPosition(searchWindow, /\n\s*\n/g, searchStart);
		if (paragraphBreak >= 0) {
			return startIndex + paragraphBreak;
		}
	}

	// Try sentence break
	if (options.respectSentences) {
		const sentenceBreak = findLastMatchPosition(searchWindow, /[.!?]\s+/g, searchStart);
		if (sentenceBreak >= 0) {
			return startIndex + sentenceBreak;
		}
	}

	// Fall back to word break
	const wordBreak = findLastMatchPosition(searchWindow, /\s+/g, searchStart);
	if (wordBreak >= 0) {
		return startIndex + wordBreak;
	}

	// No good break point found, use original end
	return endIndex;
}

/**
 * Find the last match of a pattern after a given position
 * Uses matchAll to find all matches and returns the last one after minPos
 */
function findLastMatchPosition(text: string, pattern: RegExp, minPos: number): number {
	let lastMatch = -1;

	// Use matchAll to iterate through matches
	for (const match of text.matchAll(pattern)) {
		if (match.index !== undefined && match.index >= minPos) {
			// Track position after the match
			lastMatch = match.index + match[0].length;
		}
	}

	return lastMatch;
}

/**
 * Split text by paragraphs (for simpler chunking)
 */
export function splitByParagraphs(text: string): string[] {
	return text
		.split(/\n\s*\n/)
		.map(p => p.trim())
		.filter(p => p.length > 0);
}

/**
 * Split text by sentences
 */
export function splitBySentences(text: string): string[] {
	// Simple sentence splitting (handles common cases)
	return text
		.split(/(?<=[.!?])\s+/)
		.map(s => s.trim())
		.filter(s => s.length > 0);
}

/**
 * Estimate token count for a chunk
 */
export function estimateChunkTokens(text: string): number {
	// Rough estimate: ~4 characters per token
	return Math.ceil(text.length / 4);
}

/**
 * Merge very small adjacent chunks
 */
export function mergeSmallChunks(
	chunks: DocumentChunk[],
	minSize: number = MIN_CHUNK_SIZE * 2
): DocumentChunk[] {
	if (chunks.length <= 1) return chunks;

	const merged: DocumentChunk[] = [];
	let currentChunk: DocumentChunk | null = null;

	for (const chunk of chunks) {
		if (currentChunk === null) {
			currentChunk = { ...chunk };
			continue;
		}

		if (currentChunk.content.length + chunk.content.length < minSize) {
			// Merge with current
			currentChunk = {
				id: currentChunk.id,
				documentId: currentChunk.documentId,
				content: currentChunk.content + '\n\n' + chunk.content,
				startIndex: currentChunk.startIndex,
				endIndex: chunk.endIndex,
				embedding: currentChunk.embedding,
				metadata: currentChunk.metadata
			};
		} else {
			// Push current and start new
			merged.push(currentChunk);
			currentChunk = { ...chunk };
		}
	}

	if (currentChunk) {
		merged.push(currentChunk);
	}

	return merged;
}
