<script lang="ts">
	/**
	 * Skeleton - Loading placeholder component
	 * Provides animated skeleton placeholders for content loading states
	 */

	interface Props {
		/** Width of the skeleton (CSS value) */
		width?: string;
		/** Height of the skeleton (CSS value) */
		height?: string;
		/** Shape variant */
		variant?: 'text' | 'circular' | 'rectangular' | 'rounded';
		/** Number of lines (for text variant) */
		lines?: number;
		/** Additional CSS classes */
		class?: string;
	}

	const {
		width = '100%',
		height = '1rem',
		variant = 'text',
		lines = 1,
		class: className = ''
	}: Props = $props();

	// Compute variant-specific classes
	const variantClasses = $derived.by(() => {
		switch (variant) {
			case 'circular':
				return 'rounded-full';
			case 'rectangular':
				return 'rounded-none';
			case 'rounded':
				return 'rounded-lg';
			case 'text':
			default:
				return 'rounded';
		}
	});

	// Generate line widths for multi-line text skeletons
	const lineWidths = $derived.by(() => {
		if (lines <= 1) return ['100%'];
		// Last line is typically shorter
		return Array.from({ length: lines }, (_, i) =>
			i === lines - 1 ? '75%' : '100%'
		);
	});
</script>

{#if variant === 'text' && lines > 1}
	<div class="space-y-2 {className}">
		{#each lineWidths as lineWidth, i}
			<div
				class="animate-pulse bg-theme-tertiary/50 {variantClasses}"
				style="width: {lineWidth}; height: {height};"
				role="status"
				aria-label="Loading..."
			></div>
		{/each}
	</div>
{:else}
	<div
		class="animate-pulse bg-theme-tertiary/50 {variantClasses} {className}"
		style="width: {width}; height: {height};"
		role="status"
		aria-label="Loading..."
	></div>
{/if}
