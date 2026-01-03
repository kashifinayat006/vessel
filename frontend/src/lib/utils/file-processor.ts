/**
 * File processor utility
 * Handles reading, processing, and extracting content from files
 * Supports images, text files, and PDFs
 */

import type {
	AttachmentType,
	FileAttachment,
	ProcessFileOutcome
} from '$lib/types/attachment.js';
import {
	isImageMimeType,
	isTextMimeType,
	isPdfMimeType,
	isTextExtension,
	MAX_IMAGE_SIZE,
	MAX_TEXT_SIZE,
	MAX_PDF_SIZE,
	MAX_IMAGE_DIMENSION,
	MAX_EXTRACTED_CONTENT
} from '$lib/types/attachment.js';

// ============================================================================
// File Type Detection
// ============================================================================

/**
 * Detect the attachment type for a file
 * @returns The attachment type or null if unsupported
 */
export function detectFileType(file: File): AttachmentType | null {
	const mimeType = file.type.toLowerCase();

	if (isImageMimeType(mimeType)) {
		return 'image';
	}

	if (isPdfMimeType(mimeType)) {
		return 'pdf';
	}

	if (isTextMimeType(mimeType)) {
		return 'text';
	}

	// Check by extension as fallback
	if (isTextExtension(file.name)) {
		return 'text';
	}

	return null;
}

// ============================================================================
// Content Truncation
// ============================================================================

/**
 * Result of content truncation
 */
interface TruncateResult {
	content: string;
	truncated: boolean;
	originalLength: number;
}

/**
 * Truncate content to maximum allowed length
 * Tries to truncate at a natural boundary (newline or space)
 */
function truncateContent(content: string, maxLength: number = MAX_EXTRACTED_CONTENT): TruncateResult {
	const originalLength = content.length;

	if (originalLength <= maxLength) {
		return { content, truncated: false, originalLength };
	}

	// Try to find a natural break point (newline or space) near the limit
	let cutPoint = maxLength;
	const searchStart = Math.max(0, maxLength - 500);

	// Look for last newline before cutoff
	const lastNewline = content.lastIndexOf('\n', maxLength);
	if (lastNewline > searchStart) {
		cutPoint = lastNewline;
	} else {
		// Look for last space
		const lastSpace = content.lastIndexOf(' ', maxLength);
		if (lastSpace > searchStart) {
			cutPoint = lastSpace;
		}
	}

	const truncatedContent = content.slice(0, cutPoint) +
		`\n\n[... content truncated: ${formatFileSize(originalLength)} total, showing first ${formatFileSize(cutPoint)} ...]`;

	return {
		content: truncatedContent,
		truncated: true,
		originalLength
	};
}

// ============================================================================
// Text File Processing
// ============================================================================

/**
 * Read a text file and return its content with truncation info
 */
export async function readTextFile(file: File): Promise<TruncateResult> {
	if (file.size > MAX_TEXT_SIZE) {
		throw new Error(`File too large. Maximum size is ${MAX_TEXT_SIZE / 1024 / 1024}MB`);
	}

	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => {
			const rawContent = reader.result as string;
			resolve(truncateContent(rawContent));
		};
		reader.onerror = () => reject(new Error('Failed to read file'));
		reader.readAsText(file);
	});
}

// ============================================================================
// Image Processing
// ============================================================================

/**
 * Process an image file: resize if needed, compress, and return base64
 */
export async function processImage(file: File): Promise<{ base64: string; previewUrl: string }> {
	if (file.size > MAX_IMAGE_SIZE * 5) {
		// Allow larger initial size, we'll compress
		throw new Error(`Image too large. Maximum size is ${(MAX_IMAGE_SIZE * 5) / 1024 / 1024}MB`);
	}

	return new Promise((resolve, reject) => {
		const img = new Image();
		const objectUrl = URL.createObjectURL(file);

		img.onload = () => {
			URL.revokeObjectURL(objectUrl);

			// Calculate new dimensions
			let { width, height } = img;
			if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
				const ratio = Math.min(MAX_IMAGE_DIMENSION / width, MAX_IMAGE_DIMENSION / height);
				width = Math.round(width * ratio);
				height = Math.round(height * ratio);
			}

			// Draw to canvas and compress
			const canvas = document.createElement('canvas');
			canvas.width = width;
			canvas.height = height;

			const ctx = canvas.getContext('2d');
			if (!ctx) {
				reject(new Error('Failed to create canvas context'));
				return;
			}

			ctx.drawImage(img, 0, 0, width, height);

			// Get as JPEG for compression (better than PNG for most cases)
			const quality = 0.85;
			const dataUrl = canvas.toDataURL('image/jpeg', quality);

			// Extract base64 without the data: prefix (Ollama requirement)
			const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '');

			resolve({
				base64,
				previewUrl: dataUrl
			});
		};

		img.onerror = () => {
			URL.revokeObjectURL(objectUrl);
			reject(new Error('Failed to load image'));
		};

		img.src = objectUrl;
	});
}

// ============================================================================
// PDF Processing
// ============================================================================

// PDF.js will be loaded dynamically when needed
let pdfjsLib: typeof import('pdfjs-dist') | null = null;

/**
 * Load PDF.js library dynamically
 */
async function loadPdfJs(): Promise<typeof import('pdfjs-dist')> {
	if (pdfjsLib) return pdfjsLib;

	try {
		pdfjsLib = await import('pdfjs-dist');

		// Use locally bundled worker (copied to static/ during build)
		// Falls back to CDN if local worker isn't available
		const localWorkerPath = '/pdf.worker.min.mjs';
		const cdnWorkerPath = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

		// Try local first, with CDN fallback
		try {
			const response = await fetch(localWorkerPath, { method: 'HEAD' });
			pdfjsLib.GlobalWorkerOptions.workerSrc = response.ok ? localWorkerPath : cdnWorkerPath;
		} catch {
			pdfjsLib.GlobalWorkerOptions.workerSrc = cdnWorkerPath;
		}

		return pdfjsLib;
	} catch (error) {
		throw new Error('PDF.js library not available. Install with: npm install pdfjs-dist');
	}
}

/**
 * Extract text content from a PDF file with error handling and content limits
 */
export async function extractPdfText(file: File): Promise<TruncateResult> {
	if (file.size > MAX_PDF_SIZE) {
		throw new Error(`PDF too large. Maximum size is ${MAX_PDF_SIZE / 1024 / 1024}MB`);
	}

	const pdfjs = await loadPdfJs();

	const arrayBuffer = await file.arrayBuffer();
	const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;

	const textParts: string[] = [];
	let totalChars = 0;
	let stoppedEarly = false;
	const failedPages: number[] = [];

	for (let i = 1; i <= pdf.numPages; i++) {
		// Stop if we've already collected enough content
		if (totalChars >= MAX_EXTRACTED_CONTENT) {
			stoppedEarly = true;
			break;
		}

		try {
			const page = await pdf.getPage(i);
			const textContent = await page.getTextContent();

			// Null check for textContent.items
			if (!textContent?.items) {
				console.warn(`PDF page ${i}: No text content items`);
				failedPages.push(i);
				continue;
			}

			const pageText = textContent.items
				.filter((item): item is import('pdfjs-dist/types/src/display/api').TextItem =>
					'str' in item && typeof item.str === 'string'
				)
				.map((item) => item.str)
				.join(' ')
				.trim();

			if (pageText) {
				textParts.push(pageText);
				totalChars += pageText.length;
			}
		} catch (pageError) {
			console.warn(`PDF page ${i} extraction failed:`, pageError);
			failedPages.push(i);
			// Continue with other pages instead of failing entirely
		}
	}

	let rawContent = textParts.join('\n\n');

	// Add metadata about extraction issues
	const metadata: string[] = [];
	if (failedPages.length > 0) {
		metadata.push(`[Note: Failed to extract pages: ${failedPages.join(', ')}]`);
	}
	if (stoppedEarly) {
		metadata.push(`[Note: Extraction stopped at page ${textParts.length} of ${pdf.numPages} due to content limit]`);
	}

	if (metadata.length > 0) {
		rawContent = metadata.join('\n') + '\n\n' + rawContent;
	}

	return truncateContent(rawContent);
}

// ============================================================================
// Main Processing Function
// ============================================================================

/**
 * Process a file and create an attachment
 * Handles all file types (image, text, PDF)
 */
export async function processFile(file: File): Promise<ProcessFileOutcome> {
	const type = detectFileType(file);

	if (!type) {
		return {
			success: false,
			error: `Unsupported file type: ${file.type || 'unknown'}`
		};
	}

	const id = crypto.randomUUID();

	try {
		const baseAttachment: FileAttachment = {
			id,
			type,
			filename: file.name,
			mimeType: file.type,
			size: file.size
		};

		switch (type) {
			case 'image': {
				const { base64, previewUrl } = await processImage(file);
				return {
					success: true,
					attachment: {
						...baseAttachment,
						base64Data: base64,
						previewUrl,
						originalFile: file
					}
				};
			}

			case 'text': {
				const result = await readTextFile(file);
				return {
					success: true,
					attachment: {
						...baseAttachment,
						textContent: result.content,
						truncated: result.truncated,
						originalLength: result.originalLength,
						originalFile: file
					}
				};
			}

			case 'pdf': {
				const result = await extractPdfText(file);
				return {
					success: true,
					attachment: {
						...baseAttachment,
						textContent: result.content,
						truncated: result.truncated,
						originalLength: result.originalLength,
						originalFile: file
					}
				};
			}

			default:
				return {
					success: false,
					error: `Unsupported file type: ${type}`
				};
		}
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Unknown error processing file'
		};
	}
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
	if (bytes < 1024) {
		return `${bytes} B`;
	}
	if (bytes < 1024 * 1024) {
		return `${(bytes / 1024).toFixed(1)} KB`;
	}
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Get a file icon based on type
 */
export function getFileIcon(type: AttachmentType): string {
	switch (type) {
		case 'image':
			return '🖼️';
		case 'pdf':
			return '📄';
		case 'text':
			return '📝';
		default:
			return '📎';
	}
}

/**
 * Format attachment content for inclusion in message
 * Uses XML-style tags for cleaner parsing by LLMs
 */
export function formatAttachmentsForMessage(attachments: FileAttachment[]): string {
	return attachments
		.filter((a) => a.textContent)
		.map((a) => {
			const truncatedAttr = a.truncated ? ' truncated="true"' : '';
			const sizeAttr = ` size="${formatFileSize(a.size)}"`;
			return `<file name="${escapeXmlAttr(a.filename)}"${sizeAttr}${truncatedAttr}>\n${a.textContent}\n</file>`;
		})
		.join('\n\n');
}

/**
 * Escape special characters for XML attribute values
 */
function escapeXmlAttr(str: string): string {
	return str
		.replace(/&/g, '&amp;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;');
}
