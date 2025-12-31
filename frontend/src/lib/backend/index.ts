/**
 * Backend module exports
 */

export { backendClient, BackendClient, type BackendClientConfig } from './client.js';
export { syncManager, syncState, type SyncStatus, type SyncResult } from './sync-manager.svelte.js';
export type {
	BackendChat,
	BackendMessage,
	BackendAttachment,
	PushChangesRequest,
	PushChangesResponse,
	PullChangesResponse,
	ApiResponse
} from './types.js';
