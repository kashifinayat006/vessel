<script lang="ts">
	/**
	 * Context usage indicator bar
	 * Shows current token usage vs context window limit
	 */

	import { contextManager, getContextUsageColor, getProgressBarColor } from '$lib/memory';

	// Props
	interface Props {
		compact?: boolean;
	}

	let { compact = false }: Props = $props();

	// Derived state from context manager
	const usage = $derived(contextManager.contextUsage);
	const colorClass = $derived(getContextUsageColor(usage.percentage));
	const barColorClass = $derived(getProgressBarColor(usage.percentage));
</script>

{#if compact}
	<!-- Compact mode: just a thin bar -->
	<div class="group relative h-1 w-24 overflow-hidden rounded-full bg-theme-tertiary">
		<div
			class="h-full transition-all duration-300 {barColorClass}"
			style="width: {Math.min(100, usage.percentage)}%"
		></div>
		<!-- Tooltip on hover -->
		<div
			class="pointer-events-none absolute bottom-full left-1/2 mb-2 -translate-x-1/2 whitespace-nowrap rounded bg-theme-secondary px-2 py-1 text-xs text-theme-secondary opacity-0 shadow-lg transition-opacity group-hover:opacity-100"
		>
			{contextManager.statusMessage}
		</div>
	</div>
{:else}
	<!-- Full mode: bar with label -->
	<div class="flex items-center gap-2">
		<div class="h-2 flex-1 overflow-hidden rounded-full bg-theme-tertiary">
			<div
				class="h-full transition-all duration-300 {barColorClass}"
				style="width: {Math.min(100, usage.percentage)}%"
			></div>
		</div>
		<span class="whitespace-nowrap text-xs {colorClass}">
			{contextManager.statusMessage}
		</span>
	</div>
{/if}
