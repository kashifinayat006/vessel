<script lang="ts">
	/**
	 * ModelCard - Displays a remote model from ollama.com
	 */
	import type { RemoteModel } from '$lib/api/model-registry';
	import { formatPullCount, formatContextLength } from '$lib/api/model-registry';

	interface Props {
		model: RemoteModel;
		onSelect?: (model: RemoteModel) => void;
	}

	let { model, onSelect }: Props = $props();

	// Capability badges config (matches ollama.com capabilities)
	const capabilityBadges: Record<string, { icon: string; color: string; label: string }> = {
		vision: { icon: '👁', color: 'bg-purple-900/50 text-purple-300', label: 'Vision' },
		tools: { icon: '🔧', color: 'bg-blue-900/50 text-blue-300', label: 'Tools' },
		thinking: { icon: '🧠', color: 'bg-pink-900/50 text-pink-300', label: 'Thinking' },
		embedding: { icon: '📊', color: 'bg-amber-900/50 text-amber-300', label: 'Embedding' },
		cloud: { icon: '☁️', color: 'bg-cyan-900/50 text-cyan-300', label: 'Cloud' }
	};
</script>

<button
	type="button"
	onclick={() => onSelect?.(model)}
	class="group w-full rounded-lg border border-slate-700 bg-slate-800 p-4 text-left transition-all hover:border-slate-600 hover:bg-slate-750"
>
	<!-- Header: Name and Type Badge -->
	<div class="flex items-start justify-between gap-2">
		<h3 class="font-medium text-white group-hover:text-blue-400">
			{model.name}
		</h3>
		<span
			class="shrink-0 rounded px-2 py-0.5 text-xs {model.modelType === 'official'
				? 'bg-blue-900/50 text-blue-300'
				: 'bg-slate-700 text-slate-400'}"
		>
			{model.modelType}
		</span>
	</div>

	<!-- Description -->
	{#if model.description}
		<p class="mt-2 line-clamp-2 text-sm text-slate-400">
			{model.description}
		</p>
	{/if}

	<!-- Capabilities -->
	{#if model.capabilities.length > 0}
		<div class="mt-3 flex flex-wrap gap-1.5">
			{#each model.capabilities as capability}
				{@const badge = capabilityBadges[capability]}
				{#if badge}
					<span class="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs {badge.color}">
						<span>{badge.icon}</span>
						<span>{badge.label}</span>
					</span>
				{/if}
			{/each}
		</div>
	{/if}

	<!-- Stats Row -->
	<div class="mt-3 flex items-center gap-4 text-xs text-slate-500">
		<!-- Pull Count -->
		<div class="flex items-center gap-1" title="{model.pullCount.toLocaleString()} pulls">
			<svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
			</svg>
			<span>{formatPullCount(model.pullCount)}</span>
		</div>

		<!-- Available Sizes (from tags) -->
		{#if model.tags.length > 0}
			<div class="flex items-center gap-1" title="Available parameter sizes">
				<svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
				</svg>
				<span>{model.tags.length} size{model.tags.length !== 1 ? 's' : ''}</span>
			</div>
		{/if}

		<!-- Context Length (if fetched from ollama show) -->
		{#if model.contextLength}
			<div class="flex items-center gap-1" title="Context length">
				<svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h7" />
				</svg>
				<span>{formatContextLength(model.contextLength)}</span>
			</div>
		{/if}
	</div>

	<!-- Size Tags -->
	{#if model.tags.length > 0}
		<div class="mt-3 flex flex-wrap gap-1">
			{#each model.tags as tag}
				<span class="rounded bg-blue-900/30 px-1.5 py-0.5 text-xs font-medium text-blue-300">
					{tag}
				</span>
			{/each}
		</div>
	{/if}
</button>
