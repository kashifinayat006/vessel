/**
 * Server Conversations Store (Lightweight)
 * Uses backend API for all heavy operations - search, filtering, sorting, grouping, pagination
 * Frontend just makes API calls and displays results
 */

import {
	fetchGroupedConversations,
	createConversation,
	updateConversation,
	deleteConversation,
	type ApiChat,
	type ChatGroup,
	type DateGroup
} from '$lib/api/conversations';

/** Conversation for display (with parsed dates) */
export interface ServerConversation {
	id: string;
	title: string;
	model: string;
	isPinned: boolean;
	isArchived: boolean;
	createdAt: Date;
	updatedAt: Date;
}

/** Grouped conversations for display */
export interface ServerGroupedConversations {
	group: DateGroup;
	conversations: ServerConversation[];
}

/** Convert API chat to display conversation */
function toConversation(chat: ApiChat): ServerConversation {
	return {
		id: chat.id,
		title: chat.title,
		model: chat.model,
		isPinned: chat.pinned,
		isArchived: chat.archived,
		createdAt: new Date(chat.created_at),
		updatedAt: new Date(chat.updated_at)
	};
}

/** Server conversations state with backend-powered operations */
class ServerConversationsState {
	// Grouped conversations list
	groups = $state<ServerGroupedConversations[]>([]);
	total = $state(0);
	totalPinned = $state(0);
	loading = $state(false);
	error = $state<string | null>(null);

	// Search/filter state
	searchQuery = $state('');
	includeArchived = $state(false);
	currentPage = $state(0);
	pageSize = $state(100);

	// Derived: total pages
	totalPages = $derived(Math.ceil(this.total / this.pageSize));
	hasNextPage = $derived(this.currentPage < this.totalPages - 1);
	hasPrevPage = $derived(this.currentPage > 0);

	// Derived: flat list of all visible conversations
	all = $derived.by(() => {
		const result: ServerConversation[] = [];
		for (const group of this.groups) {
			result.push(...group.conversations);
		}
		return result;
	});

	/**
	 * Load grouped conversations from backend
	 */
	async loadGrouped(): Promise<void> {
		this.loading = true;
		this.error = null;

		try {
			const response = await fetchGroupedConversations({
				search: this.searchQuery || undefined,
				includeArchived: this.includeArchived,
				limit: this.pageSize,
				offset: this.currentPage * this.pageSize
			});

			// Convert API groups to display format
			this.groups = response.groups.map((g: ChatGroup) => ({
				group: g.group,
				conversations: g.chats.map(toConversation)
			}));
			this.total = response.total;
			this.totalPinned = response.totalPinned;
		} catch (err) {
			this.error = err instanceof Error ? err.message : 'Failed to load conversations';
			console.error('Failed to load conversations:', err);
		} finally {
			this.loading = false;
		}
	}

	/**
	 * Search conversations (resets to first page)
	 */
	async search(query: string): Promise<void> {
		this.searchQuery = query;
		this.currentPage = 0;
		await this.loadGrouped();
	}

	/**
	 * Toggle include archived
	 */
	async toggleArchived(): Promise<void> {
		this.includeArchived = !this.includeArchived;
		this.currentPage = 0;
		await this.loadGrouped();
	}

	/**
	 * Go to next page
	 */
	async nextPage(): Promise<void> {
		if (this.hasNextPage) {
			this.currentPage++;
			await this.loadGrouped();
		}
	}

	/**
	 * Go to previous page
	 */
	async prevPage(): Promise<void> {
		if (this.hasPrevPage) {
			this.currentPage--;
			await this.loadGrouped();
		}
	}

	/**
	 * Clear search
	 */
	async clearSearch(): Promise<void> {
		this.searchQuery = '';
		this.currentPage = 0;
		await this.loadGrouped();
	}

	/**
	 * Create a new conversation
	 */
	async create(title: string, model: string): Promise<ServerConversation> {
		const chat = await createConversation(title, model);
		const conversation = toConversation(chat);
		// Refresh to get updated groups
		await this.loadGrouped();
		return conversation;
	}

	/**
	 * Update a conversation
	 */
	async update(
		id: string,
		updates: { title?: string; model?: string; pinned?: boolean; archived?: boolean }
	): Promise<void> {
		await updateConversation(id, updates);
		// Refresh to get updated groups
		await this.loadGrouped();
	}

	/**
	 * Pin/unpin a conversation
	 */
	async togglePin(id: string): Promise<void> {
		// Find the current pin status
		const conversation = this.all.find((c) => c.id === id);
		if (conversation) {
			await this.update(id, { pinned: !conversation.isPinned });
		}
	}

	/**
	 * Archive/unarchive a conversation
	 */
	async toggleArchive(id: string): Promise<void> {
		const conversation = this.all.find((c) => c.id === id);
		if (conversation) {
			await this.update(id, { archived: !conversation.isArchived });
		}
	}

	/**
	 * Delete a conversation
	 */
	async delete(id: string): Promise<void> {
		await deleteConversation(id);
		// Refresh to get updated groups
		await this.loadGrouped();
	}

	/**
	 * Find a conversation by ID
	 */
	find(id: string): ServerConversation | undefined {
		return this.all.find((c) => c.id === id);
	}

	/**
	 * Refresh - reload conversations
	 */
	async refresh(): Promise<void> {
		await this.loadGrouped();
	}

	/**
	 * Initialize the store
	 */
	async init(): Promise<void> {
		await this.loadGrouped();
	}
}

// Export singleton instance
export const serverConversationsState = new ServerConversationsState();
