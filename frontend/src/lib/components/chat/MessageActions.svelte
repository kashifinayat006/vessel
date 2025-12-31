<script lang="ts">
	/**
	 * MessageActions - Action buttons for messages
	 * Copy, edit (user), regenerate (assistant)
	 */

	import type { MessageRole } from '$lib/types';

	interface Props {
		role: MessageRole;
		content: string;
		canRegenerate?: boolean;
		onCopy?: () => void;
		onEdit?: () => void;
		onRegenerate?: () => void;
	}

	const {
		role,
		content,
		canRegenerate = false,
		onCopy,
		onEdit,
		onRegenerate
	}: Props = $props();

	// State for copy feedback
	let copied = $state(false);

	const isUser = $derived(role === 'user');
	const isAssistant = $derived(role === 'assistant');

	/**
	 * Handle copy with visual feedback
	 */
	async function handleCopy(): Promise<void> {
		try {
			await navigator.clipboard.writeText(content);
			copied = true;
			setTimeout(() => {
				copied = false;
			}, 2000);
			onCopy?.();
		} catch (error) {
			console.error('Failed to copy:', error);
		}
	}
</script>

<div class="flex items-center gap-1" role="group" aria-label="Message actions">
	<!-- Copy button -->
	<button
		type="button"
		onclick={handleCopy}
		class="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
		aria-label={copied ? 'Copied!' : 'Copy message'}
		title={copied ? 'Copied!' : 'Copy to clipboard'}
	>
		{#if copied}
			<svg
				xmlns="http://www.w3.org/2000/svg"
				viewBox="0 0 20 20"
				fill="currentColor"
				class="h-4 w-4 text-green-500"
			>
				<path
					fill-rule="evenodd"
					d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
					clip-rule="evenodd"
				/>
			</svg>
		{:else}
			<svg
				xmlns="http://www.w3.org/2000/svg"
				viewBox="0 0 20 20"
				fill="currentColor"
				class="h-4 w-4"
			>
				<path d="M7 3.5A1.5 1.5 0 018.5 2h3.879a1.5 1.5 0 011.06.44l3.122 3.12A1.5 1.5 0 0117 6.622V12.5a1.5 1.5 0 01-1.5 1.5h-1v-3.379a3 3 0 00-.879-2.121L10.5 5.379A3 3 0 008.379 4.5H7v-1z" />
				<path d="M4.5 6A1.5 1.5 0 003 7.5v9A1.5 1.5 0 004.5 18h7a1.5 1.5 0 001.5-1.5v-5.879a1.5 1.5 0 00-.44-1.06L9.44 6.439A1.5 1.5 0 008.378 6H4.5z" />
			</svg>
		{/if}
	</button>

	<!-- Edit button (user messages only) -->
	{#if isUser && onEdit}
		<button
			type="button"
			onclick={onEdit}
			class="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
			aria-label="Edit message"
			title="Edit message"
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				viewBox="0 0 20 20"
				fill="currentColor"
				class="h-4 w-4"
			>
				<path d="M2.695 14.763l-1.262 3.154a.5.5 0 00.65.65l3.155-1.262a4 4 0 001.343-.885L17.5 5.5a2.121 2.121 0 00-3-3L3.58 13.42a4 4 0 00-.885 1.343z" />
			</svg>
		</button>
	{/if}

	<!-- Regenerate button (assistant messages only, when applicable) -->
	{#if isAssistant && canRegenerate && onRegenerate}
		<button
			type="button"
			onclick={onRegenerate}
			class="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
			aria-label="Regenerate response"
			title="Regenerate response"
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				viewBox="0 0 20 20"
				fill="currentColor"
				class="h-4 w-4"
			>
				<path
					fill-rule="evenodd"
					d="M15.312 11.424a5.5 5.5 0 01-9.201 2.466l-.312-.311h2.433a.75.75 0 000-1.5H3.989a.75.75 0 00-.75.75v4.242a.75.75 0 001.5 0v-2.43l.31.31a7 7 0 0011.712-3.138.75.75 0 00-1.449-.39zm1.23-3.723a.75.75 0 00.219-.53V2.929a.75.75 0 00-1.5 0V5.36l-.31-.31A7 7 0 003.239 8.188a.75.75 0 101.448.389A5.5 5.5 0 0113.89 6.11l.311.31h-2.432a.75.75 0 000 1.5h4.243a.75.75 0 00.53-.219z"
					clip-rule="evenodd"
				/>
			</svg>
		</button>
	{/if}
</div>
