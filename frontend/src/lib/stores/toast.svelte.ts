/**
 * Toast notification state management using Svelte 5 runes
 * Provides a simple toast notification system for user feedback
 */

/** Toast notification types */
export type ToastType = 'success' | 'error' | 'warning' | 'info';

/** Toast notification data */
export interface Toast {
	id: string;
	type: ToastType;
	message: string;
	duration: number;
}

/** Default toast duration in milliseconds */
const DEFAULT_DURATION = 4000;

/** Generate unique toast ID */
function generateId(): string {
	return `toast-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Toast state class with reactive properties */
export class ToastState {
	/** Active toasts */
	toasts = $state<Toast[]>([]);

	/** Timeout handles for auto-dismiss */
	private timeouts = new Map<string, ReturnType<typeof setTimeout>>();

	/**
	 * Show a toast notification
	 * @param type Toast type
	 * @param message Message to display
	 * @param duration Duration in ms (0 = no auto-dismiss)
	 * @returns Toast ID
	 */
	show(type: ToastType, message: string, duration: number = DEFAULT_DURATION): string {
		const id = generateId();
		const toast: Toast = { id, type, message, duration };

		this.toasts = [...this.toasts, toast];

		// Set up auto-dismiss
		if (duration > 0) {
			const timeout = setTimeout(() => {
				this.dismiss(id);
			}, duration);
			this.timeouts.set(id, timeout);
		}

		return id;
	}

	/**
	 * Show a success toast
	 * @param message Message to display
	 * @param duration Optional duration
	 */
	success(message: string, duration?: number): string {
		return this.show('success', message, duration);
	}

	/**
	 * Show an error toast
	 * @param message Message to display
	 * @param duration Optional duration
	 */
	error(message: string, duration?: number): string {
		return this.show('error', message, duration ?? 6000); // Errors stay longer
	}

	/**
	 * Show a warning toast
	 * @param message Message to display
	 * @param duration Optional duration
	 */
	warning(message: string, duration?: number): string {
		return this.show('warning', message, duration);
	}

	/**
	 * Show an info toast
	 * @param message Message to display
	 * @param duration Optional duration
	 */
	info(message: string, duration?: number): string {
		return this.show('info', message, duration);
	}

	/**
	 * Dismiss a specific toast
	 * @param id Toast ID to dismiss
	 */
	dismiss(id: string): void {
		// Clear timeout if exists
		const timeout = this.timeouts.get(id);
		if (timeout) {
			clearTimeout(timeout);
			this.timeouts.delete(id);
		}

		this.toasts = this.toasts.filter((t) => t.id !== id);
	}

	/**
	 * Dismiss all toasts
	 */
	dismissAll(): void {
		// Clear all timeouts
		for (const timeout of this.timeouts.values()) {
			clearTimeout(timeout);
		}
		this.timeouts.clear();

		this.toasts = [];
	}
}

/** Singleton toast state instance */
export const toastState = new ToastState();
