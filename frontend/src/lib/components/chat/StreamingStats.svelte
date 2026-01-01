<script lang="ts">
	/**
	 * StreamingStats - Displays real-time streaming performance metrics
	 * Shows tokens/second, TTFT, and token count during and after streaming
	 */

	import { streamingMetricsState } from '$lib/stores/streaming-metrics.svelte';

	// Control visibility after streaming ends
	let fadeOutTimer: ReturnType<typeof setTimeout> | null = null;
	let visible = $state(true);

	// Show stats when active or recently completed
	const shouldShow = $derived.by(() => {
		const stats = streamingMetricsState.displayStats;
		return stats !== null && visible;
	});

	// Fade out after streaming ends
	$effect(() => {
		if (!streamingMetricsState.isActive && streamingMetricsState.tokenCount > 0) {
			// Clear any existing timer
			if (fadeOutTimer) clearTimeout(fadeOutTimer);

			// Hide after 5 seconds when streaming completes
			fadeOutTimer = setTimeout(() => {
				visible = false;
			}, 5000);
		} else if (streamingMetricsState.isActive) {
			// Reset visibility when streaming starts
			visible = true;
			if (fadeOutTimer) {
				clearTimeout(fadeOutTimer);
				fadeOutTimer = null;
			}
		}
	});
</script>

{#if shouldShow}
	<div
		class="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-600 transition-opacity duration-300 dark:bg-gray-800 dark:text-gray-400"
		class:animate-pulse={streamingMetricsState.isActive}
		role="status"
		aria-live="polite"
		aria-label="Streaming performance metrics"
	>
		<!-- Activity indicator -->
		{#if streamingMetricsState.isActive}
			<span class="relative flex h-2 w-2">
				<span
					class="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75"
				></span>
				<span class="relative inline-flex h-2 w-2 rounded-full bg-green-500"></span>
			</span>
		{/if}

		<!-- Stats display -->
		<span class="font-mono">{streamingMetricsState.displayStats}</span>
	</div>
{/if}
