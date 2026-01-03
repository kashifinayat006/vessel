/**
 * Attachment operations for IndexedDB storage
 * Handles binary file storage for message attachments
 */

import { db, withErrorHandling, generateId } from './db.js';
import type { StoredAttachment, AttachmentMeta, StorageResult } from './db.js';
import type { FileAttachment, AttachmentType } from '$lib/types/attachment.js';

// Re-export AttachmentMeta for convenience
export type { AttachmentMeta };

// ============================================================================
// Query Operations
// ============================================================================

/**
 * Get all attachments for a message
 */
export async function getAttachmentsForMessage(
	messageId: string
): Promise<StorageResult<StoredAttachment[]>> {
	return withErrorHandling(async () => {
		return await db.attachments.where('messageId').equals(messageId).toArray();
	});
}

/**
 * Get attachment metadata (without binary data) for a message
 */
export async function getAttachmentMetaForMessage(
	messageId: string
): Promise<StorageResult<AttachmentMeta[]>> {
	return withErrorHandling(async () => {
		const attachments = await db.attachments.where('messageId').equals(messageId).toArray();
		return attachments.map(toAttachmentMeta);
	});
}

/**
 * Get a single attachment by ID
 */
export async function getAttachment(id: string): Promise<StorageResult<StoredAttachment | null>> {
	return withErrorHandling(async () => {
		return (await db.attachments.get(id)) ?? null;
	});
}

/**
 * Get multiple attachments by IDs
 */
export async function getAttachmentsByIds(ids: string[]): Promise<StorageResult<StoredAttachment[]>> {
	return withErrorHandling(async () => {
		const attachments = await db.attachments.where('id').anyOf(ids).toArray();
		// Maintain order of input IDs
		const attachmentMap = new Map(attachments.map(a => [a.id, a]));
		return ids.map(id => attachmentMap.get(id)).filter((a): a is StoredAttachment => a !== undefined);
	});
}

/**
 * Get metadata for multiple attachments by IDs
 */
export async function getAttachmentMetaByIds(ids: string[]): Promise<StorageResult<AttachmentMeta[]>> {
	return withErrorHandling(async () => {
		const attachments = await db.attachments.where('id').anyOf(ids).toArray();
		const attachmentMap = new Map(attachments.map(a => [a.id, a]));
		return ids
			.map(id => attachmentMap.get(id))
			.filter((a): a is StoredAttachment => a !== undefined)
			.map(toAttachmentMeta);
	});
}

// ============================================================================
// Create Operations
// ============================================================================

/**
 * Save a FileAttachment to IndexedDB with the original file data
 * Returns the attachment ID for linking to the message
 */
export async function saveAttachment(
	messageId: string,
	file: File,
	attachment: FileAttachment
): Promise<StorageResult<string>> {
	return withErrorHandling(async () => {
		const stored: StoredAttachment = {
			id: attachment.id,
			messageId,
			mimeType: attachment.mimeType,
			data: file,
			filename: attachment.filename,
			size: attachment.size,
			type: attachment.type,
			createdAt: Date.now(),
			textContent: attachment.textContent,
			truncated: attachment.truncated,
			analyzed: attachment.analyzed,
			summary: attachment.summary,
		};

		await db.attachments.add(stored);
		return attachment.id;
	});
}

/**
 * Save multiple attachments at once
 * Returns array of attachment IDs
 */
export async function saveAttachments(
	messageId: string,
	files: File[],
	attachments: FileAttachment[]
): Promise<StorageResult<string[]>> {
	return withErrorHandling(async () => {
		const storedAttachments: StoredAttachment[] = attachments.map((attachment, index) => ({
			id: attachment.id,
			messageId,
			mimeType: attachment.mimeType,
			data: files[index],
			filename: attachment.filename,
			size: attachment.size,
			type: attachment.type,
			createdAt: Date.now(),
			textContent: attachment.textContent,
			truncated: attachment.truncated,
			analyzed: attachment.analyzed,
			summary: attachment.summary,
		}));

		await db.attachments.bulkAdd(storedAttachments);
		return attachments.map(a => a.id);
	});
}

/**
 * Add an attachment from a Blob with explicit metadata
 */
export async function addAttachmentFromBlob(
	messageId: string,
	data: Blob,
	filename: string,
	type: AttachmentType,
	options?: {
		mimeType?: string;
		textContent?: string;
		truncated?: boolean;
		analyzed?: boolean;
		summary?: string;
	}
): Promise<StorageResult<StoredAttachment>> {
	return withErrorHandling(async () => {
		const id = generateId();

		const attachment: StoredAttachment = {
			id,
			messageId,
			mimeType: options?.mimeType ?? data.type ?? 'application/octet-stream',
			data,
			filename,
			size: data.size,
			type,
			createdAt: Date.now(),
			textContent: options?.textContent,
			truncated: options?.truncated,
			analyzed: options?.analyzed,
			summary: options?.summary,
		};

		await db.attachments.add(attachment);
		return attachment;
	});
}

// ============================================================================
// Update Operations
// ============================================================================

/**
 * Update attachment with analysis results
 */
export async function updateAttachmentAnalysis(
	id: string,
	analyzed: boolean,
	summary?: string
): Promise<StorageResult<void>> {
	return withErrorHandling(async () => {
		await db.attachments.update(id, { analyzed, summary });
	});
}

// ============================================================================
// Delete Operations
// ============================================================================

/**
 * Delete an attachment by ID
 */
export async function deleteAttachment(id: string): Promise<StorageResult<void>> {
	return withErrorHandling(async () => {
		await db.attachments.delete(id);
	});
}

/**
 * Delete all attachments for a message
 */
export async function deleteAttachmentsForMessage(messageId: string): Promise<StorageResult<void>> {
	return withErrorHandling(async () => {
		await db.attachments.where('messageId').equals(messageId).delete();
	});
}

/**
 * Delete multiple attachments by IDs
 */
export async function deleteAttachmentsByIds(ids: string[]): Promise<StorageResult<void>> {
	return withErrorHandling(async () => {
		await db.attachments.where('id').anyOf(ids).delete();
	});
}

// ============================================================================
// Data Conversion
// ============================================================================

/**
 * Get the data URL for an attachment (for displaying images)
 */
export async function getAttachmentDataUrl(id: string): Promise<StorageResult<string | null>> {
	return withErrorHandling(async () => {
		const attachment = await db.attachments.get(id);
		if (!attachment) {
			return null;
		}

		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => resolve(reader.result as string);
			reader.onerror = () => reject(new Error('Failed to read attachment data'));
			reader.readAsDataURL(attachment.data);
		});
	});
}

/**
 * Get base64 data for an image attachment (without data: prefix, for Ollama)
 */
export async function getAttachmentBase64(id: string): Promise<StorageResult<string | null>> {
	return withErrorHandling(async () => {
		const attachment = await db.attachments.get(id);
		if (!attachment || !attachment.mimeType.startsWith('image/')) {
			return null;
		}

		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => {
				const dataUrl = reader.result as string;
				// Remove the data:image/xxx;base64, prefix
				const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '');
				resolve(base64);
			};
			reader.onerror = () => reject(new Error('Failed to read attachment data'));
			reader.readAsDataURL(attachment.data);
		});
	});
}

/**
 * Get text content from an attachment (reads from cache or blob)
 */
export async function getAttachmentTextContent(id: string): Promise<StorageResult<string | null>> {
	return withErrorHandling(async () => {
		const attachment = await db.attachments.get(id);
		if (!attachment) {
			return null;
		}

		// Return cached text content if available
		if (attachment.textContent) {
			return attachment.textContent;
		}

		// For text files, read from blob
		if (attachment.type === 'text' || attachment.mimeType.startsWith('text/')) {
			return await attachment.data.text();
		}

		return null;
	});
}

/**
 * Create a download URL for an attachment
 * Remember to call URL.revokeObjectURL() when done
 */
export function createDownloadUrl(attachment: StoredAttachment): string {
	return URL.createObjectURL(attachment.data);
}

// ============================================================================
// Storage Statistics
// ============================================================================

/**
 * Get total storage size used by attachments
 */
export async function getTotalAttachmentSize(): Promise<StorageResult<number>> {
	return withErrorHandling(async () => {
		const attachments = await db.attachments.toArray();
		return attachments.reduce((total, a) => total + a.data.size, 0);
	});
}

/**
 * Get storage size for attachments in a conversation
 */
export async function getConversationAttachmentSize(
	conversationId: string
): Promise<StorageResult<number>> {
	return withErrorHandling(async () => {
		// Get all message IDs for the conversation
		const messages = await db.messages.where('conversationId').equals(conversationId).toArray();
		const messageIds = messages.map((m) => m.id);

		if (messageIds.length === 0) {
			return 0;
		}

		// Get all attachments for those messages
		const attachments = await db.attachments.where('messageId').anyOf(messageIds).toArray();

		return attachments.reduce((total, a) => total + a.data.size, 0);
	});
}

/**
 * Get attachment count for a message
 */
export async function getAttachmentCountForMessage(messageId: string): Promise<StorageResult<number>> {
	return withErrorHandling(async () => {
		return await db.attachments.where('messageId').equals(messageId).count();
	});
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Convert StoredAttachment to AttachmentMeta (strips binary data)
 */
function toAttachmentMeta(attachment: StoredAttachment): AttachmentMeta {
	return {
		id: attachment.id,
		messageId: attachment.messageId,
		filename: attachment.filename,
		mimeType: attachment.mimeType,
		size: attachment.size,
		type: attachment.type,
		createdAt: attachment.createdAt,
		truncated: attachment.truncated,
		analyzed: attachment.analyzed,
	};
}
