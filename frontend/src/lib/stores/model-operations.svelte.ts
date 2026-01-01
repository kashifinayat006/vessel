/**
 * Model operations state management
 * Tracks active pulls and pending deletes for model management
 */

import { ollamaClient, type OllamaPullProgress } from '$lib/ollama';
import { modelsState, toastState } from '$lib/stores';

/**
 * Enhanced pull progress with calculated percent
 */
export interface PullProgressWithPercent extends OllamaPullProgress {
	/** Calculated percent complete (0-100) */
	percent: number;
	/** Current download speed in bytes/second */
	speed?: number;
	/** Estimated time remaining in seconds */
	eta?: number;
}

/**
 * Active pull operation tracking
 */
export interface ActivePull {
	/** Model name being pulled */
	name: string;
	/** Latest progress update */
	progress: PullProgressWithPercent;
	/** AbortController for cancellation */
	controller: AbortController;
	/** Start time for speed calculation */
	startTime: number;
	/** Last update time for speed calculation */
	lastUpdateTime: number;
	/** Last completed bytes for speed calculation */
	lastCompleted: number;
}

/**
 * Model operations state class
 */
export class ModelOperationsState {
	// Active pull operations (model name -> progress)
	activePulls = $state<Map<string, ActivePull>>(new Map());

	// Models pending deletion (shown with loading state)
	pendingDeletes = $state<Set<string>>(new Set());

	// Pull dialog state
	isPullDialogOpen = $state(false);
	pullModelInput = $state('');

	// Delete confirmation state
	deleteConfirmModel = $state<string | null>(null);

	// Derived: Is any operation in progress
	hasActiveOperations = $derived.by(() => {
		return this.activePulls.size > 0 || this.pendingDeletes.size > 0;
	});

	/**
	 * Open the pull dialog
	 */
	openPullDialog(): void {
		this.isPullDialogOpen = true;
		this.pullModelInput = '';
	}

	/**
	 * Close the pull dialog
	 */
	closePullDialog(): void {
		this.isPullDialogOpen = false;
		this.pullModelInput = '';
	}

	/**
	 * Start a model pull operation
	 */
	async pullModel(name: string): Promise<void> {
		// Normalize model name
		const normalizedName = name.trim().toLowerCase();

		if (!normalizedName) {
			toastState.error('Please enter a model name');
			return;
		}

		// Check if already pulling
		if (this.activePulls.has(normalizedName)) {
			toastState.warning(`Already pulling ${normalizedName}`);
			return;
		}

		const controller = new AbortController();
		const now = Date.now();

		// Initialize pull tracking
		const pullState: ActivePull = {
			name: normalizedName,
			progress: {
				status: 'starting',
				percent: 0
			},
			controller,
			startTime: now,
			lastUpdateTime: now,
			lastCompleted: 0
		};

		this.activePulls = new Map(this.activePulls).set(normalizedName, pullState);
		this.closePullDialog();

		try {
			await ollamaClient.pullModel(
				normalizedName,
				(progress) => {
					this.updatePullProgress(normalizedName, progress);
				},
				controller.signal
			);

			// Success - refresh model list
			toastState.success(`Successfully pulled ${normalizedName}`);
			await modelsState.refresh();

		} catch (error) {
			if (error instanceof Error && error.name === 'AbortError') {
				toastState.info(`Cancelled pull of ${normalizedName}`);
			} else {
				toastState.error(`Failed to pull ${normalizedName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
			}
		} finally {
			// Remove from active pulls
			const newPulls = new Map(this.activePulls);
			newPulls.delete(normalizedName);
			this.activePulls = newPulls;
		}
	}

	/**
	 * Update progress for an active pull
	 */
	private updatePullProgress(name: string, progress: OllamaPullProgress): void {
		const existing = this.activePulls.get(name);
		if (!existing) return;

		const now = Date.now();

		// Calculate percent
		let percent = 0;
		if (progress.total && progress.total > 0 && progress.completed !== undefined) {
			percent = Math.round((progress.completed / progress.total) * 100);
		}

		// Calculate speed (bytes/second)
		let speed: number | undefined;
		const timeDelta = (now - existing.lastUpdateTime) / 1000;
		if (timeDelta > 0 && progress.completed !== undefined) {
			const bytesDelta = progress.completed - existing.lastCompleted;
			if (bytesDelta > 0) {
				speed = bytesDelta / timeDelta;
			}
		}

		// Calculate ETA
		let eta: number | undefined;
		if (speed && progress.total && progress.completed !== undefined) {
			const remaining = progress.total - progress.completed;
			if (remaining > 0) {
				eta = remaining / speed;
			}
		}

		const progressWithPercent: PullProgressWithPercent = {
			...progress,
			percent,
			speed,
			eta
		};

		const updatedPull: ActivePull = {
			...existing,
			progress: progressWithPercent,
			lastUpdateTime: now,
			lastCompleted: progress.completed ?? existing.lastCompleted
		};

		this.activePulls = new Map(this.activePulls).set(name, updatedPull);
	}

	/**
	 * Cancel an active pull operation
	 */
	cancelPull(name: string): void {
		const pull = this.activePulls.get(name);
		if (pull) {
			pull.controller.abort();
		}
	}

	/**
	 * Show delete confirmation dialog
	 */
	confirmDelete(name: string): void {
		this.deleteConfirmModel = name;
	}

	/**
	 * Cancel delete confirmation
	 */
	cancelDelete(): void {
		this.deleteConfirmModel = null;
	}

	/**
	 * Delete a model
	 */
	async deleteModel(name: string): Promise<void> {
		this.deleteConfirmModel = null;

		// Check if model is being pulled
		if (this.activePulls.has(name)) {
			toastState.warning(`Cannot delete ${name} while it's being pulled`);
			return;
		}

		// Check if already pending delete
		if (this.pendingDeletes.has(name)) {
			return;
		}

		// Add to pending deletes
		this.pendingDeletes = new Set(this.pendingDeletes).add(name);

		try {
			await ollamaClient.deleteModel(name);
			toastState.success(`Deleted ${name}`);
			await modelsState.refresh();

		} catch (error) {
			toastState.error(`Failed to delete ${name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
		} finally {
			// Remove from pending deletes
			const newDeletes = new Set(this.pendingDeletes);
			newDeletes.delete(name);
			this.pendingDeletes = newDeletes;
		}
	}

	/**
	 * Format bytes for display
	 */
	formatBytes(bytes: number): string {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
		return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
	}

	/**
	 * Format time for display
	 */
	formatTime(seconds: number): string {
		if (seconds < 60) return `${Math.round(seconds)}s`;
		if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
		return `${Math.round(seconds / 3600)}h`;
	}
}

/** Singleton model operations state instance */
export const modelOperationsState = new ModelOperationsState();
