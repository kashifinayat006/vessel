/**
 * Root layout load function
 * Preloads models list from Ollama API
 */

import type { LayoutLoad } from './$types';

export const load: LayoutLoad = async ({ fetch }) => {
	try {
		// Use proxied API path (vite.config.ts proxies /api to Ollama)
		const response = await fetch('/api/tags');

		if (!response.ok) {
			console.error('Failed to fetch models:', response.status, response.statusText);
			return { models: [], modelsError: `Failed to fetch models: ${response.statusText}` };
		}

		const data = await response.json();
		return {
			models: data.models ?? [],
			modelsError: null
		};
	} catch (error) {
		console.error('Error fetching models:', error);
		return {
			models: [],
			modelsError: error instanceof Error ? error.message : 'Failed to connect to Ollama'
		};
	}
};

// Enable client-side rendering
export const ssr = false;
