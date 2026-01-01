<script lang="ts">
	/**
	 * StreamingIndicator - Animated typing indicator
	 * Shows during streaming when waiting for content
	 */

	interface Props {
		size?: 'sm' | 'md' | 'lg';
	}

	const { size = 'md' }: Props = $props();

	const sizeClasses = $derived({
		sm: 'h-1.5 w-1.5',
		md: 'h-2 w-2',
		lg: 'h-2.5 w-2.5'
	}[size]);

	const gapClasses = $derived({
		sm: 'gap-1',
		md: 'gap-1.5',
		lg: 'gap-2'
	}[size]);
</script>

<div
	class="inline-flex items-center {gapClasses}"
	role="status"
	aria-label="Generating response"
>
	<span
		class="animate-bounce rounded-full bg-theme-muted {sizeClasses}"
		style="animation-delay: 0ms; animation-duration: 1s;"
	></span>
	<span
		class="animate-bounce rounded-full bg-theme-muted {sizeClasses}"
		style="animation-delay: 150ms; animation-duration: 1s;"
	></span>
	<span
		class="animate-bounce rounded-full bg-theme-muted {sizeClasses}"
		style="animation-delay: 300ms; animation-duration: 1s;"
	></span>
	<span class="sr-only">Generating response...</span>
</div>
