/**
 * Storage layer exports
 * IndexedDB-based local storage using Dexie.js
 */

// Database setup and types
export { db, generateId, withErrorHandling } from './db.js';
export type {
	StoredConversation,
	StoredMessage,
	StoredAttachment,
	SyncQueueItem,
	StorageResult
} from './db.js';

// Conversation operations
export {
	getAllConversations,
	getArchivedConversations,
	getConversation,
	getConversationFull,
	createConversation,
	updateConversation,
	deleteConversation,
	pinConversation,
	archiveConversation,
	updateMessageCount,
	searchConversations
} from './conversations.js';

// Message operations
export {
	getMessagesForConversation,
	getMessage,
	addMessage,
	updateMessage,
	deleteMessage,
	deleteMessagesForConversation,
	getMessageTree,
	getSiblings,
	getPathToMessage,
	appendToMessage
} from './messages.js';

// Attachment operations
export {
	getAttachmentsForMessage,
	getAttachmentMetaForMessage,
	getAttachment,
	addAttachment,
	addAttachmentFromBlob,
	deleteAttachment,
	deleteAttachmentsForMessage,
	getAttachmentDataUrl,
	getTotalAttachmentSize,
	getConversationAttachmentSize
} from './attachments.js';
export type { AttachmentMeta } from './attachments.js';

// Sync utilities
export {
	markForSync,
	getPendingSyncItems,
	getPendingSyncItemsByType,
	clearSyncItem,
	clearSyncItems,
	incrementRetryCount,
	clearAllSyncItems,
	getPendingSyncCount,
	hasPendingSyncs,
	markMultipleForSync
} from './sync.js';
export type { SyncEntityType, SyncOperation } from './sync.js';
