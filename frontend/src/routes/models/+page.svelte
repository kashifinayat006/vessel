<script lang="ts">
	/**
	 * Model Browser Page
	 * Browse and search models from ollama.com, manage local models
	 * Heavy operations (filtering, sorting, pagination, updates) handled by backend
	 */
	import { onMount } from 'svelte';
	import { modelRegistry } from '$lib/stores/model-registry.svelte';
	import { localModelsState } from '$lib/stores/local-models.svelte';
	import { modelsState } from '$lib/stores/models.svelte';
	import { ModelCard } from '$lib/components/models';
	import { fetchTagSizes, type RemoteModel } from '$lib/api/model-registry';

	// Search debounce
	let searchInput = $state('');
	let searchTimeout: ReturnType<typeof setTimeout> | null = null;

	// Debounced search handler
	function handleSearchInput(e: Event): void {
		const value = (e.target as HTMLInputElement).value;
		searchInput = value;

		if (searchTimeout) clearTimeout(searchTimeout);
		searchTimeout = setTimeout(() => {
			modelRegistry.search(value);
		}, 300);
	}

	// Type filter handler
	function handleTypeFilter(type: 'official' | 'community' | ''): void {
		modelRegistry.filterByType(type);
	}

	// Selected model for details panel
	let selectedModel = $state<RemoteModel | null>(null);
	let selectedTag = $state<string>('');
	let pulling = $state(false);
	let pullProgress = $state<{ status: string; completed?: number; total?: number } | null>(null);
	let pullError = $state<string | null>(null);
	let loadingSizes = $state(false);

	async function handleSelectModel(model: RemoteModel): Promise<void> {
		selectedModel = model;
		selectedTag = model.tags[0] || '';
		pullProgress = null;
		pullError = null;

		// Fetch tag sizes if not already loaded
		if (!model.tagSizes || Object.keys(model.tagSizes).length === 0) {
			loadingSizes = true;
			try {
				const updatedModel = await fetchTagSizes(model.slug);
				// Update the model with fetched sizes
				selectedModel = { ...model, tagSizes: updatedModel.tagSizes };
			} catch (err) {
				console.error('Failed to fetch tag sizes:', err);
			} finally {
				loadingSizes = false;
			}
		}
	}

	function closeDetails(): void {
		selectedModel = null;
		selectedTag = '';
		pullProgress = null;
		pullError = null;
	}

	// Pull model from Ollama
	async function pullModel(): Promise<void> {
		if (!selectedModel || pulling) return;

		const modelName = selectedTag
			? `${selectedModel.slug}:${selectedTag}`
			: selectedModel.slug;

		pulling = true;
		pullError = null;
		pullProgress = { status: 'Starting pull...' };

		try {
			const response = await fetch('/api/v1/ollama/api/pull', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: modelName })
			});

			if (!response.ok) {
				throw new Error(`Failed to pull model: ${response.statusText}`);
			}

			// Read streaming response
			const reader = response.body?.getReader();
			if (!reader) throw new Error('No response body');

			const decoder = new TextDecoder();
			let buffer = '';

			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				buffer += decoder.decode(value, { stream: true });
				const lines = buffer.split('\n');
				buffer = lines.pop() || '';

				for (const line of lines) {
					if (!line.trim()) continue;
					try {
						const data = JSON.parse(line);
						if (data.error) {
							pullError = data.error;
							break;
						}
						pullProgress = {
							status: data.status || 'Pulling...',
							completed: data.completed,
							total: data.total
						};
					} catch {
						// Skip invalid JSON
					}
				}
			}

			if (!pullError) {
				pullProgress = { status: 'Pull complete!' };
				// Refresh local model list and select the new model
				await modelsState.refresh();
				modelsState.select(modelName);
			}
		} catch (err) {
			pullError = err instanceof Error ? err.message : 'Failed to pull model';
		} finally {
			pulling = false;
		}
	}

	// Format date for display
	function formatDate(dateStr: string | undefined): string {
		if (!dateStr) return 'Never';
		const date = new Date(dateStr);
		return date.toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	// Format bytes for display (e.g., 1.5 GB)
	function formatBytes(bytes: number): string {
		if (bytes === 0) return '0 B';
		const units = ['B', 'KB', 'MB', 'GB', 'TB'];
		const k = 1024;
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		const value = bytes / Math.pow(k, i);
		return `${value.toFixed(i > 1 ? 1 : 0)} ${units[i]}`;
	}

	// Delete model state
	let deleteConfirm = $state<string | null>(null);
	let deleting = $state(false);
	let deleteError = $state<string | null>(null);

	// Delete a local model
	async function deleteModel(modelName: string): Promise<void> {
		if (deleting) return;

		deleting = true;
		deleteError = null;

		try {
			const response = await fetch('/api/v1/ollama/api/delete', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: modelName })
			});

			if (!response.ok) {
				const data = await response.json();
				throw new Error(data.error || `Failed to delete: ${response.statusText}`);
			}

			// Refresh local model list (uses backend API)
			await localModelsState.refresh();
			await modelsState.refresh(); // Also refresh the chat model selector
			deleteConfirm = null;
		} catch (err) {
			deleteError = err instanceof Error ? err.message : 'Failed to delete model';
		} finally {
			deleting = false;
		}
	}

	// Tab state: 'local' or 'browse'
	let activeTab = $state<'local' | 'browse'>('local');

	// Local search debounce
	let localSearchInput = $state('');
	let localSearchTimeout: ReturnType<typeof setTimeout> | null = null;

	function handleLocalSearchInput(e: Event): void {
		const value = (e.target as HTMLInputElement).value;
		localSearchInput = value;

		if (localSearchTimeout) clearTimeout(localSearchTimeout);
		localSearchTimeout = setTimeout(() => {
			localModelsState.search(value);
		}, 300);
	}

	// Initialize on mount
	onMount(() => {
		// Initialize stores (backend handles heavy operations)
		localModelsState.init();
		modelRegistry.init();
		modelsState.refresh();
	});
</script>

<div class="flex h-full overflow-hidden bg-slate-900">
	<!-- Main Content -->
	<div class="flex-1 overflow-y-auto p-6">
		<div class="mx-auto max-w-6xl">
			<!-- Header -->
			<div class="mb-6 flex items-start justify-between gap-4">
				<div>
					<h1 class="text-2xl font-bold text-white">Models</h1>
					<p class="mt-1 text-sm text-slate-400">
						Manage local models and browse ollama.com
					</p>
				</div>

				<!-- Actions -->
				<div class="flex items-center gap-3">
					{#if activeTab === 'browse' && modelRegistry.syncStatus}
						<div class="text-right text-xs text-slate-500">
							<div>{modelRegistry.syncStatus.modelCount} models cached</div>
							<div>Last sync: {formatDate(modelRegistry.syncStatus.lastSync ?? undefined)}</div>
						</div>
					{/if}
					{#if activeTab === 'browse'}
						<button
							type="button"
							onclick={() => modelRegistry.sync()}
							disabled={modelRegistry.syncing}
							class="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
						>
							{#if modelRegistry.syncing}
								<svg class="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
									<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
									<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
								</svg>
								<span>Syncing...</span>
							{:else}
								<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
									<path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
								</svg>
								<span>Sync Models</span>
							{/if}
						</button>
					{:else}
						<button
							type="button"
							onclick={() => localModelsState.checkUpdates()}
							disabled={localModelsState.isCheckingUpdates}
							class="flex items-center gap-2 rounded-lg border border-amber-700 bg-amber-900/20 px-4 py-2 text-sm font-medium text-amber-300 transition-colors hover:bg-amber-900/40 disabled:cursor-not-allowed disabled:opacity-50"
						>
							{#if localModelsState.isCheckingUpdates}
								<svg class="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
									<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
									<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
								</svg>
								<span>Checking...</span>
							{:else}
								<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
									<path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
								</svg>
								<span>Check Updates</span>
							{/if}
						</button>
						<button
							type="button"
							onclick={() => localModelsState.refresh()}
							disabled={localModelsState.loading}
							class="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
						>
							{#if localModelsState.loading}
								<svg class="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
									<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
									<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
								</svg>
							{:else}
								<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
									<path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
								</svg>
							{/if}
							<span>Refresh</span>
						</button>
					{/if}
				</div>
			</div>

			<!-- Tabs -->
			<div class="mb-6 flex border-b border-slate-700">
				<button
					type="button"
					onclick={() => activeTab = 'local'}
					class="flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition-colors {activeTab === 'local'
						? 'border-blue-500 text-blue-400'
						: 'border-transparent text-slate-400 hover:text-white'}"
				>
					<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
					</svg>
					Local Models
					<span class="rounded-full bg-slate-700 px-2 py-0.5 text-xs">{localModelsState.total}</span>
					{#if localModelsState.updatesAvailable > 0}
						<span class="rounded-full bg-amber-600 px-2 py-0.5 text-xs text-white" title="{localModelsState.updatesAvailable} update{localModelsState.updatesAvailable !== 1 ? 's' : ''} available">
							{localModelsState.updatesAvailable}
						</span>
					{/if}
				</button>
				<button
					type="button"
					onclick={() => activeTab = 'browse'}
					class="flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition-colors {activeTab === 'browse'
						? 'border-blue-500 text-blue-400'
						: 'border-transparent text-slate-400 hover:text-white'}"
				>
					<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
					</svg>
					Browse ollama.com
				</button>
			</div>

			<!-- Local Models Tab -->
			{#if activeTab === 'local'}
				<!-- Delete Error -->
				{#if deleteError}
					<div class="mb-4 rounded-lg border border-red-900/50 bg-red-900/20 p-4">
						<div class="flex items-center gap-2 text-red-400">
							<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
							</svg>
							<span>{deleteError}</span>
							<button type="button" onclick={() => deleteError = null} class="ml-auto text-red-400 hover:text-red-300">
								<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
									<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
								</svg>
							</button>
						</div>
					</div>
				{/if}

				<!-- Local Models Search/Filter Bar -->
				<div class="mb-4 flex flex-wrap items-center gap-4">
					<!-- Search Input -->
					<div class="relative flex-1 min-w-[200px]">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							stroke-width="2"
						>
							<path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
						</svg>
						<input
							type="text"
							value={localSearchInput}
							oninput={handleLocalSearchInput}
							placeholder="Search local models..."
							class="w-full rounded-lg border border-slate-700 bg-slate-800 py-2 pl-10 pr-4 text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
						/>
					</div>

					<!-- Family Filter -->
					{#if localModelsState.families.length > 0}
						<select
							value={localModelsState.familyFilter}
							onchange={(e) => localModelsState.filterByFamily((e.target as HTMLSelectElement).value)}
							class="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
						>
							<option value="">All Families</option>
							{#each localModelsState.families as family}
								<option value={family}>{family}</option>
							{/each}
						</select>
					{/if}

					<!-- Sort Dropdown -->
					<select
						value={localModelsState.sortBy}
						onchange={(e) => localModelsState.setSort((e.target as HTMLSelectElement).value as import('$lib/api/model-registry').LocalModelSortOption)}
						class="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
					>
						<option value="name_asc">Name A-Z</option>
						<option value="name_desc">Name Z-A</option>
						<option value="size_desc">Largest</option>
						<option value="size_asc">Smallest</option>
						<option value="modified_desc">Recently Modified</option>
						<option value="modified_asc">Oldest Modified</option>
					</select>

					<!-- Clear Filters -->
					{#if localModelsState.searchQuery || localModelsState.familyFilter || localModelsState.sortBy !== 'name_asc'}
						<button
							type="button"
							onclick={() => { localModelsState.clearFilters(); localSearchInput = ''; }}
							class="text-sm text-slate-500 hover:text-white"
						>
							Clear filters
						</button>
					{/if}
				</div>

				{#if localModelsState.loading}
					<div class="space-y-3">
						{#each Array(3) as _}
							<div class="animate-pulse rounded-lg border border-slate-700 bg-slate-800 p-4">
								<div class="flex items-center justify-between">
									<div class="h-5 w-48 rounded bg-slate-700"></div>
									<div class="h-5 w-20 rounded bg-slate-700"></div>
								</div>
							</div>
						{/each}
					</div>
				{:else if localModelsState.models.length === 0}
					<div class="rounded-lg border border-dashed border-slate-700 bg-slate-800/50 p-12 text-center">
						<svg xmlns="http://www.w3.org/2000/svg" class="mx-auto h-12 w-12 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
							<path stroke-linecap="round" stroke-linejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
						</svg>
						<h3 class="mt-4 text-sm font-medium text-slate-400">
							{#if localModelsState.searchQuery || localModelsState.familyFilter}
								No models match your filters
							{:else}
								No local models
							{/if}
						</h3>
						<p class="mt-1 text-sm text-slate-500">
							{#if localModelsState.searchQuery || localModelsState.familyFilter}
								Try adjusting your search or filters
							{:else}
								Browse ollama.com to pull models
							{/if}
						</p>
						{#if !localModelsState.searchQuery && !localModelsState.familyFilter}
							<button
								type="button"
								onclick={() => activeTab = 'browse'}
								class="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
							>
								Browse Models
							</button>
						{/if}
					</div>
				{:else}
					<div class="space-y-2">
						{#each localModelsState.models as model (model.name)}
							<div class="group rounded-lg border border-slate-700 bg-slate-800 p-4 transition-colors hover:border-slate-600">
								<div class="flex items-center justify-between">
									<div class="flex-1">
										<div class="flex items-center gap-3">
											<h3 class="font-medium text-white">{model.name}</h3>
											{#if model.name === modelsState.selectedId}
												<span class="rounded bg-blue-900/50 px-2 py-0.5 text-xs text-blue-300">Selected</span>
											{/if}
											{#if localModelsState.hasUpdate(model.name)}
												<span class="rounded bg-amber-600 px-2 py-0.5 text-xs font-medium text-white" title="Update available - re-pull to get the latest version">
													Update
												</span>
											{/if}
										</div>
										<div class="mt-1 flex items-center gap-4 text-xs text-slate-500">
											<span>{formatBytes(model.size)}</span>
											<span>Family: {model.family}</span>
											<span>Parameters: {model.parameterSize}</span>
											<span>Quantization: {model.quantizationLevel}</span>
										</div>
									</div>
									<div class="flex items-center gap-2">
										{#if deleteConfirm === model.name}
											<span class="text-sm text-slate-400">Delete?</span>
											<button
												type="button"
												onclick={() => deleteModel(model.name)}
												disabled={deleting}
												class="rounded bg-red-600 px-3 py-1 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
											>
												{deleting ? 'Deleting...' : 'Yes'}
											</button>
											<button
												type="button"
												onclick={() => deleteConfirm = null}
												disabled={deleting}
												class="rounded bg-slate-700 px-3 py-1 text-sm font-medium text-slate-300 hover:bg-slate-600 disabled:opacity-50"
											>
												No
											</button>
										{:else}
											<button
												type="button"
												onclick={() => deleteConfirm = model.name}
												class="rounded p-2 text-slate-500 opacity-0 transition-opacity hover:bg-slate-700 hover:text-red-400 group-hover:opacity-100"
												title="Delete model"
											>
												<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
													<path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
												</svg>
											</button>
										{/if}
									</div>
								</div>
							</div>
						{/each}
					</div>

					<!-- Local Models Pagination -->
					{#if localModelsState.totalPages > 1}
						<div class="mt-6 flex items-center justify-center gap-2">
							<button
								type="button"
								onclick={() => localModelsState.prevPage()}
								disabled={!localModelsState.hasPrevPage}
								class="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
								aria-label="Previous page"
							>
								← Prev
							</button>
							<span class="px-3 text-sm text-slate-400">
								Page {localModelsState.currentPage + 1} of {localModelsState.totalPages}
							</span>
							<button
								type="button"
								onclick={() => localModelsState.nextPage()}
								disabled={!localModelsState.hasNextPage}
								class="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
								aria-label="Next page"
							>
								Next →
							</button>
						</div>
					{/if}
				{/if}
			{:else}

			<!-- Search and Filters -->
			<div class="mb-6 flex flex-wrap items-center gap-4">
				<!-- Search Input -->
				<div class="relative flex-1 min-w-[200px]">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="2"
					>
						<path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
					</svg>
					<input
						type="text"
						value={searchInput}
						oninput={handleSearchInput}
						placeholder="Search models..."
						class="w-full rounded-lg border border-slate-700 bg-slate-800 py-2 pl-10 pr-4 text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
					/>
				</div>

				<!-- Type Filter -->
				<div class="flex rounded-lg border border-slate-700 bg-slate-800 p-1">
					<button
						type="button"
						onclick={() => handleTypeFilter('')}
						class="rounded-md px-3 py-1.5 text-sm font-medium transition-colors {modelRegistry.modelType === ''
							? 'bg-slate-700 text-white'
							: 'text-slate-400 hover:text-white'}"
					>
						All
					</button>
					<button
						type="button"
						onclick={() => handleTypeFilter('official')}
						class="rounded-md px-3 py-1.5 text-sm font-medium transition-colors {modelRegistry.modelType === 'official'
							? 'bg-blue-600 text-white'
							: 'text-slate-400 hover:text-white'}"
					>
						Official
					</button>
					<button
						type="button"
						onclick={() => handleTypeFilter('community')}
						class="rounded-md px-3 py-1.5 text-sm font-medium transition-colors {modelRegistry.modelType === 'community'
							? 'bg-slate-600 text-white'
							: 'text-slate-400 hover:text-white'}"
					>
						Community
					</button>
				</div>

				<!-- Sort Dropdown -->
				<div class="flex items-center gap-2">
					<label for="sort-select" class="text-sm text-slate-500">Sort:</label>
					<select
						id="sort-select"
						value={modelRegistry.sortBy}
						onchange={(e) => modelRegistry.setSort((e.target as HTMLSelectElement).value as import('$lib/api/model-registry').ModelSortOption)}
						class="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
					>
						<option value="pulls_desc">Most Popular</option>
						<option value="pulls_asc">Least Popular</option>
						<option value="name_asc">Name A-Z</option>
						<option value="name_desc">Name Z-A</option>
						<option value="updated_desc">Recently Updated</option>
					</select>
				</div>

				<!-- Results Count -->
				<div class="text-sm text-slate-500">
					{modelRegistry.total} model{modelRegistry.total !== 1 ? 's' : ''} found
				</div>
			</div>

			<!-- Capability Filters (matches ollama.com capabilities) -->
			<div class="mb-6 flex flex-wrap items-center gap-2">
				<span class="text-sm text-slate-500">Capabilities:</span>
				<button
					type="button"
					onclick={() => modelRegistry.toggleCapability('vision')}
					class="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm transition-colors {modelRegistry.hasCapability('vision')
						? 'bg-purple-600 text-white'
						: 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'}"
				>
					<span>👁</span>
					<span>Vision</span>
				</button>
				<button
					type="button"
					onclick={() => modelRegistry.toggleCapability('tools')}
					class="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm transition-colors {modelRegistry.hasCapability('tools')
						? 'bg-blue-600 text-white'
						: 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'}"
				>
					<span>🔧</span>
					<span>Tools</span>
				</button>
				<button
					type="button"
					onclick={() => modelRegistry.toggleCapability('thinking')}
					class="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm transition-colors {modelRegistry.hasCapability('thinking')
						? 'bg-pink-600 text-white'
						: 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'}"
				>
					<span>🧠</span>
					<span>Thinking</span>
				</button>
				<button
					type="button"
					onclick={() => modelRegistry.toggleCapability('embedding')}
					class="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm transition-colors {modelRegistry.hasCapability('embedding')
						? 'bg-amber-600 text-white'
						: 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'}"
				>
					<span>📊</span>
					<span>Embedding</span>
				</button>
				<button
					type="button"
					onclick={() => modelRegistry.toggleCapability('cloud')}
					class="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm transition-colors {modelRegistry.hasCapability('cloud')
						? 'bg-cyan-600 text-white'
						: 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'}"
				>
					<span>☁️</span>
					<span>Cloud</span>
				</button>

				{#if modelRegistry.selectedCapabilities.length > 0 || modelRegistry.modelType || modelRegistry.searchQuery || modelRegistry.sortBy !== 'pulls_desc'}
					<button
						type="button"
						onclick={() => { modelRegistry.clearFilters(); searchInput = ''; }}
						class="ml-2 text-sm text-slate-500 hover:text-white"
					>
						Clear filters
					</button>
				{/if}
			</div>

			<!-- Error Display -->
			{#if modelRegistry.error}
				<div class="mb-6 rounded-lg border border-red-900/50 bg-red-900/20 p-4">
					<div class="flex items-center gap-2 text-red-400">
						<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
						</svg>
						<span>{modelRegistry.error}</span>
					</div>
				</div>
			{/if}

			<!-- Loading State -->
			{#if modelRegistry.loading}
				<div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
					{#each Array(6) as _}
						<div class="animate-pulse rounded-lg border border-slate-700 bg-slate-800 p-4">
							<div class="flex items-start justify-between">
								<div class="h-5 w-32 rounded bg-slate-700"></div>
								<div class="h-5 w-16 rounded bg-slate-700"></div>
							</div>
							<div class="mt-3 h-4 w-full rounded bg-slate-700"></div>
							<div class="mt-2 h-4 w-2/3 rounded bg-slate-700"></div>
							<div class="mt-4 flex gap-2">
								<div class="h-6 w-16 rounded bg-slate-700"></div>
								<div class="h-6 w-16 rounded bg-slate-700"></div>
							</div>
						</div>
					{/each}
				</div>
			{:else if modelRegistry.models.length === 0}
				<!-- Empty State -->
				<div class="rounded-lg border border-dashed border-slate-700 bg-slate-800/50 p-12 text-center">
					<svg xmlns="http://www.w3.org/2000/svg" class="mx-auto h-12 w-12 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
						<path stroke-linecap="round" stroke-linejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611l-.628.105a9.002 9.002 0 01-9.014 0l-.628-.105c-1.717-.293-2.3-2.379-1.067-3.61L5 14.5" />
					</svg>
					<h3 class="mt-4 text-sm font-medium text-slate-400">No models found</h3>
					<p class="mt-1 text-sm text-slate-500">
						{#if modelRegistry.searchQuery || modelRegistry.modelType}
							Try adjusting your search or filters
						{:else}
							Click "Sync Models" to fetch models from ollama.com
						{/if}
					</p>
				</div>
			{:else}
				<!-- Model Grid -->
				<div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
					{#each modelRegistry.models as model (model.slug)}
						<ModelCard {model} onSelect={handleSelectModel} />
					{/each}
				</div>

				<!-- Pagination -->
				{#if modelRegistry.totalPages > 1}
					<div class="mt-6 flex items-center justify-center gap-2">
						<button
							type="button"
							onclick={() => modelRegistry.prevPage()}
							disabled={!modelRegistry.hasPrevPage}
							class="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-400 transition-colors hover:bg-slate-700 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
						>
							<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
							</svg>
						</button>

						<span class="text-sm text-slate-400">
							Page {modelRegistry.currentPage + 1} of {modelRegistry.totalPages}
						</span>

						<button
							type="button"
							onclick={() => modelRegistry.nextPage()}
							disabled={!modelRegistry.hasNextPage}
							class="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-400 transition-colors hover:bg-slate-700 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
						>
							<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
							</svg>
						</button>
					</div>
				{/if}
			{/if}
			{/if}
		</div>
	</div>

	<!-- Model Details Sidebar -->
	{#if selectedModel}
		<div class="w-96 flex-shrink-0 overflow-y-auto border-l border-slate-700 bg-slate-850 p-6">
			<!-- Close Button -->
			<div class="mb-4 flex items-start justify-between">
				<h2 class="text-lg font-semibold text-white">{selectedModel.name}</h2>
				<button
					type="button"
					onclick={closeDetails}
					class="rounded p-1 text-slate-400 transition-colors hover:bg-slate-700 hover:text-white"
				>
					<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>

			<!-- Type Badge -->
			<div class="mb-4">
				<span class="rounded px-2 py-1 text-xs {selectedModel.modelType === 'official' ? 'bg-blue-900/50 text-blue-300' : 'bg-slate-700 text-slate-400'}">
					{selectedModel.modelType}
				</span>
			</div>

			<!-- Description -->
			{#if selectedModel.description}
				<div class="mb-6">
					<h3 class="mb-2 text-sm font-medium text-slate-300">Description</h3>
					<p class="text-sm text-slate-400">{selectedModel.description}</p>
				</div>
			{/if}

			<!-- Capabilities -->
			{#if selectedModel.capabilities.length > 0}
				<div class="mb-6">
					<h3 class="mb-2 text-sm font-medium text-slate-300">Capabilities</h3>
					<div class="flex flex-wrap gap-2">
						{#each selectedModel.capabilities as cap}
							<span class="rounded bg-slate-700 px-2 py-1 text-xs text-slate-300">{cap}</span>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Technical Details -->
			<div class="mb-6 space-y-3">
				<h3 class="text-sm font-medium text-slate-300">Details</h3>

				{#if selectedModel.architecture}
					<div class="flex justify-between text-sm">
						<span class="text-slate-500">Architecture</span>
						<span class="text-slate-300">{selectedModel.architecture}</span>
					</div>
				{/if}

				{#if selectedModel.parameterSize}
					<div class="flex justify-between text-sm">
						<span class="text-slate-500">Parameters</span>
						<span class="text-slate-300">{selectedModel.parameterSize}</span>
					</div>
				{/if}

				{#if selectedModel.contextLength}
					<div class="flex justify-between text-sm">
						<span class="text-slate-500">Context Length</span>
						<span class="text-slate-300">{selectedModel.contextLength.toLocaleString()}</span>
					</div>
				{/if}

				{#if selectedModel.embeddingLength}
					<div class="flex justify-between text-sm">
						<span class="text-slate-500">Embedding Dim</span>
						<span class="text-slate-300">{selectedModel.embeddingLength.toLocaleString()}</span>
					</div>
				{/if}

				{#if selectedModel.quantization}
					<div class="flex justify-between text-sm">
						<span class="text-slate-500">Quantization</span>
						<span class="text-slate-300">{selectedModel.quantization}</span>
					</div>
				{/if}

				{#if selectedModel.license}
					<div class="flex justify-between text-sm">
						<span class="text-slate-500">License</span>
						<span class="text-slate-300">{selectedModel.license}</span>
					</div>
				{/if}

				<div class="flex justify-between text-sm">
					<span class="text-slate-500">Downloads</span>
					<span class="text-slate-300">{selectedModel.pullCount.toLocaleString()}</span>
				</div>
			</div>

			<!-- Available Sizes (Parameter counts + file sizes) -->
			{#if selectedModel.tags.length > 0}
				<div class="mb-6">
					<h3 class="mb-2 flex items-center gap-2 text-sm font-medium text-slate-300">
						<span>Available Sizes</span>
						{#if loadingSizes}
							<svg class="h-3 w-3 animate-spin text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
								<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
								<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
							</svg>
						{/if}
					</h3>
					<div class="space-y-1">
						{#each selectedModel.tags as tag}
							{@const size = selectedModel.tagSizes?.[tag]}
							<div class="flex items-center justify-between rounded bg-slate-800 px-2 py-1.5">
								<span class="text-xs font-medium text-blue-300">{tag}</span>
								{#if size}
									<span class="text-xs text-slate-400">{formatBytes(size)}</span>
								{:else if loadingSizes}
									<span class="text-xs text-slate-500">...</span>
								{/if}
							</div>
						{/each}
					</div>
					<p class="mt-2 text-xs text-slate-500">
						Parameter sizes (e.g., 8b = 8 billion parameters)
					</p>
				</div>
			{/if}

			<!-- Pull Model Section -->
			<div class="mb-6">
				<h3 class="mb-2 text-sm font-medium text-slate-300">Pull Model</h3>

				<!-- Tag/Size Selector -->
				{#if selectedModel.tags.length > 0}
					<div class="mb-3">
						<label for="tag-select" class="mb-1 flex items-center gap-2 text-xs text-slate-500">
							<span>Select variant:</span>
							{#if loadingSizes}
								<svg class="h-3 w-3 animate-spin text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
									<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
									<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
								</svg>
							{/if}
						</label>
						<select
							id="tag-select"
							bind:value={selectedTag}
							disabled={pulling}
							class="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
						>
							{#each selectedModel.tags as tag}
								{@const size = selectedModel.tagSizes?.[tag]}
								<option value={tag}>
									{selectedModel.slug}:{tag}
									{#if size}
										({formatBytes(size)})
									{/if}
								</option>
							{/each}
						</select>
					</div>
				{/if}

				<!-- Pull Button -->
				<button
					type="button"
					onclick={pullModel}
					disabled={pulling}
					class="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
				>
					{#if pulling}
						<svg class="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
							<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
							<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
						</svg>
						<span>Pulling...</span>
					{:else}
						<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
						</svg>
						<span>Pull Model</span>
					{/if}
				</button>

				<!-- Progress Display -->
				{#if pullProgress}
					<div class="mt-3 space-y-2">
						<div class="text-xs text-slate-400">{pullProgress.status}</div>
						{#if pullProgress.completed !== undefined && pullProgress.total !== undefined && pullProgress.total > 0}
							{@const percent = Math.round((pullProgress.completed / pullProgress.total) * 100)}
							<div class="h-2 w-full overflow-hidden rounded-full bg-slate-700">
								<div
									class="h-full rounded-full bg-blue-500 transition-all duration-300"
									style="width: {percent}%"
								></div>
							</div>
							<div class="flex justify-between text-xs text-slate-500">
								<span>{formatBytes(pullProgress.completed)}</span>
								<span>{percent}%</span>
								<span>{formatBytes(pullProgress.total)}</span>
							</div>
						{/if}
					</div>
				{/if}

				<!-- Error Display -->
				{#if pullError}
					<div class="mt-3 rounded-lg border border-red-900/50 bg-red-900/20 p-3">
						<div class="flex items-start gap-2 text-sm text-red-400">
							<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
							</svg>
							<span>{pullError}</span>
						</div>
					</div>
				{/if}
			</div>

			<!-- Actions -->
			<div class="space-y-2">
				<a
					href={selectedModel.url}
					target="_blank"
					rel="noopener noreferrer"
					class="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-slate-300 transition-colors hover:bg-slate-700 hover:text-white"
				>
					<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
					</svg>
					View on ollama.com
				</a>
			</div>
		</div>
	{/if}
</div>
