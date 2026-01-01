<script lang="ts">
	/**
	 * ToolCallDisplay - Beautiful tool call visualization
	 * Shows tool name, arguments, and results (collapsed by default)
	 */

	import type { ToolCall } from '$lib/types';

	interface Props {
		toolCalls: ToolCall[];
	}

	let { toolCalls }: Props = $props();

	// Tool metadata for icons and colors
	const toolMeta: Record<string, { icon: string; color: string; label: string }> = {
		get_location: {
			icon: '📍',
			color: 'from-rose-500 to-pink-600',
			label: 'Location'
		},
		web_search: {
			icon: '🔍',
			color: 'from-blue-500 to-cyan-600',
			label: 'Web Search'
		},
		fetch_url: {
			icon: '🌐',
			color: 'from-violet-500 to-purple-600',
			label: 'Fetch URL'
		},
		get_current_time: {
			icon: '🕐',
			color: 'from-amber-500 to-orange-600',
			label: 'Time'
		},
		calculate: {
			icon: '🧮',
			color: 'from-emerald-500 to-teal-600',
			label: 'Calculate'
		}
	};

	const defaultMeta = {
		icon: '⚙️',
		color: 'from-gray-500 to-gray-600',
		label: 'Tool'
	};

	/**
	 * Parse arguments to display-friendly format
	 */
	function parseArgs(argsStr: string): Record<string, unknown> {
		try {
			return JSON.parse(argsStr);
		} catch {
			return { value: argsStr };
		}
	}

	/**
	 * Format a single argument value for display
	 */
	function formatValue(value: unknown): string {
		if (typeof value === 'string') {
			return value.length > 60 ? value.substring(0, 57) + '...' : value;
		}
		if (typeof value === 'boolean') return value ? 'Yes' : 'No';
		if (typeof value === 'number') return String(value);
		if (value === null || value === undefined) return '-';
		return JSON.stringify(value);
	}

	/**
	 * Get human-readable argument label
	 */
	function argLabel(key: string): string {
		const labels: Record<string, string> = {
			query: 'Query',
			url: 'URL',
			highAccuracy: 'High Accuracy',
			maxResults: 'Max Results',
			maxLength: 'Max Length',
			extract: 'Extract',
			expression: 'Expression',
			precision: 'Precision',
			timezone: 'Timezone',
			format: 'Format'
		};
		return labels[key] || key;
	}

	/** Search result item */
	interface SearchResultItem {
		rank: number;
		title: string;
		url: string;
		snippet: string;
	}

	/** Parsed result with structured data */
	interface ParsedResult {
		type: 'search' | 'location' | 'fetch' | 'json' | 'text' | 'empty';
		summary: string;
		full: string;
		searchResults?: SearchResultItem[];
		query?: string;
	}

	/**
	 * Parse result content (could be JSON or plain text)
	 */
	function parseResult(result: string | undefined): ParsedResult {
		if (!result) return { type: 'empty', summary: 'No result', full: '' };

		try {
			const json = JSON.parse(result);

			// Search results
			if (json.results && Array.isArray(json.results) && json.query) {
				const count = json.resultCount || json.results.length;
				return {
					type: 'search',
					summary: `Found ${count} results for "${json.query}"`,
					full: result,
					searchResults: json.results as SearchResultItem[],
					query: json.query
				};
			}

			// Location result
			if (json.location) {
				const loc = json.location;
				const place = loc.city ? `${loc.city}, ${loc.country || ''}` : 'Location detected';
				return { type: 'location', summary: place, full: result };
			}

			// Fetch result with content/text
			if (json.content || json.text) {
				const text = json.content || json.text;
				const title = json.title || json.url || 'Fetched content';
				const chars = typeof text === 'string' ? text.length : 0;
				return {
					type: 'fetch',
					summary: `${title} (${formatBytes(chars)} chars)`,
					full: typeof text === 'string' ? text : result
				};
			}

			// Generic JSON
			return {
				type: 'json',
				summary: `JSON response (${formatBytes(result.length)})`,
				full: JSON.stringify(json, null, 2)
			};
		} catch {
			// Plain text result
			const lines = result.split('\n').length;
			const chars = result.length;
			return {
				type: 'text',
				summary: `${lines} lines, ${formatBytes(chars)}`,
				full: result
			};
		}
	}

	/**
	 * Format byte size for display
	 */
	function formatBytes(bytes: number): string {
		if (bytes < 1000) return `${bytes}`;
		if (bytes < 1000000) return `${(bytes / 1000).toFixed(1)}K`;
		return `${(bytes / 1000000).toFixed(1)}M`;
	}

	// Collapsed state per tool (arguments section)
	let expandedCalls = $state<Set<string>>(new Set());
	// Collapsed state for results (separate, collapsed by default)
	let expandedResults = $state<Set<string>>(new Set());

	function toggleExpand(id: string): void {
		if (expandedCalls.has(id)) {
			expandedCalls.delete(id);
		} else {
			expandedCalls.add(id);
		}
		expandedCalls = new Set(expandedCalls);
	}

	function toggleResult(id: string): void {
		if (expandedResults.has(id)) {
			expandedResults.delete(id);
		} else {
			expandedResults.add(id);
		}
		expandedResults = new Set(expandedResults);
	}
</script>

<div class="my-3 space-y-2">
	{#each toolCalls as call (call.id)}
		{@const meta = toolMeta[call.name] || defaultMeta}
		{@const args = parseArgs(call.arguments)}
		{@const argEntries = Object.entries(args).filter(([_, v]) => v !== undefined && v !== null)}
		{@const isExpanded = expandedCalls.has(call.id)}

		<div
			class="overflow-hidden rounded-xl border border-slate-300 bg-gradient-to-r dark:border-slate-700 {meta.color} p-[1px] shadow-lg"
		>
			<div class="rounded-xl bg-white/95 backdrop-blur dark:bg-slate-800/95">
				<!-- Header -->
				<button
					type="button"
					onclick={() => toggleExpand(call.id)}
					class="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-100/50 dark:hover:bg-slate-700/50"
				>
					<!-- Icon -->
					<span class="text-xl" role="img" aria-label={meta.label}>{meta.icon}</span>

					<!-- Tool name and summary -->
					<div class="min-w-0 flex-1">
						<div class="flex items-center gap-2">
							<span class="font-medium text-slate-800 dark:text-slate-100">{meta.label}</span>
							<span class="font-mono text-xs text-slate-500 dark:text-slate-400">{call.name}</span>
						</div>

						<!-- Quick preview of main argument -->
						{#if argEntries.length > 0}
							{@const [firstKey, firstValue] = argEntries[0]}
							<p class="mt-0.5 truncate text-sm text-slate-500 dark:text-slate-400">
								{#if call.name === 'web_search' && typeof firstValue === 'string'}
									Searching: "{firstValue}"
								{:else if call.name === 'fetch_url' && typeof firstValue === 'string'}
									{firstValue}
								{:else if call.name === 'get_location'}
									Detecting user location...
								{:else if call.name === 'calculate' && typeof firstValue === 'string'}
									{firstValue}
								{:else}
									{formatValue(firstValue)}
								{/if}
							</p>
						{/if}
					</div>

					<!-- Expand indicator -->
					<svg
						class="h-5 w-5 flex-shrink-0 text-slate-400 transition-transform duration-200 dark:text-slate-500"
						class:rotate-180={isExpanded}
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="2"
					>
						<path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
					</svg>
				</button>

				<!-- Expanded arguments -->
				{#if isExpanded && argEntries.length > 0}
					<div class="border-t border-slate-200 px-4 py-3 dark:border-slate-700">
						<div class="space-y-2">
							{#each argEntries as [key, value]}
								<div class="flex items-start gap-3 text-sm">
									<span class="w-24 flex-shrink-0 font-medium text-slate-500 dark:text-slate-400">
										{argLabel(key)}
									</span>
									<span class="break-all font-mono text-slate-700 dark:text-slate-200">
										{formatValue(value)}
									</span>
								</div>
							{/each}
						</div>
					</div>
				{/if}

				<!-- Result section (collapsed by default) -->
				{#if call.result || call.error}
					{@const hasResult = !!call.result}
					{@const parsed = parseResult(call.result)}
					{@const isResultExpanded = expandedResults.has(call.id)}

					<div class="border-t border-slate-200 dark:border-slate-700">
						<button
							type="button"
							onclick={() => toggleResult(call.id)}
							class="flex w-full items-center gap-2 px-4 py-2 text-left text-sm transition-colors hover:bg-slate-100/50 dark:hover:bg-slate-700/50"
						>
							<!-- Status icon -->
							{#if call.error}
								<span class="text-red-500 dark:text-red-400">✗</span>
								<span class="flex-1 text-red-600 dark:text-red-300">Error: {call.error}</span>
							{:else}
								<span class="text-emerald-500 dark:text-emerald-400">✓</span>
								<span class="flex-1 text-slate-500 dark:text-slate-400">{parsed.summary}</span>
							{/if}

							<!-- Expand arrow -->
							{#if hasResult && parsed.full}
								<svg
									class="h-4 w-4 flex-shrink-0 text-slate-400 transition-transform duration-200 dark:text-slate-500"
									class:rotate-180={isResultExpanded}
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
									stroke-width="2"
								>
									<path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
								</svg>
							{/if}
						</button>

						<!-- Expanded result content -->
						{#if isResultExpanded && hasResult && parsed.full}
							<div class="max-h-96 overflow-auto border-t border-slate-200/50 bg-slate-50/50 px-4 py-3 dark:border-slate-700/50 dark:bg-slate-900/50">
								{#if parsed.type === 'search' && parsed.searchResults}
									<!-- Formatted search results -->
									<div class="space-y-3">
										{#each parsed.searchResults.slice(0, 10) as result, i}
											<a
												href={result.url}
												target="_blank"
												rel="noopener noreferrer"
												class="block rounded-lg border border-slate-200 bg-white p-3 transition-colors hover:border-blue-400 hover:bg-blue-50/50 dark:border-slate-600 dark:bg-slate-800 dark:hover:border-blue-500 dark:hover:bg-slate-700/50"
											>
												<div class="flex items-start gap-2">
													<span class="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded bg-blue-100 text-xs font-medium text-blue-600 dark:bg-blue-900/50 dark:text-blue-400">
														{result.rank || i + 1}
													</span>
													<div class="min-w-0 flex-1">
														<p class="font-medium text-blue-600 dark:text-blue-400">{result.title}</p>
														<p class="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-500">{result.url}</p>
														{#if result.snippet && result.snippet !== '(no snippet available)'}
															<p class="mt-1.5 text-sm text-slate-600 dark:text-slate-400">{result.snippet}</p>
														{/if}
													</div>
												</div>
											</a>
										{/each}
									</div>
								{:else}
									<!-- Fallback: raw content -->
									<pre class="whitespace-pre-wrap break-words text-xs text-slate-600 dark:text-slate-400">{parsed.full.length > 10000 ? parsed.full.substring(0, 10000) + '\n\n... (truncated)' : parsed.full}</pre>
								{/if}
							</div>
						{/if}
					</div>
				{/if}
			</div>
		</div>
	{/each}
</div>
