<script lang="ts">
	/**
	 * ExportDialog.svelte - Modal dialog for exporting conversations
	 * Allows users to select export format and preview the output
	 *
	 * Supports two modes:
	 * 1. Full data mode: Pass conversation + messageTree + activePath (for chat window)
	 * 2. Lazy load mode: Pass just conversationId (for sidebar, loads data on demand)
	 */
	import type { Conversation } from '$lib/types/conversation.js';
	import type { MessageNode, BranchPath } from '$lib/types/chat.js';
	import {
		type ExportFormat,
		exportAsMarkdown,
		exportAsJSON,
		exportConversation,
		generatePreview,
		generateShareUrl,
		copyToClipboard
	} from '$lib/utils/export.js';
	import { getMessagesForConversation, getMessageTree, getConversation } from '$lib/storage';

	interface Props {
		/** The conversation to export (optional if conversationId provided) */
		conversation?: Conversation | null | undefined;
		/** Message tree map (optional, will be loaded if not provided) */
		messageTree?: Map<string, MessageNode>;
		/** Active branch path (optional, will be loaded if not provided) */
		activePath?: BranchPath;
		/** Conversation ID for lazy loading mode */
		conversationId?: string | null;
		/** Whether the dialog is open */
		isOpen: boolean;
		/** Callback when dialog is closed */
		onClose: () => void;
	}

	let {
		conversation: propConversation,
		messageTree: propMessageTree,
		activePath: propActivePath,
		conversationId,
		isOpen,
		onClose
	}: Props = $props();

	// Internal state for lazy-loaded data
	let loadedConversation = $state<Conversation | null>(null);
	let loadedMessageTree = $state<Map<string, MessageNode>>(new Map());
	let loadedActivePath = $state<BranchPath>([]);
	let isLoading = $state(false);
	let loadError = $state<string | null>(null);

	// Use props if provided, otherwise use loaded data
	let conversation = $derived(propConversation ?? loadedConversation);
	let messageTree = $derived(propMessageTree ?? loadedMessageTree);
	let activePath = $derived(propActivePath ?? loadedActivePath);

	/** Currently selected export format */
	let selectedFormat = $state<ExportFormat>('markdown');

	/** Whether share link was copied */
	let shareCopied = $state(false);

	/** Error message if any */
	let errorMessage = $state<string | null>(null);

	/** Generated preview content */
	let preview = $derived.by(() => {
		if (!conversation) return '';

		try {
			const content =
				selectedFormat === 'markdown'
					? exportAsMarkdown(conversation, messageTree, activePath)
					: exportAsJSON(conversation, messageTree, activePath);
			return generatePreview(content, 15);
		} catch {
			return 'Error generating preview';
		}
	});

	/** Handle export button click */
	function handleExport(): void {
		if (!conversation) return;

		try {
			exportConversation(conversation, messageTree, activePath, selectedFormat);
			onClose();
		} catch {
			errorMessage = 'Failed to export conversation';
		}
	}

	/** Handle share button click */
	async function handleShare(): Promise<void> {
		if (!conversation) return;

		try {
			const shareUrl = generateShareUrl(conversation, messageTree, activePath);
			await copyToClipboard(shareUrl);
			shareCopied = true;
			setTimeout(() => {
				shareCopied = false;
			}, 2000);
		} catch {
			errorMessage = 'Failed to copy share link';
		}
	}

	/** Handle backdrop click to close */
	function handleBackdropClick(event: MouseEvent): void {
		if (event.target === event.currentTarget) {
			onClose();
		}
	}

	/** Handle escape key to close */
	function handleKeydown(event: KeyboardEvent): void {
		if (event.key === 'Escape') {
			onClose();
		}
	}

	/** Load data when dialog opens in lazy load mode */
	async function loadConversationData(id: string): Promise<void> {
		isLoading = true;
		loadError = null;

		try {
			const [convResult, messagesResult, treeResult] = await Promise.all([
				getConversation(id),
				getMessagesForConversation(id),
				getMessageTree(id)
			]);

			if (!convResult.success || !convResult.data) {
				throw new Error('Failed to load conversation');
			}
			if (!messagesResult.success || !messagesResult.data) {
				throw new Error('Failed to load messages');
			}
			if (!treeResult.success || !treeResult.data) {
				throw new Error('Failed to load message tree');
			}

			loadedConversation = convResult.data;
			loadedMessageTree = messagesResult.data;
			loadedActivePath = treeResult.data.activePath;
		} catch (error) {
			loadError = error instanceof Error ? error.message : 'Failed to load conversation data';
		} finally {
			isLoading = false;
		}
	}

	/** Reset state when dialog opens */
	$effect(() => {
		if (isOpen) {
			selectedFormat = 'markdown';
			shareCopied = false;
			errorMessage = null;
			loadError = null;

			// Lazy load if conversationId provided but no props
			if (conversationId && !propConversation && !propMessageTree) {
				loadConversationData(conversationId);
			}
		} else {
			// Clear loaded data when closing
			loadedConversation = null;
			loadedMessageTree = new Map();
			loadedActivePath = [];
		}
	});
</script>

{#if isOpen}
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<!-- svelte-ignore a11y_interactive_supports_focus -->
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
		role="dialog"
		aria-modal="true"
		aria-labelledby="export-dialog-title"
		onclick={handleBackdropClick}
		onkeydown={handleKeydown}
	>
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<div
			class="mx-4 w-full max-w-lg rounded-xl border border-theme bg-theme-primary shadow-2xl"
			onclick={(e) => e.stopPropagation()}
		>
			<!-- Header -->
			<div class="flex items-center justify-between border-b border-theme px-6 py-4">
				<h2 id="export-dialog-title" class="text-lg font-semibold text-theme-primary">
					Export Conversation
				</h2>
				<button
					type="button"
					onclick={onClose}
					class="rounded-lg p-1.5 text-theme-muted transition-colors hover:bg-theme-secondary hover:text-theme-secondary"
					aria-label="Close dialog"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-5 w-5"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="2"
					>
						<path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
					</svg>
				</button>
			</div>

			<!-- Content -->
			<div class="space-y-5 px-6 py-5">
				{#if isLoading}
					<!-- Loading state -->
					<div class="flex items-center justify-center py-8">
						<svg class="h-6 w-6 animate-spin text-theme-muted" viewBox="0 0 24 24">
							<circle
								class="opacity-25"
								cx="12"
								cy="12"
								r="10"
								stroke="currentColor"
								stroke-width="4"
								fill="none"
							/>
							<path
								class="opacity-75"
								fill="currentColor"
								d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
							/>
						</svg>
						<span class="ml-2 text-sm text-theme-muted">Loading conversation...</span>
					</div>
				{:else if loadError}
					<!-- Load error state -->
					<div class="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400" role="alert">
						{loadError}
					</div>
				{:else}
				<!-- Format selection -->
				<fieldset class="space-y-3">
					<legend class="text-sm font-medium text-theme-secondary">Export Format</legend>
					<div class="flex gap-4">
						<label
							class="flex cursor-pointer items-center gap-2 rounded-lg border px-4 py-3 transition-colors {selectedFormat === 'markdown'
								? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
								: 'border-theme bg-theme-secondary/50 text-theme-secondary hover:border-theme-subtle'}"
						>
							<input
								type="radio"
								name="exportFormat"
								value="markdown"
								bind:group={selectedFormat}
								class="sr-only"
							/>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								class="h-5 w-5"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								stroke-width="1.5"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
								/>
							</svg>
							<span>Markdown</span>
						</label>
						<label
							class="flex cursor-pointer items-center gap-2 rounded-lg border px-4 py-3 transition-colors {selectedFormat === 'json'
								? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
								: 'border-theme bg-theme-secondary/50 text-theme-secondary hover:border-theme-subtle'}"
						>
							<input
								type="radio"
								name="exportFormat"
								value="json"
								bind:group={selectedFormat}
								class="sr-only"
							/>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								class="h-5 w-5"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								stroke-width="1.5"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									d="M17.25 6.75 22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3-4.5 16.5"
								/>
							</svg>
							<span>JSON</span>
						</label>
					</div>
				</fieldset>

				<!-- Preview -->
				<div class="space-y-2">
					<span class="text-sm font-medium text-theme-secondary">Preview</span>
					<div
						class="max-h-48 overflow-auto rounded-lg border border-theme bg-theme-primary p-3 font-mono text-xs text-theme-muted"
						aria-label="Export preview"
					>
						<pre class="whitespace-pre-wrap">{preview}</pre>
					</div>
				</div>

				<!-- Error message -->
				{#if errorMessage}
					<div class="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400" role="alert">
						{errorMessage}
					</div>
				{/if}
				{/if}
			</div>

			<!-- Footer -->
			<div
				class="flex flex-col gap-3 border-t border-theme px-6 py-4 sm:flex-row sm:items-center sm:justify-between"
			>
				<!-- Share button -->
				<button
					type="button"
					onclick={handleShare}
					class="flex items-center justify-center gap-2 rounded-lg border border-theme-subtle px-4 py-2.5 text-sm font-medium text-theme-secondary transition-colors hover:bg-theme-secondary hover:text-theme-primary"
				>
					{#if shareCopied}
						<svg
							xmlns="http://www.w3.org/2000/svg"
							class="h-4 w-4 text-emerald-400"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							stroke-width="2"
						>
							<path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" />
						</svg>
						<span class="text-emerald-400">Link Copied!</span>
					{:else}
						<svg
							xmlns="http://www.w3.org/2000/svg"
							class="h-4 w-4"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							stroke-width="1.5"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185Z"
							/>
						</svg>
						<span>Copy Share Link</span>
					{/if}
				</button>

				<!-- Export actions -->
				<div class="flex gap-2">
					<button
						type="button"
						onclick={onClose}
						class="rounded-lg px-4 py-2.5 text-sm font-medium text-theme-muted transition-colors hover:bg-theme-secondary hover:text-theme-secondary"
					>
						Cancel
					</button>
					<button
						type="button"
						onclick={handleExport}
						disabled={isLoading || !!loadError || !conversation}
						class="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
					>
						Download {selectedFormat === 'markdown' ? '.md' : '.json'}
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}
