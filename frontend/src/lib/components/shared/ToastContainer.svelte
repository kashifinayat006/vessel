<script lang="ts">
	/**
	 * ToastContainer.svelte - Container for displaying toast notifications
	 * Should be placed at the root of the app layout
	 */
	import { toastState, type Toast } from '$lib/stores/toast.svelte.js';

	/** Get styles based on toast type */
	function getToastStyles(type: Toast['type']): string {
		switch (type) {
			case 'success':
				return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400';
			case 'error':
				return 'border-red-500/30 bg-red-500/10 text-red-400';
			case 'warning':
				return 'border-amber-500/30 bg-amber-500/10 text-amber-400';
			case 'info':
			default:
				return 'border-blue-500/30 bg-blue-500/10 text-blue-400';
		}
	}

	/** Get icon based on toast type */
	function getIcon(type: Toast['type']): string {
		switch (type) {
			case 'success':
				return 'M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z';
			case 'error':
				return 'M9.75 9.75l4.5 4.5m0-4.5-4.5 4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z';
			case 'warning':
				return 'M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z';
			case 'info':
			default:
				return 'm11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z';
		}
	}
</script>

{#if toastState.toasts.length > 0}
	<div
		class="fixed bottom-4 right-4 z-[100] flex flex-col gap-2"
		role="region"
		aria-label="Notifications"
	>
		{#each toastState.toasts as toast (toast.id)}
			<div
				class="flex max-w-sm items-start gap-3 rounded-lg border px-4 py-3 shadow-lg backdrop-blur-sm transition-all duration-300 animate-in slide-in-from-right {getToastStyles(toast.type)}"
				role="alert"
			>
				<!-- Icon -->
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-5 w-5 flex-shrink-0"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="1.5"
				>
					<path stroke-linecap="round" stroke-linejoin="round" d={getIcon(toast.type)} />
				</svg>

				<!-- Message -->
				<p class="flex-1 text-sm font-medium">{toast.message}</p>

				<!-- Dismiss button -->
				<button
					type="button"
					onclick={() => toastState.dismiss(toast.id)}
					class="flex-shrink-0 rounded p-0.5 opacity-70 transition-opacity hover:opacity-100"
					aria-label="Dismiss notification"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-4 w-4"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="2"
					>
						<path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
					</svg>
				</button>
			</div>
		{/each}
	</div>
{/if}

<style>
	@keyframes slide-in-from-right {
		from {
			transform: translateX(100%);
			opacity: 0;
		}
		to {
			transform: translateX(0);
			opacity: 1;
		}
	}

	.animate-in {
		animation: slide-in-from-right 0.3s ease-out;
	}
</style>
