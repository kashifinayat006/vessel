/**
 * Conversation import utilities
 * Imports conversations from JSON files with validation
 */

import type { ExportedConversation, ExportedMessage } from './export';
import { createConversation, addMessage } from '$lib/storage';
import type { MessageNode } from '$lib/types/chat';

// ============================================================================
// Import Validation
// ============================================================================

/**
 * Validation result
 */
export interface ValidationResult {
	valid: boolean;
	errors: string[];
	warnings: string[];
	data?: ExportedConversation;
}

/**
 * Import result
 */
export interface ImportResult {
	success: boolean;
	conversationId?: string;
	error?: string;
}

/**
 * Validate an imported JSON file
 */
export function validateImport(data: unknown): ValidationResult {
	const errors: string[] = [];
	const warnings: string[] = [];

	if (!data || typeof data !== 'object') {
		return { valid: false, errors: ['Invalid file: not a valid JSON object'], warnings };
	}

	const obj = data as Record<string, unknown>;

	// Check required fields
	if (!obj.id || typeof obj.id !== 'string') {
		errors.push('Missing or invalid conversation ID');
	}

	if (!obj.title || typeof obj.title !== 'string') {
		errors.push('Missing or invalid conversation title');
	}

	if (!obj.model || typeof obj.model !== 'string') {
		errors.push('Missing or invalid model name');
	}

	if (!obj.messages || !Array.isArray(obj.messages)) {
		errors.push('Missing or invalid messages array');
	} else {
		// Validate each message
		for (let i = 0; i < obj.messages.length; i++) {
			const msg = obj.messages[i] as Record<string, unknown>;

			if (!msg.role || typeof msg.role !== 'string') {
				errors.push(`Message ${i + 1}: missing or invalid role`);
			} else if (!['user', 'assistant', 'system', 'tool'].includes(msg.role as string)) {
				warnings.push(`Message ${i + 1}: unknown role "${msg.role}"`);
			}

			if (typeof msg.content !== 'string') {
				errors.push(`Message ${i + 1}: missing or invalid content`);
			}

			if (msg.images && !Array.isArray(msg.images)) {
				warnings.push(`Message ${i + 1}: invalid images format, will be ignored`);
			}
		}

		if (obj.messages.length === 0) {
			warnings.push('Conversation has no messages');
		}
	}

	// Check dates
	if (obj.createdAt && typeof obj.createdAt === 'string') {
		const date = new Date(obj.createdAt);
		if (isNaN(date.getTime())) {
			warnings.push('Invalid creation date, will use current time');
		}
	}

	if (errors.length > 0) {
		return { valid: false, errors, warnings };
	}

	// Convert to ExportedConversation format
	const exportedConv: ExportedConversation = {
		id: obj.id as string,
		title: obj.title as string,
		model: obj.model as string,
		createdAt: obj.createdAt as string || new Date().toISOString(),
		exportedAt: obj.exportedAt as string || new Date().toISOString(),
		messages: (obj.messages as ExportedMessage[]).map(msg => ({
			role: msg.role,
			content: msg.content,
			timestamp: msg.timestamp || new Date().toISOString(),
			images: msg.images
		}))
	};

	return { valid: true, errors: [], warnings, data: exportedConv };
}

/**
 * Parse a JSON file and validate its contents
 */
export async function parseImportFile(file: File): Promise<ValidationResult> {
	return new Promise((resolve) => {
		const reader = new FileReader();

		reader.onload = (event) => {
			try {
				const text = event.target?.result as string;
				const data = JSON.parse(text);
				resolve(validateImport(data));
			} catch (error) {
				resolve({
					valid: false,
					errors: [`Failed to parse JSON: ${error instanceof Error ? error.message : 'Unknown error'}`],
					warnings: []
				});
			}
		};

		reader.onerror = () => {
			resolve({
				valid: false,
				errors: ['Failed to read file'],
				warnings: []
			});
		};

		reader.readAsText(file);
	});
}

/**
 * Import a validated conversation into the database
 */
export async function importConversation(data: ExportedConversation): Promise<ImportResult> {
	try {
		// Create the conversation with a new ID (don't use the exported ID)
		const result = await createConversation({
			title: data.title,
			model: data.model,
			isPinned: false,
			isArchived: false
		});

		if (!result.success || !result.data) {
			return { success: false, error: 'Failed to create conversation' };
		}

		const conversationId = result.data.id;

		// Add messages in order
		let parentId: string | null = null;

		for (const msg of data.messages) {
			const msgResult = await addMessage(
				conversationId,
				{
					role: msg.role as 'user' | 'assistant' | 'system' | 'tool',
					content: msg.content,
					images: msg.images
				},
				parentId
			);

			if (msgResult.success && msgResult.data) {
				parentId = msgResult.data.id;
			}
		}

		return { success: true, conversationId };

	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Unknown error during import'
		};
	}
}

/**
 * Get file size formatted for display
 */
export function formatFileSize(bytes: number): string {
	if (bytes === 0) return '0 B';
	const k = 1024;
	const sizes = ['B', 'KB', 'MB', 'GB'];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
