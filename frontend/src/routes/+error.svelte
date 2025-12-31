<script lang="ts">
	/**
	 * Error boundary page
	 * Displays friendly error messages with retry and navigation options
	 */

	import { page } from '$app/stores';
	import { goto } from '$app/navigation';

	/**
	 * Attempt to retry the current page
	 */
	function handleRetry(): void {
		window.location.reload();
	}

	/**
	 * Navigate back to home
	 */
	function handleGoHome(): void {
		goto('/');
	}

	// Get error details from page store
	const error = $derived($page.error);
	const status = $derived($page.status);

	// Determine error message based on status
	const errorMessage = $derived.by(() => {
		if (status === 404) {
			return 'The page you are looking for does not exist.';
		}
		if (status === 500) {
			return 'Something went wrong on our end. Please try again.';
		}
		return error?.message || 'An unexpected error occurred.';
	});

	// Determine error title based on status
	const errorTitle = $derived.by(() => {
		if (status === 404) {
			return 'Page Not Found';
		}
		if (status === 500) {
			return 'Server Error';
		}
		return 'Error';
	});
</script>

<div class="flex h-full items-center justify-center bg-white p-8 dark:bg-gray-900">
	<div class="max-w-md text-center">
		<!-- Error icon -->
		<div class="mb-6">
			<svg
				class="mx-auto h-24 w-24 text-gray-400 dark:text-gray-500"
				fill="none"
				stroke="currentColor"
				viewBox="0 0 24 24"
				aria-hidden="true"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="1.5"
					d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
				/>
			</svg>
		</div>

		<!-- Error status code -->
		{#if status}
			<p class="mb-2 text-6xl font-bold text-gray-300 dark:text-gray-600">
				{status}
			</p>
		{/if}

		<!-- Error title -->
		<h1 class="mb-4 text-2xl font-semibold text-gray-900 dark:text-white">
			{errorTitle}
		</h1>

		<!-- Error message -->
		<p class="mb-8 text-gray-600 dark:text-gray-400">
			{errorMessage}
		</p>

		<!-- Action buttons -->
		<div class="flex flex-col gap-3 sm:flex-row sm:justify-center">
			<button
				type="button"
				onclick={handleRetry}
				class="
					inline-flex items-center justify-center rounded-lg
					bg-blue-600 px-5 py-2.5 text-sm font-medium text-white
					hover:bg-blue-700 focus:outline-none focus:ring-2
					focus:ring-blue-500 focus:ring-offset-2
					dark:bg-blue-500 dark:hover:bg-blue-600
					dark:focus:ring-offset-gray-900
				"
			>
				<svg
					class="-ml-0.5 mr-2 h-4 w-4"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
					aria-hidden="true"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
					/>
				</svg>
				Try Again
			</button>

			<button
				type="button"
				onclick={handleGoHome}
				class="
					inline-flex items-center justify-center rounded-lg
					border border-gray-300 bg-white px-5 py-2.5
					text-sm font-medium text-gray-700 hover:bg-gray-50
					focus:outline-none focus:ring-2 focus:ring-blue-500
					focus:ring-offset-2 dark:border-gray-600 dark:bg-gray-800
					dark:text-gray-300 dark:hover:bg-gray-700
					dark:focus:ring-offset-gray-900
				"
			>
				<svg
					class="-ml-0.5 mr-2 h-4 w-4"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
					aria-hidden="true"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
					/>
				</svg>
				Go Home
			</button>
		</div>

		<!-- Additional help text -->
		<p class="mt-8 text-sm text-gray-500 dark:text-gray-400">
			If the problem persists, please check that Ollama is running and accessible.
		</p>
	</div>
</div>
