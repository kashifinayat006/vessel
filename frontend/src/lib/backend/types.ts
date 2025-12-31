/**
 * Types for backend API communication
 */

/** Backend chat representation (matches Go model) */
export interface BackendChat {
	id: string;
	title: string;
	model: string;
	pinned: boolean;
	archived: boolean;
	created_at: string;
	updated_at: string;
	sync_version: number;
	messages?: BackendMessage[];
}

/** Backend message representation (matches Go model) */
export interface BackendMessage {
	id: string;
	chat_id: string;
	parent_id?: string | null;
	role: 'user' | 'assistant' | 'system';
	content: string;
	sibling_index: number;
	created_at: string;
	sync_version: number;
	attachments?: BackendAttachment[];
}

/** Backend attachment representation */
export interface BackendAttachment {
	id: string;
	message_id: string;
	mime_type: string;
	filename: string;
	data?: string; // base64 encoded
}

/** Push changes request body */
export interface PushChangesRequest {
	chats: BackendChat[];
	messages: BackendMessage[];
}

/** Push changes response */
export interface PushChangesResponse {
	message: string;
	sync_version: number;
}

/** Pull changes response */
export interface PullChangesResponse {
	chats: BackendChat[];
	sync_version: number;
}

/** Generic API response wrapper */
export interface ApiResponse<T> {
	data?: T;
	error?: string;
}
