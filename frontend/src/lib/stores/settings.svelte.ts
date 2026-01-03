/**
 * Settings state management
 * Handles model parameters with localStorage persistence for global defaults
 */

import {
	type ModelParameters,
	type ChatSettings,
	type AutoCompactSettings,
	DEFAULT_MODEL_PARAMETERS,
	DEFAULT_CHAT_SETTINGS,
	DEFAULT_AUTO_COMPACT_SETTINGS,
	PARAMETER_RANGES,
	AUTO_COMPACT_RANGES
} from '$lib/types/settings';
import type { ModelDefaults } from './models.svelte';

const STORAGE_KEY = 'vessel-settings';

/**
 * Settings state class with reactive properties
 */
export class SettingsState {
	// Whether to use custom parameters
	useCustomParameters = $state(false);

	// Model parameters
	temperature = $state(DEFAULT_MODEL_PARAMETERS.temperature);
	top_k = $state(DEFAULT_MODEL_PARAMETERS.top_k);
	top_p = $state(DEFAULT_MODEL_PARAMETERS.top_p);
	num_ctx = $state(DEFAULT_MODEL_PARAMETERS.num_ctx);

	// Panel visibility
	isPanelOpen = $state(false);

	// Auto-compact settings
	autoCompactEnabled = $state(DEFAULT_AUTO_COMPACT_SETTINGS.enabled);
	autoCompactThreshold = $state(DEFAULT_AUTO_COMPACT_SETTINGS.threshold);
	autoCompactPreserveCount = $state(DEFAULT_AUTO_COMPACT_SETTINGS.preserveCount);

	// Derived: Current model parameters object
	modelParameters = $derived.by((): ModelParameters => ({
		temperature: this.temperature,
		top_k: this.top_k,
		top_p: this.top_p,
		num_ctx: this.num_ctx
	}));

	// Derived: Parameters to pass to API (null if using defaults)
	apiParameters = $derived.by((): Partial<ModelParameters> | undefined => {
		if (!this.useCustomParameters) return undefined;

		return {
			temperature: this.temperature,
			top_k: this.top_k,
			top_p: this.top_p,
			num_ctx: this.num_ctx
		};
	});

	constructor() {
		// Load from localStorage on initialization
		if (typeof window !== 'undefined') {
			this.loadFromStorage();
		}
	}

	/**
	 * Toggle the settings panel
	 */
	togglePanel(): void {
		this.isPanelOpen = !this.isPanelOpen;
	}

	/**
	 * Open the settings panel
	 */
	openPanel(): void {
		this.isPanelOpen = true;
	}

	/**
	 * Close the settings panel
	 */
	closePanel(): void {
		this.isPanelOpen = false;
	}

	/**
	 * Toggle whether to use custom parameters
	 * When enabling, optionally initialize from model defaults
	 */
	toggleCustomParameters(modelDefaults?: ModelDefaults): void {
		this.useCustomParameters = !this.useCustomParameters;

		// When enabling custom parameters, initialize from model defaults if provided
		if (this.useCustomParameters && modelDefaults) {
			this.initializeFromModelDefaults(modelDefaults);
		}

		this.saveToStorage();
	}

	/**
	 * Initialize parameters from model defaults
	 * Falls back to hardcoded defaults for any missing values
	 */
	initializeFromModelDefaults(modelDefaults: ModelDefaults): void {
		this.temperature = modelDefaults.temperature ?? DEFAULT_MODEL_PARAMETERS.temperature;
		this.top_k = modelDefaults.top_k ?? DEFAULT_MODEL_PARAMETERS.top_k;
		this.top_p = modelDefaults.top_p ?? DEFAULT_MODEL_PARAMETERS.top_p;
		this.num_ctx = modelDefaults.num_ctx ?? DEFAULT_MODEL_PARAMETERS.num_ctx;
	}

	/**
	 * Update a single parameter
	 */
	updateParameter<K extends keyof ModelParameters>(key: K, value: ModelParameters[K]): void {
		// Validate range
		const range = PARAMETER_RANGES[key];
		const clampedValue = Math.max(range.min, Math.min(range.max, value));

		switch (key) {
			case 'temperature':
				this.temperature = clampedValue;
				break;
			case 'top_k':
				this.top_k = Math.round(clampedValue);
				break;
			case 'top_p':
				this.top_p = clampedValue;
				break;
			case 'num_ctx':
				this.num_ctx = Math.round(clampedValue);
				break;
		}

		this.saveToStorage();
	}

	/**
	 * Reset all parameters to model defaults (or hardcoded defaults if not available)
	 */
	resetToDefaults(modelDefaults?: ModelDefaults): void {
		this.temperature = modelDefaults?.temperature ?? DEFAULT_MODEL_PARAMETERS.temperature;
		this.top_k = modelDefaults?.top_k ?? DEFAULT_MODEL_PARAMETERS.top_k;
		this.top_p = modelDefaults?.top_p ?? DEFAULT_MODEL_PARAMETERS.top_p;
		this.num_ctx = modelDefaults?.num_ctx ?? DEFAULT_MODEL_PARAMETERS.num_ctx;
		this.saveToStorage();
	}

	/**
	 * Toggle auto-compact enabled state
	 */
	toggleAutoCompact(): void {
		this.autoCompactEnabled = !this.autoCompactEnabled;
		this.saveToStorage();
	}

	/**
	 * Update auto-compact threshold
	 */
	updateAutoCompactThreshold(value: number): void {
		const range = AUTO_COMPACT_RANGES.threshold;
		this.autoCompactThreshold = Math.max(range.min, Math.min(range.max, value));
		this.saveToStorage();
	}

	/**
	 * Update auto-compact preserve count
	 */
	updateAutoCompactPreserveCount(value: number): void {
		const range = AUTO_COMPACT_RANGES.preserveCount;
		this.autoCompactPreserveCount = Math.max(range.min, Math.min(range.max, Math.round(value)));
		this.saveToStorage();
	}

	/**
	 * Load settings from localStorage
	 */
	private loadFromStorage(): void {
		try {
			const stored = localStorage.getItem(STORAGE_KEY);
			if (!stored) return;

			const settings: ChatSettings = JSON.parse(stored);

			// Model parameters
			this.useCustomParameters = settings.useCustomParameters ?? false;
			this.temperature = settings.modelParameters?.temperature ?? DEFAULT_MODEL_PARAMETERS.temperature;
			this.top_k = settings.modelParameters?.top_k ?? DEFAULT_MODEL_PARAMETERS.top_k;
			this.top_p = settings.modelParameters?.top_p ?? DEFAULT_MODEL_PARAMETERS.top_p;
			this.num_ctx = settings.modelParameters?.num_ctx ?? DEFAULT_MODEL_PARAMETERS.num_ctx;

			// Auto-compact settings
			this.autoCompactEnabled = settings.autoCompact?.enabled ?? DEFAULT_AUTO_COMPACT_SETTINGS.enabled;
			this.autoCompactThreshold = settings.autoCompact?.threshold ?? DEFAULT_AUTO_COMPACT_SETTINGS.threshold;
			this.autoCompactPreserveCount = settings.autoCompact?.preserveCount ?? DEFAULT_AUTO_COMPACT_SETTINGS.preserveCount;
		} catch (error) {
			console.warn('[Settings] Failed to load from localStorage:', error);
		}
	}

	/**
	 * Save settings to localStorage
	 */
	private saveToStorage(): void {
		try {
			const settings: ChatSettings = {
				useCustomParameters: this.useCustomParameters,
				modelParameters: this.modelParameters,
				autoCompact: {
					enabled: this.autoCompactEnabled,
					threshold: this.autoCompactThreshold,
					preserveCount: this.autoCompactPreserveCount
				}
			};

			localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
		} catch (error) {
			console.warn('[Settings] Failed to save to localStorage:', error);
		}
	}
}

/** Singleton settings state instance */
export const settingsState = new SettingsState();
