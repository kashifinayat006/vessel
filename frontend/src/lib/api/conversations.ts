/**
 * Conversations API Client
 * Server-side grouped conversations with search/filter/pagination
 */

/** Date group labels from backend */
export type DateGroup =
	| 'Today'
	| 'Yesterday'
	| 'This Week'
	| 'Last Week'
	| 'This Month'
	| 'Last Month'
	| 'Older';

/** Chat from API response */
export interface ApiChat {
	id: string;
	title: string;
	model: string;
	pinned: boolean;
	archived: boolean;
	created_at: string;
	updated_at: string;
}

/** Group of chats with date label */
export interface ChatGroup {
	group: DateGroup;
	chats: ApiChat[];
}

/** Grouped chats response from backend */
export interface GroupedChatsResponse {
	groups: ChatGroup[];
	total: number;
	totalPinned: number;
}

/** Search options for grouped conversations */
export interface ConversationSearchOptions {
	search?: string;
	includeArchived?: boolean;
	limit?: number;
	offset?: number;
}

const API_BASE = '/api/v1/chats';

/**
 * Fetch grouped conversations with search/filter/pagination (server-side)
 */
export async function fetchGroupedConversations(
	options: ConversationSearchOptions = {}
): Promise<GroupedChatsResponse> {
	const params = new URLSearchParams();

	if (options.search) params.set('search', options.search);
	if (options.includeArchived) params.set('include_archived', 'true');
	if (options.limit) params.set('limit', String(options.limit));
	if (options.offset) params.set('offset', String(options.offset));

	const url = `${API_BASE}/grouped${params.toString() ? '?' + params.toString() : ''}`;
	const response = await fetch(url);

	if (!response.ok) {
		throw new Error(`Failed to fetch conversations: ${response.statusText}`);
	}

	return response.json();
}

/**
 * Fetch all conversations (flat list)
 */
export async function fetchConversations(includeArchived = false): Promise<{ chats: ApiChat[] }> {
	const url = includeArchived ? `${API_BASE}?include_archived=true` : API_BASE;
	const response = await fetch(url);

	if (!response.ok) {
		throw new Error(`Failed to fetch conversations: ${response.statusText}`);
	}

	return response.json();
}

/**
 * Create a new conversation
 */
export async function createConversation(
	title: string,
	model: string
): Promise<ApiChat> {
	const response = await fetch(API_BASE, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ title, model })
	});

	if (!response.ok) {
		throw new Error(`Failed to create conversation: ${response.statusText}`);
	}

	return response.json();
}

/**
 * Update a conversation
 */
export async function updateConversation(
	id: string,
	updates: { title?: string; model?: string; pinned?: boolean; archived?: boolean }
): Promise<ApiChat> {
	const response = await fetch(`${API_BASE}/${id}`, {
		method: 'PUT',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(updates)
	});

	if (!response.ok) {
		throw new Error(`Failed to update conversation: ${response.statusText}`);
	}

	return response.json();
}

/**
 * Delete a conversation
 */
export async function deleteConversation(id: string): Promise<void> {
	const response = await fetch(`${API_BASE}/${id}`, {
		method: 'DELETE'
	});

	if (!response.ok) {
		throw new Error(`Failed to delete conversation: ${response.statusText}`);
	}
}
