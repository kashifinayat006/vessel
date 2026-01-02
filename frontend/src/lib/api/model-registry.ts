/**
 * Model Registry API Client
 * Interacts with the backend model registry for browsing/searching ollama.com models
 */

/** Remote model from ollama.com (cached in backend) */
export interface RemoteModel {
	slug: string;
	name: string;
	description: string;
	modelType: 'official' | 'community';
	architecture?: string;
	parameterSize?: string;
	contextLength?: number;
	embeddingLength?: number;
	quantization?: string;
	capabilities: string[];
	defaultParams?: Record<string, unknown>;
	license?: string;
	pullCount: number;
	tags: string[];
	tagSizes?: Record<string, number>; // Maps tag name to file size in bytes
	ollamaUpdatedAt?: string;
	detailsFetchedAt?: string;
	scrapedAt: string;
	url: string;
}

/** Response from listing/searching models */
export interface ModelListResponse {
	models: RemoteModel[];
	total: number;
	limit: number;
	offset: number;
}

/** Response from sync operation */
export interface SyncResponse {
	synced: number;
	message: string;
}

/** Sync status */
export interface SyncStatus {
	modelCount: number;
	lastSync: string | null;
}

/** Sort options for model list */
export type ModelSortOption = 'name_asc' | 'name_desc' | 'pulls_asc' | 'pulls_desc' | 'updated_desc';

/** Size range filter options */
export type SizeRange = 'small' | 'medium' | 'large' | 'xlarge';

/** Context length range filter options */
export type ContextRange = 'standard' | 'extended' | 'large' | 'unlimited';

/** Search/filter options */
export interface ModelSearchOptions {
	search?: string;
	type?: 'official' | 'community';
	capabilities?: string[];
	sizeRanges?: SizeRange[];
	contextRanges?: ContextRange[];
	family?: string;
	sort?: ModelSortOption;
	limit?: number;
	offset?: number;
}

// Backend API base URL (relative to frontend)
const API_BASE = '/api/v1/models';

/**
 * Fetch remote models with optional search/filter
 */
export async function fetchRemoteModels(options: ModelSearchOptions = {}): Promise<ModelListResponse> {
	const params = new URLSearchParams();

	if (options.search) params.set('search', options.search);
	if (options.type) params.set('type', options.type);
	if (options.capabilities && options.capabilities.length > 0) {
		params.set('capabilities', options.capabilities.join(','));
	}
	if (options.sizeRanges && options.sizeRanges.length > 0) {
		params.set('sizeRange', options.sizeRanges.join(','));
	}
	if (options.contextRanges && options.contextRanges.length > 0) {
		params.set('contextRange', options.contextRanges.join(','));
	}
	if (options.family) params.set('family', options.family);
	if (options.sort) params.set('sort', options.sort);
	if (options.limit) params.set('limit', String(options.limit));
	if (options.offset) params.set('offset', String(options.offset));

	const url = `${API_BASE}/remote${params.toString() ? '?' + params.toString() : ''}`;
	const response = await fetch(url);

	if (!response.ok) {
		throw new Error(`Failed to fetch models: ${response.statusText}`);
	}

	return response.json();
}

/**
 * Get unique model families for filter dropdowns (remote models)
 */
export async function fetchRemoteFamilies(): Promise<string[]> {
	const response = await fetch(`${API_BASE}/remote/families`);

	if (!response.ok) {
		throw new Error(`Failed to fetch families: ${response.statusText}`);
	}

	const data = await response.json();
	return data.families;
}

/**
 * Get a single remote model by slug
 */
export async function getRemoteModel(slug: string): Promise<RemoteModel> {
	const response = await fetch(`${API_BASE}/remote/${encodeURIComponent(slug)}`);

	if (!response.ok) {
		if (response.status === 404) {
			throw new Error(`Model not found: ${slug}`);
		}
		throw new Error(`Failed to fetch model: ${response.statusText}`);
	}

	return response.json();
}

/**
 * Fetch detailed model info via ollama show (requires model to be available locally)
 */
export async function fetchModelDetails(slug: string): Promise<RemoteModel> {
	const response = await fetch(`${API_BASE}/remote/${encodeURIComponent(slug)}/details`, {
		method: 'POST'
	});

	if (!response.ok) {
		throw new Error(`Failed to fetch model details: ${response.statusText}`);
	}

	return response.json();
}

/**
 * Fetch file sizes per tag from ollama.com (scrapes model detail page)
 */
export async function fetchTagSizes(slug: string): Promise<RemoteModel> {
	const response = await fetch(`${API_BASE}/remote/${encodeURIComponent(slug)}/sizes`, {
		method: 'POST'
	});

	if (!response.ok) {
		throw new Error(`Failed to fetch tag sizes: ${response.statusText}`);
	}

	return response.json();
}

/**
 * Sync models from ollama.com
 * @param fetchDetails - If true, also fetches real capabilities from Ollama for installed models
 */
export async function syncModels(fetchDetails: boolean = true): Promise<SyncResponse> {
	const url = fetchDetails ? `${API_BASE}/remote/sync?details=true` : `${API_BASE}/remote/sync`;
	const response = await fetch(url, {
		method: 'POST'
	});

	if (!response.ok) {
		throw new Error(`Failed to sync models: ${response.statusText}`);
	}

	return response.json();
}

/**
 * Get sync status
 */
export async function getSyncStatus(): Promise<SyncStatus> {
	const response = await fetch(`${API_BASE}/remote/status`);

	if (!response.ok) {
		throw new Error(`Failed to get sync status: ${response.statusText}`);
	}

	return response.json();
}

/**
 * Format pull count for display (e.g., "108.2M")
 */
export function formatPullCount(count: number): string {
	if (count >= 1_000_000_000) {
		return `${(count / 1_000_000_000).toFixed(1)}B`;
	}
	if (count >= 1_000_000) {
		return `${(count / 1_000_000).toFixed(1)}M`;
	}
	if (count >= 1_000) {
		return `${(count / 1_000).toFixed(1)}K`;
	}
	return String(count);
}

/**
 * Format context length for display
 */
export function formatContextLength(length: number): string {
	if (length >= 1_000_000) {
		return `${(length / 1_000_000).toFixed(0)}M`;
	}
	if (length >= 1_000) {
		return `${(length / 1_000).toFixed(0)}K`;
	}
	return String(length);
}

/**
 * Check if a model has a specific capability
 */
export function hasCapability(model: RemoteModel, capability: string): boolean {
	return model.capabilities.includes(capability);
}

// ============================================================================
// Local Models API (backend-powered with filter/sort/pagination)
// ============================================================================

/** Local model from Ollama instance */
export interface LocalModel {
	name: string;
	model: string;
	modifiedAt: string;
	size: number;
	digest: string;
	family: string;
	parameterSize: string;
	quantizationLevel: string;
	hasUpdate?: boolean;
	remoteUpdatedAt?: string;
}

/** Response from listing local models */
export interface LocalModelsResponse {
	models: LocalModel[];
	total: number;
	limit: number;
	offset: number;
}

/** Update check response */
export interface UpdateCheckResponse {
	updates: LocalModel[];
	totalLocal: number;
	updatesAvailable: number;
}

/** Sort options for local models */
export type LocalModelSortOption = 'name_asc' | 'name_desc' | 'size_asc' | 'size_desc' | 'modified_asc' | 'modified_desc';

/** Search/filter options for local models */
export interface LocalModelSearchOptions {
	search?: string;
	family?: string;
	sort?: LocalModelSortOption;
	limit?: number;
	offset?: number;
}

/**
 * Fetch local models with filtering, sorting, and pagination (server-side)
 */
export async function fetchLocalModels(options: LocalModelSearchOptions = {}): Promise<LocalModelsResponse> {
	const params = new URLSearchParams();

	if (options.search) params.set('search', options.search);
	if (options.family) params.set('family', options.family);
	if (options.sort) params.set('sort', options.sort);
	if (options.limit) params.set('limit', String(options.limit));
	if (options.offset) params.set('offset', String(options.offset));

	const url = `${API_BASE}/local${params.toString() ? '?' + params.toString() : ''}`;
	const response = await fetch(url);

	if (!response.ok) {
		throw new Error(`Failed to fetch local models: ${response.statusText}`);
	}

	return response.json();
}

/**
 * Get unique model families for filter dropdowns
 */
export async function fetchLocalFamilies(): Promise<string[]> {
	const response = await fetch(`${API_BASE}/local/families`);

	if (!response.ok) {
		throw new Error(`Failed to fetch families: ${response.statusText}`);
	}

	const data = await response.json();
	return data.families;
}

/**
 * Check for available updates (backend compares local vs remote registry)
 */
export async function checkForUpdates(): Promise<UpdateCheckResponse> {
	const response = await fetch(`${API_BASE}/local/updates`);

	if (!response.ok) {
		throw new Error(`Failed to check updates: ${response.statusText}`);
	}

	return response.json();
}
