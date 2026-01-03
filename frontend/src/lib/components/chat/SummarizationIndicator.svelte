<script lang="ts">
	/**
	 * SummarizationIndicator - Visual marker showing where conversation was summarized
	 * Displayed in the message list to indicate context compaction occurred
	 */
</script>

<div class="flex items-center gap-3 py-4" role="separator" aria-label="Conversation summarized">
	<div class="flex-1 border-t border-dashed border-emerald-500/30"></div>
	<div class="flex items-center gap-2 text-xs text-emerald-500">
		<svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
			<path stroke-linecap="round" stroke-linejoin="round" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
		</svg>
		<span>Earlier messages summarized</span>
	</div>
	<div class="flex-1 border-t border-dashed border-emerald-500/30"></div>
</div>
