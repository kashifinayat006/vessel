<script lang="ts">
	/**
	 * AttachmentDisplay - Shows attached files on messages
	 * Displays compact badges with file info, supports image preview and download
	 */

	import { getAttachmentMetaByIds, getAttachment, createDownloadUrl } from '$lib/storage';
	import type { AttachmentMeta, StoredAttachment } from '$lib/storage';

	interface Props {
		/** Array of attachment IDs to display */
		attachmentIds: string[];
	}

	const { attachmentIds }: Props = $props();

	// Attachment metadata loaded from IndexedDB
	let attachments = $state<AttachmentMeta[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);

	// Image preview modal state
	let previewImage = $state<{ url: string; filename: string } | null>(null);
	let downloadingId = $state<string | null>(null);

	// Load attachments when IDs change
	$effect(() => {
		if (attachmentIds.length > 0) {
			loadAttachments();
		} else {
			attachments = [];
			loading = false;
		}
	});

	async function loadAttachments(): Promise<void> {
		loading = true;
		error = null;

		const result = await getAttachmentMetaByIds(attachmentIds);
		if (result.success) {
			attachments = result.data;
		} else {
			error = result.error;
		}
		loading = false;
	}

	/**
	 * Get icon for attachment type
	 */
	function getTypeIcon(type: string): string {
		switch (type) {
			case 'image':
				return 'M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z';
			case 'pdf':
				return 'M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z';
			case 'text':
				return 'M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z';
			default:
				return 'M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13';
		}
	}

	/**
	 * Get color class for attachment type
	 */
	function getTypeColor(type: string): string {
		switch (type) {
			case 'image':
				return 'text-violet-400 bg-violet-500/20';
			case 'pdf':
				return 'text-red-400 bg-red-500/20';
			case 'text':
				return 'text-emerald-400 bg-emerald-500/20';
			default:
				return 'text-slate-400 bg-slate-500/20';
		}
	}

	/**
	 * Format file size for display
	 */
	function formatSize(bytes: number): string {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	}

	/**
	 * Handle attachment click - preview for images, download for others
	 */
	async function handleClick(attachment: AttachmentMeta): Promise<void> {
		if (attachment.type === 'image') {
			await showImagePreview(attachment);
		} else {
			await downloadAttachment(attachment);
		}
	}

	/**
	 * Show image preview modal
	 */
	async function showImagePreview(attachment: AttachmentMeta): Promise<void> {
		const result = await getAttachment(attachment.id);
		if (result.success && result.data) {
			const url = createDownloadUrl(result.data);
			previewImage = { url, filename: attachment.filename };
		}
	}

	/**
	 * Close image preview and revoke URL
	 */
	function closePreview(): void {
		if (previewImage) {
			URL.revokeObjectURL(previewImage.url);
			previewImage = null;
		}
	}

	/**
	 * Download attachment
	 */
	async function downloadAttachment(attachment: AttachmentMeta): Promise<void> {
		downloadingId = attachment.id;

		try {
			const result = await getAttachment(attachment.id);
			if (result.success && result.data) {
				const url = createDownloadUrl(result.data);
				const a = document.createElement('a');
				a.href = url;
				a.download = attachment.filename;
				document.body.appendChild(a);
				a.click();
				document.body.removeChild(a);
				URL.revokeObjectURL(url);
			}
		} finally {
			downloadingId = null;
		}
	}

	/**
	 * Handle keyboard events for attachment buttons
	 */
	function handleKeydown(event: KeyboardEvent, attachment: AttachmentMeta): void {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			handleClick(attachment);
		}
	}
</script>

{#if loading}
	<div class="flex items-center gap-2 text-sm text-theme-muted">
		<svg class="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
			<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
			<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
		</svg>
		<span>Loading attachments...</span>
	</div>
{:else if error}
	<div class="text-sm text-red-400">
		Failed to load attachments: {error}
	</div>
{:else if attachments.length > 0}
	<div class="mt-2 flex flex-wrap gap-2">
		{#each attachments as attachment (attachment.id)}
			<button
				type="button"
				onclick={() => handleClick(attachment)}
				onkeydown={(e) => handleKeydown(e, attachment)}
				class="group flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors hover:brightness-110 {getTypeColor(attachment.type)}"
				title={attachment.type === 'image' ? 'Click to preview' : 'Click to download'}
			>
				<!-- Type icon -->
				<svg
					xmlns="http://www.w3.org/2000/svg"
					fill="none"
					viewBox="0 0 24 24"
					stroke-width="1.5"
					stroke="currentColor"
					class="h-4 w-4 flex-shrink-0"
				>
					<path stroke-linecap="round" stroke-linejoin="round" d={getTypeIcon(attachment.type)} />
				</svg>

				<!-- Filename (truncated) -->
				<span class="max-w-[150px] truncate">
					{attachment.filename}
				</span>

				<!-- Size -->
				<span class="text-xs opacity-70">
					{formatSize(attachment.size)}
				</span>

				<!-- Analyzed badge -->
				{#if attachment.analyzed}
					<span class="rounded bg-amber-500/30 px-1 py-0.5 text-[10px] font-medium text-amber-300" title="Content was summarized by AI">
						analyzed
					</span>
				{/if}

				<!-- Download/loading indicator -->
				{#if downloadingId === attachment.id}
					<svg class="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
						<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
						<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
					</svg>
				{:else if attachment.type !== 'image'}
					<svg
						xmlns="http://www.w3.org/2000/svg"
						fill="none"
						viewBox="0 0 24 24"
						stroke-width="1.5"
						stroke="currentColor"
						class="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100"
					>
						<path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
					</svg>
				{/if}
			</button>
		{/each}
	</div>
{/if}

<!-- Image preview modal -->
{#if previewImage}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
		role="dialog"
		aria-modal="true"
		aria-label="Image preview"
	>
		<button
			type="button"
			onclick={closePreview}
			class="absolute inset-0"
			aria-label="Close preview"
		></button>

		<div class="relative max-h-[90vh] max-w-[90vw]">
			<img
				src={previewImage.url}
				alt={previewImage.filename}
				class="max-h-[85vh] max-w-full rounded-lg object-contain"
			/>

			<!-- Close button -->
			<button
				type="button"
				onclick={closePreview}
				class="absolute -right-3 -top-3 flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-white shadow-lg hover:bg-slate-700"
				aria-label="Close preview"
			>
				<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="h-5 w-5">
					<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
				</svg>
			</button>

			<!-- Filename -->
			<div class="mt-2 text-center text-sm text-white/70">
				{previewImage.filename}
			</div>
		</div>
	</div>
{/if}
