<script lang="ts">
	/**
	 * ImagePreview - Display a base64 image as thumbnail with modal view
	 * Supports click to expand and remove functionality
	 */

	import { base64ToDataUrl } from '$lib/ollama/image-processor';

	interface Props {
		/** Base64 encoded image (without data: prefix) */
		src: string;
		/** Callback when remove button is clicked */
		onRemove?: () => void;
		/** Whether the remove button should be shown */
		showRemove?: boolean;
		/** Alt text for the image */
		alt?: string;
	}

	const { src, onRemove, showRemove = true, alt = 'Image preview' }: Props = $props();

	/** Modal open state */
	let isModalOpen = $state(false);

	/** Get the data URL for display */
	const dataUrl = $derived(base64ToDataUrl(src));

	/** Open the modal */
	function openModal(): void {
		isModalOpen = true;
	}

	/** Close the modal */
	function closeModal(): void {
		isModalOpen = false;
	}

	/** Handle keyboard events on modal */
	function handleKeydown(event: KeyboardEvent): void {
		if (event.key === 'Escape') {
			closeModal();
		}
	}

	/** Handle remove button click */
	function handleRemove(event: MouseEvent): void {
		event.stopPropagation();
		onRemove?.();
	}
</script>

<!-- Thumbnail container -->
<div class="group relative inline-block">
	<!-- Thumbnail image -->
	<button
		type="button"
		onclick={openModal}
		class="relative block overflow-hidden rounded-lg border border-gray-300 bg-gray-100 transition-all hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:border-gray-600 dark:bg-gray-700"
	>
		<img
			src={dataUrl}
			{alt}
			class="h-20 w-20 object-cover"
		/>
		<!-- Overlay on hover -->
		<div class="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/20">
			<svg
				xmlns="http://www.w3.org/2000/svg"
				viewBox="0 0 20 20"
				fill="currentColor"
				class="h-6 w-6 text-white opacity-0 drop-shadow transition-opacity group-hover:opacity-100"
			>
				<path d="M10 3.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM2 10a8 8 0 1 1 16 0 8 8 0 0 1-16 0Z" />
				<path d="M10 6.5a.5.5 0 0 1 .5.5v2.5H13a.5.5 0 0 1 0 1h-2.5V13a.5.5 0 0 1-1 0v-2.5H7a.5.5 0 0 1 0-1h2.5V7a.5.5 0 0 1 .5-.5Z" />
			</svg>
		</div>
	</button>

	<!-- Remove button -->
	{#if showRemove && onRemove}
		<button
			type="button"
			onclick={handleRemove}
			class="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white opacity-0 shadow-md transition-opacity hover:bg-red-600 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 group-hover:opacity-100"
			aria-label="Remove image"
			title="Remove image"
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				viewBox="0 0 20 20"
				fill="currentColor"
				class="h-4 w-4"
			>
				<path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
			</svg>
		</button>
	{/if}
</div>

<!-- Full-size modal -->
{#if isModalOpen}
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
		role="dialog"
		tabindex="-1"
		aria-modal="true"
		aria-label="Image preview"
		onclick={closeModal}
		onkeydown={handleKeydown}
	>
		<!-- Close button -->
		<button
			type="button"
			onclick={closeModal}
			class="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white transition-colors hover:bg-black/70 focus:outline-none focus:ring-2 focus:ring-white"
			aria-label="Close preview"
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				viewBox="0 0 20 20"
				fill="currentColor"
				class="h-6 w-6"
			>
				<path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
			</svg>
		</button>

		<!-- Full-size image -->
		<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
		<img
			src={dataUrl}
			{alt}
			class="max-h-[90vh] max-w-[90vw] rounded-lg object-contain shadow-2xl"
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => e.stopPropagation()}
		/>
	</div>
{/if}
