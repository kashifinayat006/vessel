/**
 * Attachment operations for IndexedDB storage
 * Handles binary file storage for message attachments
 */

import { db, withErrorHandling, generateId } from './db.js';
import type { StoredAttachment, StorageResult } from './db.js';

/**
 * Attachment metadata without the binary data
 */
export interface AttachmentMeta {
	id: string;
	messageId: string;
	mimeType: string;
	filename: string;
	size: number;
}

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
 * Get attachment metadata (without data) for a message
 */
export async function getAttachmentMetaForMessage(
	messageId: string
): Promise<StorageResult<AttachmentMeta[]>> {
	return withErrorHandling(async () => {
		const attachments = await db.attachments.where('messageId').equals(messageId).toArray();
		return attachments.map((a) => ({
			id: a.id,
			messageId: a.messageId,
			mimeType: a.mimeType,
			filename: a.filename,
			size: a.data.size
		}));
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
 * Add an attachment to a message
 */
export async function addAttachment(
	messageId: string,
	file: File
): Promise<StorageResult<StoredAttachment>> {
	return withErrorHandling(async () => {
		const id = generateId();

		const attachment: StoredAttachment = {
			id,
			messageId,
			mimeType: file.type || 'application/octet-stream',
			data: file,
			filename: file.name
		};

		await db.attachments.add(attachment);
		return attachment;
	});
}

/**
 * Add an attachment from a Blob with explicit metadata
 */
export async function addAttachmentFromBlob(
	messageId: string,
	data: Blob,
	filename: string,
	mimeType?: string
): Promise<StorageResult<StoredAttachment>> {
	return withErrorHandling(async () => {
		const id = generateId();

		const attachment: StoredAttachment = {
			id,
			messageId,
			mimeType: mimeType ?? data.type ?? 'application/octet-stream',
			data,
			filename
		};

		await db.attachments.add(attachment);
		return attachment;
	});
}

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
