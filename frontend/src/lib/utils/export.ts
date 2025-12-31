/**
 * Export utilities for conversations
 * Provides functions to export chat conversations as Markdown or JSON files
 */

import type { Conversation } from '$lib/types/conversation.js';
import type { MessageNode, BranchPath } from '$lib/types/chat.js';

/** Export format options */
export type ExportFormat = 'markdown' | 'json';

/** Exported conversation data structure for JSON format */
export interface ExportedConversation {
	id: string;
	title: string;
	model: string;
	createdAt: string;
	exportedAt: string;
	messages: ExportedMessage[];
}

/** Exported message structure for JSON format */
export interface ExportedMessage {
	role: string;
	content: string;
	timestamp: string;
	images?: string[];
}

/** Shareable data structure (for URL-based sharing) */
export interface ShareableData {
	version: number;
	title: string;
	model: string;
	messages: ExportedMessage[];
}

/**
 * Convert message tree to ordered messages array following active path
 * @param messageTree The full message tree
 * @param activePath The active branch path to follow
 * @returns Ordered array of message nodes
 */
function getOrderedMessages(
	messageTree: Map<string, MessageNode>,
	activePath: BranchPath
): MessageNode[] {
	const messages: MessageNode[] = [];
	for (const id of activePath) {
		const node = messageTree.get(id);
		if (node) {
			messages.push(node);
		}
	}
	return messages;
}

/**
 * Escape markdown special characters in text that should be literal
 * @param text Text to escape
 * @returns Escaped text
 */
function escapeMarkdownInline(text: string): string {
	// Don't escape content in code blocks - those are preserved as-is
	return text;
}

/**
 * Format a date for display
 * @param date Date to format
 * @returns Formatted date string
 */
function formatDate(date: Date): string {
	return date.toLocaleString('en-US', {
		year: 'numeric',
		month: 'long',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit'
	});
}

/**
 * Format a date as ISO string
 * @param date Date to format
 * @returns ISO date string
 */
function formatDateISO(date: Date): string {
	return date.toISOString();
}

/**
 * Export conversation as Markdown format
 * @param conversation Conversation metadata
 * @param messageTree Message tree map
 * @param activePath Active branch path
 * @returns Markdown string
 */
export function exportAsMarkdown(
	conversation: Conversation,
	messageTree: Map<string, MessageNode>,
	activePath: BranchPath
): string {
	const messages = getOrderedMessages(messageTree, activePath);
	const lines: string[] = [];

	// Header
	lines.push(`# ${conversation.title}`);
	lines.push('');
	lines.push(`**Model:** ${conversation.model}`);
	lines.push(`**Created:** ${formatDate(conversation.createdAt)}`);
	lines.push(`**Exported:** ${formatDate(new Date())}`);
	lines.push('');
	lines.push('---');
	lines.push('');

	// Messages
	for (const node of messages) {
		const { message, createdAt } = node;
		const roleName = message.role === 'user' ? 'User' : message.role === 'assistant' ? 'Assistant' : message.role;

		lines.push(`## ${roleName}`);
		lines.push(`*${formatDate(createdAt)}*`);
		lines.push('');

		// Content - preserve code blocks and formatting as-is
		lines.push(message.content);
		lines.push('');

		// Images (if any)
		if (message.images && message.images.length > 0) {
			lines.push('**Attached Images:**');
			for (let i = 0; i < message.images.length; i++) {
				lines.push(`- Image ${i + 1} (base64 data not included in export)`);
			}
			lines.push('');
		}

		lines.push('---');
		lines.push('');
	}

	return lines.join('\n');
}

/**
 * Export conversation as JSON format
 * @param conversation Conversation metadata
 * @param messageTree Message tree map
 * @param activePath Active branch path
 * @returns JSON string
 */
export function exportAsJSON(
	conversation: Conversation,
	messageTree: Map<string, MessageNode>,
	activePath: BranchPath
): string {
	const messages = getOrderedMessages(messageTree, activePath);

	const exportData: ExportedConversation = {
		id: conversation.id,
		title: conversation.title,
		model: conversation.model,
		createdAt: formatDateISO(conversation.createdAt),
		exportedAt: formatDateISO(new Date()),
		messages: messages.map((node) => ({
			role: node.message.role,
			content: node.message.content,
			timestamp: formatDateISO(node.createdAt),
			...(node.message.images && node.message.images.length > 0 && {
				images: node.message.images
			})
		}))
	};

	return JSON.stringify(exportData, null, 2);
}

/**
 * Generate preview of export content (first few lines)
 * @param content Full export content
 * @param maxLines Maximum lines to show
 * @returns Preview string
 */
export function generatePreview(content: string, maxLines: number = 10): string {
	const lines = content.split('\n');
	if (lines.length <= maxLines) {
		return content;
	}
	return lines.slice(0, maxLines).join('\n') + '\n...';
}

/**
 * Trigger file download in the browser
 * @param content File content
 * @param filename Filename with extension
 * @param mimeType MIME type for the file
 */
export function downloadFile(content: string, filename: string, mimeType: string): void {
	const blob = new Blob([content], { type: mimeType });
	const url = URL.createObjectURL(blob);

	const link = document.createElement('a');
	link.href = url;
	link.download = filename;
	link.style.display = 'none';

	document.body.appendChild(link);
	link.click();

	// Cleanup
	document.body.removeChild(link);
	URL.revokeObjectURL(url);
}

/**
 * Generate a safe filename from conversation title
 * @param title Conversation title
 * @param extension File extension (without dot)
 * @returns Safe filename
 */
export function generateFilename(title: string, extension: string): string {
	// Remove or replace unsafe characters
	const safeTitle = title
		.replace(/[<>:"/\\|?*]/g, '') // Remove Windows-unsafe chars
		.replace(/\s+/g, '_') // Replace spaces with underscores
		.replace(/_+/g, '_') // Collapse multiple underscores
		.replace(/^_|_$/g, '') // Trim leading/trailing underscores
		.slice(0, 50); // Limit length

	const timestamp = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
	return `${safeTitle}_${timestamp}.${extension}`;
}

/**
 * Export and download conversation
 * @param conversation Conversation metadata
 * @param messageTree Message tree map
 * @param activePath Active branch path
 * @param format Export format
 */
export function exportConversation(
	conversation: Conversation,
	messageTree: Map<string, MessageNode>,
	activePath: BranchPath,
	format: ExportFormat
): void {
	let content: string;
	let filename: string;
	let mimeType: string;

	if (format === 'markdown') {
		content = exportAsMarkdown(conversation, messageTree, activePath);
		filename = generateFilename(conversation.title, 'md');
		mimeType = 'text/markdown';
	} else {
		content = exportAsJSON(conversation, messageTree, activePath);
		filename = generateFilename(conversation.title, 'json');
		mimeType = 'application/json';
	}

	downloadFile(content, filename, mimeType);
}

/**
 * Create shareable data for URL-based sharing
 * @param conversation Conversation metadata
 * @param messageTree Message tree map
 * @param activePath Active branch path
 * @returns Shareable data object
 */
export function createShareableData(
	conversation: Conversation,
	messageTree: Map<string, MessageNode>,
	activePath: BranchPath
): ShareableData {
	const messages = getOrderedMessages(messageTree, activePath);

	return {
		version: 1,
		title: conversation.title,
		model: conversation.model,
		messages: messages.map((node) => ({
			role: node.message.role,
			content: node.message.content,
			timestamp: formatDateISO(node.createdAt)
			// Note: Images excluded from share links to keep URL size manageable
		}))
	};
}

/**
 * Encode shareable data to base64 for URL hash
 * @param data Shareable data
 * @returns Base64-encoded string
 */
export function encodeShareableData(data: ShareableData): string {
	const json = JSON.stringify(data);
	// Use encodeURIComponent for UTF-8 safety before btoa
	return btoa(encodeURIComponent(json));
}

/**
 * Decode shareable data from base64 URL hash
 * @param encoded Base64-encoded string
 * @returns Shareable data or null if invalid
 */
export function decodeShareableData(encoded: string): ShareableData | null {
	try {
		const json = decodeURIComponent(atob(encoded));
		const data = JSON.parse(json);

		// Basic validation
		if (typeof data.version !== 'number' || !Array.isArray(data.messages)) {
			return null;
		}

		return data as ShareableData;
	} catch {
		return null;
	}
}

/**
 * Generate share URL with conversation data in hash
 * @param conversation Conversation metadata
 * @param messageTree Message tree map
 * @param activePath Active branch path
 * @returns Share URL string
 */
export function generateShareUrl(
	conversation: Conversation,
	messageTree: Map<string, MessageNode>,
	activePath: BranchPath
): string {
	const data = createShareableData(conversation, messageTree, activePath);
	const encoded = encodeShareableData(data);

	// Use current origin and a share route
	const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
	return `${baseUrl}/share#${encoded}`;
}

/**
 * Copy text to clipboard
 * @param text Text to copy
 * @returns Promise that resolves when copied, rejects on error
 */
export async function copyToClipboard(text: string): Promise<void> {
	if (navigator.clipboard && navigator.clipboard.writeText) {
		return navigator.clipboard.writeText(text);
	}

	// Fallback for older browsers
	return new Promise((resolve, reject) => {
		const textArea = document.createElement('textarea');
		textArea.value = text;
		textArea.style.position = 'fixed';
		textArea.style.left = '-9999px';
		textArea.style.top = '-9999px';
		document.body.appendChild(textArea);
		textArea.focus();
		textArea.select();

		try {
			const successful = document.execCommand('copy');
			document.body.removeChild(textArea);
			if (successful) {
				resolve();
			} else {
				reject(new Error('Copy command failed'));
			}
		} catch (err) {
			document.body.removeChild(textArea);
			reject(err);
		}
	});
}
