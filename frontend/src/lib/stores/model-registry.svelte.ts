/**
 * Model Registry Store
 * Manages state for browsing and searching remote models from ollama.com
 */

import {
	fetchRemoteModels,
	fetchRemoteFamilies,
	getSyncStatus,
	syncModels,
	type RemoteModel,
	type SyncStatus,
	type ModelSearchOptions,
	type ModelSortOption,
	type SizeRange,
	type ContextRange
} from '$lib/api/model-registry';

/** Store state */
class ModelRegistryState {
	// Model list
	models = $state<RemoteModel[]>([]);
	total = $state(0);
	loading = $state(false);
	error = $state<string | null>(null);

	// Search/filter state
	searchQuery = $state('');
	modelType = $state<'official' | 'community' | ''>('');
	selectedCapabilities = $state<string[]>([]);
	selectedSizeRanges = $state<SizeRange[]>([]);
	selectedContextRanges = $state<ContextRange[]>([]);
	selectedFamily = $state<string>('');
	availableFamilies = $state<string[]>([]);
	sortBy = $state<ModelSortOption>('pulls_desc');
	currentPage = $state(0);
	pageSize = $state(24);

	// Sync status
	syncStatus = $state<SyncStatus | null>(null);
	syncing = $state(false);

	// Selected model for details view
	selectedModel = $state<RemoteModel | null>(null);

	// Derived: total pages
	totalPages = $derived(Math.ceil(this.total / this.pageSize));

	// Derived: has more pages
	hasNextPage = $derived(this.currentPage < this.totalPages - 1);
	hasPrevPage = $derived(this.currentPage > 0);

	/**
	 * Load models with current filters
	 */
	async loadModels(): Promise<void> {
		this.loading = true;
		this.error = null;

		try {
			const options: ModelSearchOptions = {
				limit: this.pageSize,
				offset: this.currentPage * this.pageSize,
				sort: this.sortBy
			};

			if (this.searchQuery.trim()) {
				options.search = this.searchQuery.trim();
			}

			if (this.modelType) {
				options.type = this.modelType;
			}

			if (this.selectedCapabilities.length > 0) {
				options.capabilities = this.selectedCapabilities;
			}

			if (this.selectedSizeRanges.length > 0) {
				options.sizeRanges = this.selectedSizeRanges;
			}

			if (this.selectedContextRanges.length > 0) {
				options.contextRanges = this.selectedContextRanges;
			}

			if (this.selectedFamily) {
				options.family = this.selectedFamily;
			}

			const response = await fetchRemoteModels(options);
			this.models = response.models;
			this.total = response.total;
		} catch (err) {
			this.error = err instanceof Error ? err.message : 'Failed to load models';
			console.error('Failed to load models:', err);
		} finally {
			this.loading = false;
		}
	}

	/**
	 * Search models (resets to first page)
	 */
	async search(query: string): Promise<void> {
		this.searchQuery = query;
		this.currentPage = 0;
		await this.loadModels();
	}

	/**
	 * Filter by model type
	 */
	async filterByType(type: 'official' | 'community' | ''): Promise<void> {
		this.modelType = type;
		this.currentPage = 0;
		await this.loadModels();
	}

	/**
	 * Toggle a capability filter
	 */
	async toggleCapability(capability: string): Promise<void> {
		const index = this.selectedCapabilities.indexOf(capability);
		if (index === -1) {
			this.selectedCapabilities = [...this.selectedCapabilities, capability];
		} else {
			this.selectedCapabilities = this.selectedCapabilities.filter((c) => c !== capability);
		}
		this.currentPage = 0;
		await this.loadModels();
	}

	/**
	 * Check if a capability is selected
	 */
	hasCapability(capability: string): boolean {
		return this.selectedCapabilities.includes(capability);
	}

	/**
	 * Toggle a size range filter
	 */
	async toggleSizeRange(size: SizeRange): Promise<void> {
		const index = this.selectedSizeRanges.indexOf(size);
		if (index === -1) {
			this.selectedSizeRanges = [...this.selectedSizeRanges, size];
		} else {
			this.selectedSizeRanges = this.selectedSizeRanges.filter((s) => s !== size);
		}
		this.currentPage = 0;
		await this.loadModels();
	}

	/**
	 * Check if a size range is selected
	 */
	hasSizeRange(size: SizeRange): boolean {
		return this.selectedSizeRanges.includes(size);
	}

	/**
	 * Toggle a context range filter
	 */
	async toggleContextRange(range: ContextRange): Promise<void> {
		const index = this.selectedContextRanges.indexOf(range);
		if (index === -1) {
			this.selectedContextRanges = [...this.selectedContextRanges, range];
		} else {
			this.selectedContextRanges = this.selectedContextRanges.filter((r) => r !== range);
		}
		this.currentPage = 0;
		await this.loadModels();
	}

	/**
	 * Check if a context range is selected
	 */
	hasContextRange(range: ContextRange): boolean {
		return this.selectedContextRanges.includes(range);
	}

	/**
	 * Set family filter
	 */
	async setFamily(family: string): Promise<void> {
		this.selectedFamily = family;
		this.currentPage = 0;
		await this.loadModels();
	}

	/**
	 * Load available families for filter dropdown
	 */
	async loadFamilies(): Promise<void> {
		try {
			this.availableFamilies = await fetchRemoteFamilies();
		} catch (err) {
			console.error('Failed to load families:', err);
		}
	}

	/**
	 * Set sort order
	 */
	async setSort(sort: ModelSortOption): Promise<void> {
		this.sortBy = sort;
		this.currentPage = 0;
		await this.loadModels();
	}

	/**
	 * Go to next page
	 */
	async nextPage(): Promise<void> {
		if (this.hasNextPage) {
			this.currentPage++;
			await this.loadModels();
		}
	}

	/**
	 * Go to previous page
	 */
	async prevPage(): Promise<void> {
		if (this.hasPrevPage) {
			this.currentPage--;
			await this.loadModels();
		}
	}

	/**
	 * Go to specific page
	 */
	async goToPage(page: number): Promise<void> {
		if (page >= 0 && page < this.totalPages) {
			this.currentPage = page;
			await this.loadModels();
		}
	}

	/**
	 * Load sync status
	 */
	async loadSyncStatus(): Promise<void> {
		try {
			this.syncStatus = await getSyncStatus();
		} catch (err) {
			console.error('Failed to load sync status:', err);
		}
	}

	/**
	 * Sync models from ollama.com
	 */
	async sync(): Promise<void> {
		this.syncing = true;
		try {
			await syncModels();
			await this.loadSyncStatus();
			await this.loadModels();
		} catch (err) {
			this.error = err instanceof Error ? err.message : 'Failed to sync models';
			console.error('Failed to sync:', err);
		} finally {
			this.syncing = false;
		}
	}

	/**
	 * Select a model for details view
	 */
	selectModel(model: RemoteModel | null): void {
		this.selectedModel = model;
	}

	/**
	 * Clear search and filters
	 */
	async clearFilters(): Promise<void> {
		this.searchQuery = '';
		this.modelType = '';
		this.selectedCapabilities = [];
		this.selectedSizeRanges = [];
		this.selectedContextRanges = [];
		this.selectedFamily = '';
		this.sortBy = 'pulls_desc';
		this.currentPage = 0;
		await this.loadModels();
	}

	/**
	 * Initialize the store
	 */
	async init(): Promise<void> {
		await Promise.all([this.loadSyncStatus(), this.loadModels(), this.loadFamilies()]);
	}
}

// Export singleton instance
export const modelRegistry = new ModelRegistryState();
