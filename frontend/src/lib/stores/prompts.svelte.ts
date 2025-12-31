/**
 * System prompts state management using Svelte 5 runes
 * Manages system prompt templates with IndexedDB persistence
 */

import {
	getAllPrompts,
	getDefaultPrompt,
	createPrompt,
	updatePrompt,
	deletePrompt,
	setDefaultPrompt,
	clearDefaultPrompt,
	type StoredPrompt
} from '$lib/storage';

/** Prompt for UI display (with Date objects) */
export interface Prompt {
	id: string;
	name: string;
	content: string;
	description: string;
	isDefault: boolean;
	createdAt: Date;
	updatedAt: Date;
}

/** Convert stored prompt to UI prompt */
function toPrompt(stored: StoredPrompt): Prompt {
	return {
		...stored,
		createdAt: new Date(stored.createdAt),
		updatedAt: new Date(stored.updatedAt)
	};
}

/** Prompts state class with reactive properties */
class PromptsState {
	/** All available prompts */
	prompts = $state<Prompt[]>([]);

	/** Currently selected prompt for new chats (null = no system prompt) */
	activePromptId = $state<string | null>(null);

	/** Temporary prompt content for session (overrides activePromptId when set) */
	temporaryPrompt = $state<{ name: string; content: string } | null>(null);

	/** Loading state */
	isLoading = $state(false);

	/** Error state */
	error = $state<string | null>(null);

	/** Promise that resolves when initial load is complete */
	private _readyPromise: Promise<void> | null = null;
	private _readyResolve: (() => void) | null = null;

	/** Derived: active prompt content (temporary takes precedence) */
	get activePrompt(): Prompt | { name: string; content: string } | null {
		// Temporary prompt takes precedence
		if (this.temporaryPrompt) {
			return this.temporaryPrompt;
		}
		if (!this.activePromptId) return null;
		return this.prompts.find(p => p.id === this.activePromptId) ?? null;
	}

	/** Derived: default prompt (marked as default in storage) */
	get defaultPrompt(): Prompt | null {
		return this.prompts.find(p => p.isDefault) ?? null;
	}

	constructor() {
		// Create ready promise
		this._readyPromise = new Promise((resolve) => {
			this._readyResolve = resolve;
		});

		// Load prompts on initialization (client-side only)
		if (typeof window !== 'undefined') {
			this.load();
		} else {
			// SSR: resolve immediately
			this._readyResolve?.();
		}
	}

	/** Wait for initial load to complete */
	async ready(): Promise<void> {
		return this._readyPromise ?? Promise.resolve();
	}

	/**
	 * Load all prompts from IndexedDB
	 */
	async load(): Promise<void> {
		this.isLoading = true;
		this.error = null;

		try {
			const result = await getAllPrompts();
			if (result.success) {
				this.prompts = result.data.map(toPrompt);

				// Set active prompt to the default one (if any)
				const defaultResult = await getDefaultPrompt();
				if (defaultResult.success && defaultResult.data) {
					this.activePromptId = defaultResult.data.id;
				}
			} else {
				this.error = result.error;
			}
		} catch (err) {
			this.error = err instanceof Error ? err.message : 'Failed to load prompts';
		} finally {
			this.isLoading = false;
			// Resolve the ready promise
			this._readyResolve?.();
		}
	}

	/**
	 * Create a new prompt
	 */
	async add(data: {
		name: string;
		content: string;
		description?: string;
		isDefault?: boolean;
	}): Promise<Prompt | null> {
		try {
			const result = await createPrompt(data);
			if (result.success) {
				const prompt = toPrompt(result.data);
				this.prompts = [prompt, ...this.prompts];

				// If this is the new default, update other prompts
				if (prompt.isDefault) {
					this.prompts = this.prompts.map(p =>
						p.id !== prompt.id ? { ...p, isDefault: false } : p
					);
					this.activePromptId = prompt.id;
				}

				return prompt;
			} else {
				this.error = result.error;
				return null;
			}
		} catch (err) {
			this.error = err instanceof Error ? err.message : 'Failed to create prompt';
			return null;
		}
	}

	/**
	 * Update an existing prompt
	 */
	async update(
		id: string,
		updates: Partial<{ name: string; content: string; description: string; isDefault: boolean }>
	): Promise<boolean> {
		try {
			const result = await updatePrompt(id, updates);
			if (result.success) {
				const updated = toPrompt(result.data);
				this.prompts = this.prompts.map(p => {
					if (p.id === id) return updated;
					// Clear default from others if this becomes default
					if (updates.isDefault === true && p.id !== id) {
						return { ...p, isDefault: false };
					}
					return p;
				});

				// Update active prompt if this becomes default
				if (updates.isDefault === true) {
					this.activePromptId = id;
				}

				return true;
			} else {
				this.error = result.error;
				return false;
			}
		} catch (err) {
			this.error = err instanceof Error ? err.message : 'Failed to update prompt';
			return false;
		}
	}

	/**
	 * Delete a prompt
	 */
	async remove(id: string): Promise<boolean> {
		try {
			const result = await deletePrompt(id);
			if (result.success) {
				this.prompts = this.prompts.filter(p => p.id !== id);

				// Clear active prompt if it was deleted
				if (this.activePromptId === id) {
					this.activePromptId = null;
				}

				return true;
			} else {
				this.error = result.error;
				return false;
			}
		} catch (err) {
			this.error = err instanceof Error ? err.message : 'Failed to delete prompt';
			return false;
		}
	}

	/**
	 * Set a prompt as the default
	 */
	async setDefault(id: string): Promise<boolean> {
		try {
			const result = await setDefaultPrompt(id);
			if (result.success) {
				this.prompts = this.prompts.map(p => ({
					...p,
					isDefault: p.id === id
				}));
				this.activePromptId = id;
				return true;
			} else {
				this.error = result.error;
				return false;
			}
		} catch (err) {
			this.error = err instanceof Error ? err.message : 'Failed to set default prompt';
			return false;
		}
	}

	/**
	 * Clear the default prompt
	 */
	async clearDefault(): Promise<boolean> {
		try {
			const result = await clearDefaultPrompt();
			if (result.success) {
				this.prompts = this.prompts.map(p => ({ ...p, isDefault: false }));
				return true;
			} else {
				this.error = result.error;
				return false;
			}
		} catch (err) {
			this.error = err instanceof Error ? err.message : 'Failed to clear default prompt';
			return false;
		}
	}

	/**
	 * Set the active prompt for new chats (without changing the default)
	 */
	setActive(id: string | null): void {
		this.activePromptId = id;
		// Clear temporary prompt when explicitly setting active
		this.temporaryPrompt = null;
	}

	/**
	 * Set a temporary prompt for the current session (overrides stored prompts)
	 * Use this for quick-start prompts from the suggestion cards
	 */
	setTemporaryPrompt(name: string, content: string): void {
		this.temporaryPrompt = { name, content };
	}

	/**
	 * Clear the temporary prompt
	 */
	clearTemporaryPrompt(): void {
		this.temporaryPrompt = null;
	}

	/**
	 * Get a prompt by ID
	 */
	get(id: string): Prompt | undefined {
		return this.prompts.find(p => p.id === id);
	}

	/**
	 * Clear any error state
	 */
	clearError(): void {
		this.error = null;
	}
}

/** Singleton prompts state instance */
export const promptsState = new PromptsState();
