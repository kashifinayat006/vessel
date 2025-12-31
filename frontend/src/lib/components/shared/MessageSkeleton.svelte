<script lang="ts">
	/**
	 * MessageSkeleton - Loading placeholder for chat messages
	 */

	import Skeleton from './Skeleton.svelte';

	interface Props {
		/** Whether this is a user message (right-aligned) */
		isUser?: boolean;
		/** Number of content lines */
		lines?: number;
	}

	const { isUser = false, lines = 3 }: Props = $props();
</script>

<div class="mb-6 flex gap-4" class:justify-end={isUser}>
	<!-- Avatar skeleton (for assistant) -->
	{#if !isUser}
		<Skeleton variant="circular" width="2rem" height="2rem" />
	{/if}

	<!-- Message content skeleton -->
	<div class="flex-1 max-w-[80%]" class:max-w-[70%]={isUser}>
		<div
			class="rounded-2xl px-4 py-3 {isUser ? 'bg-blue-500/20 rounded-br-md' : 'bg-slate-800 rounded-bl-md'}"
		>
			<Skeleton variant="text" {lines} height="0.875rem" />
		</div>
	</div>

	<!-- Avatar skeleton (for user) -->
	{#if isUser}
		<Skeleton variant="circular" width="2rem" height="2rem" />
	{/if}
</div>
