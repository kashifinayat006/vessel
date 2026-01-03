/**
 * Attachment Service
 * Coordinates file processing, analysis, and storage for message attachments.
 * Acts as the main API for attachment operations in the chat flow.
 */

import { processFile } from '$lib/utils/file-processor.js';
import { fileAnalyzer, type AnalysisResult } from './fileAnalyzer.js';
import {
	saveAttachment,
	saveAttachments as saveAttachmentsToDb,
	getAttachment,
	getAttachmentsByIds,
	getAttachmentMetaForMessage,
	getAttachmentMetaByIds,
	getAttachmentBase64,
	getAttachmentTextContent,
	createDownloadUrl,
	deleteAttachment,
	deleteAttachmentsByIds,
	updateAttachmentAnalysis
} from '$lib/storage/index.js';
import type { StoredAttachment, AttachmentMeta, StorageResult } from '$lib/storage/index.js';
import type { FileAttachment, AttachmentType } from '$lib/types/attachment.js';

/**
 * Pending attachment before it's saved to IndexedDB.
 * Contains the processed file data and original File object.
 */
export interface PendingAttachment {
	file: File;
	attachment: FileAttachment;
	analysisResult?: AnalysisResult;
}

/**
 * Success result of preparing an attachment.
 */
export interface PrepareSuccess {
	success: true;
	pending: PendingAttachment;
}

/**
 * Error result of preparing an attachment.
 */
export interface PrepareError {
	success: false;
	error: string;
}

/**
 * Result of preparing an attachment for sending.
 */
export type PrepareResult = PrepareSuccess | PrepareError;

/**
 * Content formatted for inclusion in a message.
 */
export interface FormattedContent {
	/** The formatted text content (XML-style tags) */
	text: string;
	/** Whether any content was analyzed by the sub-agent */
	hasAnalyzed: boolean;
	/** Total original size of all attachments */
	totalSize: number;
}

class AttachmentService {
	/**
	 * Prepare a single file as a pending attachment.
	 * Processes the file but does not persist to storage.
	 */
	async prepareAttachment(file: File): Promise<PrepareResult> {
		const result = await processFile(file);
		if (!result.success) {
			return { success: false, error: result.error };
		}
		return {
			success: true,
			pending: { file, attachment: result.attachment }
		};
	}

	/**
	 * Prepare multiple files as pending attachments.
	 * Returns both successful preparations and any errors.
	 */
	async prepareAttachments(files: File[]): Promise<{
		pending: PendingAttachment[];
		errors: string[];
	}> {
		const pending: PendingAttachment[] = [];
		const errors: string[] = [];

		for (const file of files) {
			const result = await this.prepareAttachment(file);
			if (result.success) {
				pending.push(result.pending);
			} else {
				errors.push(`${file.name}: ${result.error}`);
			}
		}

		return { pending, errors };
	}

	/**
	 * Analyze pending attachments that exceed size thresholds.
	 * Spawns sub-agent for large files to summarize content.
	 */
	async analyzeIfNeeded(
		pending: PendingAttachment[],
		model: string
	): Promise<PendingAttachment[]> {
		const analyzed: PendingAttachment[] = [];

		for (const item of pending) {
			const result = await fileAnalyzer.analyzeIfNeeded(item.attachment, model);
			analyzed.push({
				...item,
				analysisResult: result
			});
		}

		return analyzed;
	}

	/**
	 * Save pending attachments to IndexedDB, linking them to a message.
	 * Returns the attachment IDs for storing in the message.
	 */
	async savePendingAttachments(
		messageId: string,
		pending: PendingAttachment[]
	): Promise<StorageResult<string[]>> {
		const files = pending.map(p => p.file);
		const attachments = pending.map(p => p.attachment);

		const result = await saveAttachmentsToDb(messageId, files, attachments);

		if (result.success) {
			// Update analysis status if any were analyzed
			for (let i = 0; i < pending.length; i++) {
				const item = pending[i];
				if (item.analysisResult?.analyzed) {
					await updateAttachmentAnalysis(
						attachments[i].id,
						true,
						item.analysisResult.summary
					);
				}
			}
		}

		return result;
	}

	/**
	 * Format pending attachments for inclusion in message content.
	 * Uses analysis summaries for large files, raw content for small ones.
	 */
	formatForMessage(pending: PendingAttachment[]): FormattedContent {
		let hasAnalyzed = false;
		let totalSize = 0;

		const parts: string[] = [];

		for (const item of pending) {
			const { attachment, analysisResult } = item;
			totalSize += attachment.size;

			// Skip images - they go in the images array, not text content
			if (attachment.type === 'image') {
				continue;
			}

			// Skip if no text content to include
			if (!attachment.textContent && !analysisResult?.summary) {
				continue;
			}

			const sizeAttr = ` size="${formatFileSize(attachment.size)}"`;
			const typeAttr = ` type="${attachment.type}"`;

			if (analysisResult && !analysisResult.useOriginal && analysisResult.summary) {
				// Use analyzed summary for large files
				hasAnalyzed = true;
				parts.push(
					`<file name="${escapeXmlAttr(attachment.filename)}"${sizeAttr}${typeAttr} analyzed="true">\n` +
					`${analysisResult.summary}\n` +
					`[Full content (${formatFileSize(analysisResult.originalLength)}) stored locally]\n` +
					`</file>`
				);
			} else {
				// Use raw content for small files
				const content = analysisResult?.content || attachment.textContent || '';
				const truncatedAttr = attachment.truncated ? ' truncated="true"' : '';
				parts.push(
					`<file name="${escapeXmlAttr(attachment.filename)}"${sizeAttr}${typeAttr}${truncatedAttr}>\n` +
					`${content}\n` +
					`</file>`
				);
			}
		}

		return {
			text: parts.join('\n\n'),
			hasAnalyzed,
			totalSize
		};
	}

	/**
	 * Get image base64 data for Ollama from pending attachments.
	 * Returns array of base64 strings (without data: prefix).
	 */
	getImagesFromPending(pending: PendingAttachment[]): string[] {
		return pending
			.filter(p => p.attachment.type === 'image' && p.attachment.base64Data)
			.map(p => p.attachment.base64Data!);
	}

	/**
	 * Load attachment metadata for display (without binary data).
	 */
	async getMetaForMessage(messageId: string): Promise<StorageResult<AttachmentMeta[]>> {
		return getAttachmentMetaForMessage(messageId);
	}

	/**
	 * Load attachment metadata by IDs.
	 */
	async getMetaByIds(ids: string[]): Promise<StorageResult<AttachmentMeta[]>> {
		return getAttachmentMetaByIds(ids);
	}

	/**
	 * Load full attachment data by ID.
	 */
	async getFullAttachment(id: string): Promise<StorageResult<StoredAttachment | null>> {
		return getAttachment(id);
	}

	/**
	 * Load multiple full attachments by IDs.
	 */
	async getFullAttachments(ids: string[]): Promise<StorageResult<StoredAttachment[]>> {
		return getAttachmentsByIds(ids);
	}

	/**
	 * Get base64 data for an image attachment (for Ollama).
	 */
	async getImageBase64(id: string): Promise<StorageResult<string | null>> {
		return getAttachmentBase64(id);
	}

	/**
	 * Get text content from an attachment.
	 */
	async getTextContent(id: string): Promise<StorageResult<string | null>> {
		return getAttachmentTextContent(id);
	}

	/**
	 * Create a download URL for an attachment.
	 * Remember to call URL.revokeObjectURL() when done.
	 */
	async createDownloadUrl(id: string): Promise<string | null> {
		const result = await getAttachment(id);
		if (!result.success || !result.data) {
			return null;
		}
		return createDownloadUrl(result.data);
	}

	/**
	 * Delete a single attachment.
	 */
	async deleteAttachment(id: string): Promise<StorageResult<void>> {
		return deleteAttachment(id);
	}

	/**
	 * Delete multiple attachments.
	 */
	async deleteAttachments(ids: string[]): Promise<StorageResult<void>> {
		return deleteAttachmentsByIds(ids);
	}

	/**
	 * Build images array for Ollama from stored attachment IDs.
	 * Loads image base64 data from IndexedDB.
	 */
	async buildOllamaImages(attachmentIds: string[]): Promise<string[]> {
		const images: string[] = [];

		for (const id of attachmentIds) {
			const result = await getAttachmentBase64(id);
			if (result.success && result.data) {
				images.push(result.data);
			}
		}

		return images;
	}

	/**
	 * Build text content for Ollama from stored attachment IDs.
	 * Returns formatted XML-style content for non-image attachments.
	 */
	async buildOllamaContent(attachmentIds: string[]): Promise<string> {
		const attachments = await getAttachmentsByIds(attachmentIds);
		if (!attachments.success) {
			return '';
		}

		const parts: string[] = [];

		for (const attachment of attachments.data) {
			// Skip images - they go in images array
			if (attachment.type === 'image') {
				continue;
			}

			const content = attachment.textContent || await attachment.data.text().catch(() => null);
			if (!content) {
				continue;
			}

			const sizeAttr = ` size="${formatFileSize(attachment.size)}"`;
			const typeAttr = ` type="${attachment.type}"`;
			const analyzedAttr = attachment.analyzed ? ' analyzed="true"' : '';
			const truncatedAttr = attachment.truncated ? ' truncated="true"' : '';

			if (attachment.analyzed && attachment.summary) {
				// Use stored summary
				parts.push(
					`<file name="${escapeXmlAttr(attachment.filename)}"${sizeAttr}${typeAttr}${analyzedAttr}>\n` +
					`${attachment.summary}\n` +
					`[Full content stored locally]\n` +
					`</file>`
				);
			} else {
				// Use raw content
				parts.push(
					`<file name="${escapeXmlAttr(attachment.filename)}"${sizeAttr}${typeAttr}${truncatedAttr}>\n` +
					`${content}\n` +
					`</file>`
				);
			}
		}

		return parts.join('\n\n');
	}
}

// Helpers

function formatFileSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function escapeXmlAttr(str: string): string {
	return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Singleton export
export const attachmentService = new AttachmentService();
