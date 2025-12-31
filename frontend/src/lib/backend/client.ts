/**
 * Backend API client for sync operations
 */

import type {
	BackendChat,
	BackendMessage,
	PushChangesRequest,
	PushChangesResponse,
	PullChangesResponse,
	ApiResponse
} from './types.js';

/** Backend client configuration */
export interface BackendClientConfig {
	baseUrl: string;
	timeout?: number;
}

/** Backend API client class */
export class BackendClient {
	private baseUrl: string;
	private timeout: number;

	constructor(config: BackendClientConfig) {
		// Remove trailing slash
		this.baseUrl = config.baseUrl.replace(/\/$/, '');
		this.timeout = config.timeout ?? 30000;
	}

	/**
	 * Make an HTTP request to the backend
	 */
	private async request<T>(
		method: string,
		path: string,
		body?: unknown
	): Promise<ApiResponse<T>> {
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), this.timeout);

		try {
			const response = await fetch(`${this.baseUrl}${path}`, {
				method,
				headers: {
					'Content-Type': 'application/json'
				},
				body: body ? JSON.stringify(body) : undefined,
				signal: controller.signal
			});

			clearTimeout(timeoutId);

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				return { error: errorData.error || `HTTP ${response.status}: ${response.statusText}` };
			}

			const data = await response.json();
			return { data };
		} catch (err) {
			clearTimeout(timeoutId);

			if (err instanceof Error) {
				if (err.name === 'AbortError') {
					return { error: 'Request timed out' };
				}
				return { error: err.message };
			}
			return { error: 'Unknown error occurred' };
		}
	}

	/**
	 * Health check - verify backend is reachable
	 */
	async healthCheck(): Promise<boolean> {
		const result = await this.request<{ status: string }>('GET', '/health');
		return result.data?.status === 'ok';
	}

	/**
	 * List all chats from backend
	 */
	async listChats(includeArchived: boolean = false): Promise<ApiResponse<BackendChat[]>> {
		const query = includeArchived ? '?include_archived=true' : '';
		return this.request<BackendChat[]>('GET', `/api/v1/chats${query}`);
	}

	/**
	 * Get a single chat with messages
	 */
	async getChat(id: string): Promise<ApiResponse<BackendChat>> {
		return this.request<BackendChat>('GET', `/api/v1/chats/${id}`);
	}

	/**
	 * Create a new chat
	 */
	async createChat(chat: Partial<BackendChat>): Promise<ApiResponse<BackendChat>> {
		return this.request<BackendChat>('POST', '/api/v1/chats', chat);
	}

	/**
	 * Update an existing chat
	 */
	async updateChat(id: string, updates: Partial<BackendChat>): Promise<ApiResponse<BackendChat>> {
		return this.request<BackendChat>('PUT', `/api/v1/chats/${id}`, updates);
	}

	/**
	 * Delete a chat
	 */
	async deleteChat(id: string): Promise<ApiResponse<void>> {
		return this.request<void>('DELETE', `/api/v1/chats/${id}`);
	}

	/**
	 * Create a message in a chat
	 */
	async createMessage(
		chatId: string,
		message: Partial<BackendMessage>
	): Promise<ApiResponse<BackendMessage>> {
		return this.request<BackendMessage>('POST', `/api/v1/chats/${chatId}/messages`, message);
	}

	/**
	 * Push local changes to backend
	 */
	async pushChanges(request: PushChangesRequest): Promise<ApiResponse<PushChangesResponse>> {
		return this.request<PushChangesResponse>('POST', '/api/v1/sync/push', request);
	}

	/**
	 * Pull changes from backend since a given sync version
	 */
	async pullChanges(sinceVersion: number = 0): Promise<ApiResponse<PullChangesResponse>> {
		return this.request<PullChangesResponse>(
			'GET',
			`/api/v1/sync/pull?since_version=${sinceVersion}`
		);
	}
}

/**
 * Get the backend URL from environment or default
 */
function getBackendUrl(): string {
	// In browser, check for PUBLIC_ env var (set by Vite/SvelteKit)
	if (typeof window !== 'undefined') {
		const envUrl = (import.meta.env as Record<string, string>)?.PUBLIC_BACKEND_URL;
		if (envUrl) return envUrl;
	}

	// Default: use empty string to go through Vite proxy (/api/v1 -> backend:9090)
	return '';
}

/** Singleton backend client instance */
export const backendClient = new BackendClient({
	baseUrl: getBackendUrl(),
	timeout: 30000
});
