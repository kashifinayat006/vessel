<script lang="ts">
	/**
	 * ConfirmDialog.svelte - Reusable confirmation dialog component
	 * Used for delete confirmations and other destructive actions
	 */

	interface Props {
		/** Whether the dialog is open */
		isOpen: boolean;
		/** Dialog title */
		title: string;
		/** Dialog message/description */
		message: string;
		/** Text for the confirm button */
		confirmText?: string;
		/** Text for the cancel button */
		cancelText?: string;
		/** Variant affects styling of confirm button */
		variant?: 'danger' | 'warning' | 'info';
		/** Callback when confirmed */
		onConfirm: () => void;
		/** Callback when cancelled/closed */
		onCancel: () => void;
	}

	let {
		isOpen,
		title,
		message,
		confirmText = 'Confirm',
		cancelText = 'Cancel',
		variant = 'danger',
		onConfirm,
		onCancel
	}: Props = $props();

	/** Variant-specific button styles */
	const confirmButtonStyles = $derived.by(() => {
		switch (variant) {
			case 'danger':
				return 'bg-red-600 hover:bg-red-500 focus:ring-red-500';
			case 'warning':
				return 'bg-amber-600 hover:bg-amber-500 focus:ring-amber-500';
			case 'info':
			default:
				return 'bg-emerald-600 hover:bg-emerald-500 focus:ring-emerald-500';
		}
	});

	/** Variant-specific icon color */
	const iconColorStyles = $derived.by(() => {
		switch (variant) {
			case 'danger':
				return 'bg-red-500/10 text-red-500';
			case 'warning':
				return 'bg-amber-500/10 text-amber-500';
			case 'info':
			default:
				return 'bg-emerald-500/10 text-emerald-500';
		}
	});

	/** Handle backdrop click to close */
	function handleBackdropClick(event: MouseEvent): void {
		if (event.target === event.currentTarget) {
			onCancel();
		}
	}

	/** Handle escape key to close */
	function handleKeydown(event: KeyboardEvent): void {
		if (event.key === 'Escape') {
			onCancel();
		}
	}

	/** Handle confirm with button state */
	function handleConfirm(): void {
		onConfirm();
	}
</script>

{#if isOpen}
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<!-- svelte-ignore a11y_interactive_supports_focus -->
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
		role="dialog"
		aria-modal="true"
		aria-labelledby="confirm-dialog-title"
		aria-describedby="confirm-dialog-description"
		onclick={handleBackdropClick}
		onkeydown={handleKeydown}
	>
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<div
			class="mx-4 w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 shadow-2xl"
			onclick={(e) => e.stopPropagation()}
		>
			<!-- Content -->
			<div class="p-6">
				<div class="flex items-start gap-4">
					<!-- Icon -->
					<div class="flex-shrink-0">
						<div class="flex h-12 w-12 items-center justify-center rounded-full {iconColorStyles}">
							{#if variant === 'danger'}
								<svg
									xmlns="http://www.w3.org/2000/svg"
									class="h-6 w-6"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
									stroke-width="1.5"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
									/>
								</svg>
							{:else if variant === 'warning'}
								<svg
									xmlns="http://www.w3.org/2000/svg"
									class="h-6 w-6"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
									stroke-width="1.5"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
									/>
								</svg>
							{:else}
								<svg
									xmlns="http://www.w3.org/2000/svg"
									class="h-6 w-6"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
									stroke-width="1.5"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z"
									/>
								</svg>
							{/if}
						</div>
					</div>

					<!-- Text content -->
					<div class="flex-1">
						<h3 id="confirm-dialog-title" class="text-lg font-semibold text-slate-100">
							{title}
						</h3>
						<p id="confirm-dialog-description" class="mt-2 text-sm text-slate-400">
							{message}
						</p>
					</div>
				</div>
			</div>

			<!-- Footer -->
			<div class="flex justify-end gap-3 border-t border-slate-700 px-6 py-4">
				<button
					type="button"
					onclick={onCancel}
					class="rounded-lg px-4 py-2.5 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800 hover:text-slate-100"
				>
					{cancelText}
				</button>
				<button
					type="button"
					onclick={handleConfirm}
					class="rounded-lg px-4 py-2.5 text-sm font-medium text-white transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 {confirmButtonStyles}"
				>
					{confirmText}
				</button>
			</div>
		</div>
	</div>
{/if}
