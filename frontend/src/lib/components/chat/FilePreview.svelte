<script lang="ts">
	/**
	 * FilePreview.svelte - Compact preview badge for attached files
	 * Shows filename, size, and type - no raw content dump
	 */
	import type { FileAttachment } from '$lib/types/attachment.js';
	import { formatFileSize } from '$lib/utils/file-processor.js';

	interface Props {
		attachment: FileAttachment;
		onRemove?: (id: string) => void;
		readonly?: boolean;
	}

	const props: Props = $props();

	// Derived values to ensure reactivity
	const attachment = $derived(props.attachment);
	const onRemove = $derived(props.onRemove);
	const readonly = $derived(props.readonly ?? false);

	function handleRemove() {
		onRemove?.(attachment.id);
	}

	/**
	 * Get icon path for attachment type
	 */
	function getIconPath(type: string): string {
		switch (type) {
			case 'pdf':
				return 'M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z';
			case 'text':
				return 'M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z';
			default:
				return 'M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13';
		}
	}

	/**
	 * Get color classes for attachment type
	 */
	function getTypeStyle(type: string): { icon: string; badge: string; badgeText: string } {
		switch (type) {
			case 'pdf':
				return {
					icon: 'text-red-400',
					badge: 'bg-red-500/20',
					badgeText: 'text-red-300'
				};
			case 'text':
				return {
					icon: 'text-emerald-400',
					badge: 'bg-emerald-500/20',
					badgeText: 'text-emerald-300'
				};
			default:
				return {
					icon: 'text-slate-400',
					badge: 'bg-slate-500/20',
					badgeText: 'text-slate-300'
				};
		}
	}

	/**
	 * Get file extension for display
	 */
	function getExtension(filename: string): string {
		const ext = filename.split('.').pop()?.toUpperCase();
		return ext || 'FILE';
	}

	const style = $derived(getTypeStyle(attachment.type));
	const extension = $derived(getExtension(attachment.filename));
</script>

<div
	class="group relative inline-flex items-center gap-2.5 rounded-xl border border-theme/30 bg-theme-secondary/60 px-3 py-2 transition-all hover:border-theme/50 hover:bg-theme-secondary"
>
	<!-- File icon -->
	<div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg {style.badge}">
		<svg
			xmlns="http://www.w3.org/2000/svg"
			fill="none"
			viewBox="0 0 24 24"
			stroke-width="1.5"
			stroke="currentColor"
			class="h-4 w-4 {style.icon}"
		>
			<path stroke-linecap="round" stroke-linejoin="round" d={getIconPath(attachment.type)} />
		</svg>
	</div>

	<!-- File info -->
	<div class="min-w-0 flex-1">
		<p class="max-w-[180px] truncate text-sm font-medium text-theme-primary" title={attachment.filename}>
			{attachment.filename}
		</p>
		<div class="flex items-center gap-1.5 text-xs text-theme-muted">
			<span>{formatFileSize(attachment.size)}</span>
			<span class="opacity-50">·</span>
			<span class="rounded px-1 py-0.5 text-[10px] font-medium {style.badge} {style.badgeText}">
				{extension}
			</span>
			{#if attachment.truncated}
				<span class="rounded bg-amber-500/20 px-1 py-0.5 text-[10px] font-medium text-amber-300" title="Content was truncated due to size">
					truncated
				</span>
			{/if}
		</div>
	</div>

	<!-- Remove button -->
	{#if !readonly && onRemove}
		<button
			type="button"
			onclick={handleRemove}
			class="ml-1 shrink-0 rounded-lg p-1.5 text-theme-muted opacity-0 transition-all hover:bg-red-500/20 hover:text-red-400 group-hover:opacity-100"
			aria-label="Remove file"
			title="Remove"
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				viewBox="0 0 20 20"
				fill="currentColor"
				class="h-4 w-4"
			>
				<path
					d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z"
				/>
			</svg>
		</button>
	{/if}
</div>
