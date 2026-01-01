/**
 * Local Models Store (Lightweight)
 * Uses backend API for all heavy operations - filtering, sorting, pagination, update checking
 * Frontend just makes API calls and displays results
 */

import {
	fetchLocalModels,
	fetchLocalFamilies,
	checkForUpdates,
	type LocalModel,
	type LocalModelSortOption,
	type UpdateCheckResponse
} from '$lib/api/model-registry';

/** Local models state with server-side operations */
class LocalModelsState {
	// Model list
	models = $state<LocalModel[]>([]);
	total = $state(0);
	loading = $state(false);
	error = $state<string | null>(null);

	// Search/filter state
	searchQuery = $state('');
	familyFilter = $state('');
	sortBy = $state<LocalModelSortOption>('name_asc');
	currentPage = $state(0);
	pageSize = $state(50);

	// Available families for filter dropdown
	families = $state<string[]>([]);

	// Update status (from backend check)
	updatesAvailable = $state(0);
	modelsWithUpdates = $state<Set<string>>(new Set());
	isCheckingUpdates = $state(false);

	// Derived: total pages
	totalPages = $derived(Math.ceil(this.total / this.pageSize));
	hasNextPage = $derived(this.currentPage < this.totalPages - 1);
	hasPrevPage = $derived(this.currentPage > 0);

	/**
	 * Load models with current filters (server-side filtering/sorting/pagination)
	 */
	async loadModels(): Promise<void> {
		this.loading = true;
		this.error = null;

		try {
			const response = await fetchLocalModels({
				search: this.searchQuery || undefined,
				family: this.familyFilter || undefined,
				sort: this.sortBy,
				limit: this.pageSize,
				offset: this.currentPage * this.pageSize
			});

			this.models = response.models;
			this.total = response.total;
		} catch (err) {
			this.error = err instanceof Error ? err.message : 'Failed to load models';
			console.error('Failed to load local models:', err);
		} finally {
			this.loading = false;
		}
	}

	/**
	 * Load available families for filter dropdown
	 */
	async loadFamilies(): Promise<void> {
		try {
			this.families = await fetchLocalFamilies();
		} catch (err) {
			console.error('Failed to load families:', err);
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
	 * Filter by family
	 */
	async filterByFamily(family: string): Promise<void> {
		this.familyFilter = family;
		this.currentPage = 0;
		await this.loadModels();
	}

	/**
	 * Set sort order
	 */
	async setSort(sort: LocalModelSortOption): Promise<void> {
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
	 * Clear all filters
	 */
	async clearFilters(): Promise<void> {
		this.searchQuery = '';
		this.familyFilter = '';
		this.sortBy = 'name_asc';
		this.currentPage = 0;
		await this.loadModels();
	}

	/**
	 * Check for updates (backend does the heavy comparison)
	 */
	async checkUpdates(): Promise<UpdateCheckResponse> {
		this.isCheckingUpdates = true;

		try {
			const response = await checkForUpdates();

			this.updatesAvailable = response.updatesAvailable;
			this.modelsWithUpdates = new Set(response.updates.map(m => m.name));

			return response;
		} catch (err) {
			console.error('Failed to check updates:', err);
			throw err;
		} finally {
			this.isCheckingUpdates = false;
		}
	}

	/**
	 * Check if a specific model has an update
	 */
	hasUpdate(modelName: string): boolean {
		return this.modelsWithUpdates.has(modelName);
	}

	/**
	 * Refresh - reload models and families
	 */
	async refresh(): Promise<void> {
		await Promise.all([this.loadModels(), this.loadFamilies()]);
	}

	/**
	 * Initialize the store
	 */
	async init(): Promise<void> {
		await this.refresh();
	}
}

// Export singleton instance
export const localModelsState = new LocalModelsState();
