<script lang="ts">
	/**
	 * ToolCallDisplay - Shows tool calls made by the assistant
	 * Displays the tool name, arguments, and execution status
	 */

	import type { ToolCall } from '$lib/types';

	interface Props {
		toolCalls: ToolCall[];
	}

	let { toolCalls }: Props = $props();

	/**
	 * Format arguments for display
	 * Handles both string and object arguments
	 */
	function formatArguments(args: string): string {
		try {
			const parsed = JSON.parse(args);
			return JSON.stringify(parsed, null, 2);
		} catch {
			return args;
		}
	}

	/**
	 * Check if arguments should be collapsed (too long)
	 */
	function shouldCollapse(args: string): boolean {
		return args.length > 100;
	}

	// State for collapsed arguments
	let expandedCalls = $state<Set<string>>(new Set());

	function toggleExpand(id: string): void {
		if (expandedCalls.has(id)) {
			expandedCalls.delete(id);
			expandedCalls = new Set(expandedCalls);
		} else {
			expandedCalls.add(id);
			expandedCalls = new Set(expandedCalls);
		}
	}
</script>

<div class="mt-2 space-y-2">
	{#each toolCalls as call (call.id)}
		<div class="rounded-lg border border-slate-600 bg-slate-700/50 p-3">
			<div class="flex items-center gap-2">
				<!-- Tool icon -->
				<div class="flex h-6 w-6 items-center justify-center rounded bg-emerald-600/20 text-emerald-400">
					<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
						<path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
					</svg>
				</div>

				<!-- Tool name -->
				<span class="font-mono text-sm font-medium text-slate-200">{call.name}</span>

				<!-- Expand/collapse button -->
				{#if shouldCollapse(call.arguments)}
					<button
						type="button"
						onclick={() => toggleExpand(call.id)}
						class="ml-auto text-xs text-slate-400 hover:text-slate-200"
					>
						{expandedCalls.has(call.id) ? 'Collapse' : 'Expand'}
					</button>
				{/if}
			</div>

			<!-- Arguments -->
			{#if call.arguments && call.arguments !== '{}'}
				<div class="mt-2">
					{#if shouldCollapse(call.arguments) && !expandedCalls.has(call.id)}
						<pre class="overflow-hidden text-ellipsis whitespace-nowrap rounded bg-slate-800 p-2 font-mono text-xs text-slate-400">{call.arguments.substring(0, 100)}...</pre>
					{:else}
						<pre class="overflow-x-auto rounded bg-slate-800 p-2 font-mono text-xs text-slate-400">{formatArguments(call.arguments)}</pre>
					{/if}
				</div>
			{/if}
		</div>
	{/each}
</div>
