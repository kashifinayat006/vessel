/**
 * Python code executor using Pyodide
 *
 * Pyodide is a Python distribution for the browser based on WebAssembly.
 * It provides a full Python 3.x runtime with access to numpy, pandas, etc.
 */

import type {
	CodeExecutor,
	ExecutionRequest,
	ExecutionResult,
	ExecutionOutput
} from './types.js';
import { DEFAULT_EXECUTION_TIMEOUT } from './types.js';

/** Pyodide CDN URL */
const PYODIDE_CDN = 'https://cdn.jsdelivr.net/pyodide/v0.25.0/full/';

/** Pyodide interface (loaded dynamically) */
interface PyodideInterface {
	runPythonAsync(code: string): Promise<unknown>;
	loadPackage(packages: string[]): Promise<void>;
	globals: Map<string, unknown>;
	setStdout(options: { batched: (text: string) => void }): void;
	setStderr(options: { batched: (text: string) => void }): void;
}

/** Load Pyodide function type */
type LoadPyodide = (config: { indexURL: string }) => Promise<PyodideInterface>;

/** Python executor using Pyodide */
export class PythonExecutor implements CodeExecutor {
	readonly runtime = 'python' as const;

	private pyodide: PyodideInterface | null = null;
	private loading: Promise<void> | null = null;
	private outputs: ExecutionOutput[] = [];
	private executionStart = 0;

	isReady(): boolean {
		return this.pyodide !== null;
	}

	async initialize(): Promise<void> {
		if (this.pyodide) return;
		if (this.loading) return this.loading;

		this.loading = this.loadPyodide();
		await this.loading;
	}

	private async loadPyodide(): Promise<void> {
		// Dynamically load Pyodide from CDN
		if (typeof window === 'undefined') {
			throw new Error('Pyodide requires a browser environment');
		}

		// Check if already loaded
		if ((window as unknown as { loadPyodide?: LoadPyodide }).loadPyodide) {
			this.pyodide = await (window as unknown as { loadPyodide: LoadPyodide }).loadPyodide({
				indexURL: PYODIDE_CDN
			});
			return;
		}

		// Load Pyodide script
		await new Promise<void>((resolve, reject) => {
			const script = document.createElement('script');
			script.src = `${PYODIDE_CDN}pyodide.js`;
			script.onload = () => resolve();
			script.onerror = () => reject(new Error('Failed to load Pyodide'));
			document.head.appendChild(script);
		});

		// Initialize Pyodide
		const loadPyodide = (window as unknown as { loadPyodide: LoadPyodide }).loadPyodide;
		this.pyodide = await loadPyodide({ indexURL: PYODIDE_CDN });

		// Set up stdout/stderr capture
		this.setupOutputCapture();
	}

	private setupOutputCapture(): void {
		if (!this.pyodide) return;

		this.pyodide.setStdout({
			batched: (text: string) => {
				this.outputs.push({
					type: 'stdout',
					content: text,
					timestamp: Date.now() - this.executionStart
				});
			}
		});

		this.pyodide.setStderr({
			batched: (text: string) => {
				this.outputs.push({
					type: 'stderr',
					content: text,
					timestamp: Date.now() - this.executionStart
				});
			}
		});
	}

	async execute(request: ExecutionRequest): Promise<ExecutionResult> {
		if (!this.pyodide) {
			await this.initialize();
		}

		if (!this.pyodide) {
			return {
				status: 'error',
				outputs: [{
					type: 'error',
					content: 'Failed to initialize Python runtime',
					timestamp: 0
				}],
				duration: 0,
				error: 'Failed to initialize Python runtime'
			};
		}

		this.outputs = [];
		this.executionStart = Date.now();

		const timeout = request.timeout ?? DEFAULT_EXECUTION_TIMEOUT;

		try {
			// Create a timeout promise
			const timeoutPromise = new Promise<never>((_, reject) => {
				setTimeout(() => reject(new Error('Execution timed out')), timeout);
			});

			// Execute code with timeout
			const result = await Promise.race([
				this.pyodide.runPythonAsync(request.code),
				timeoutPromise
			]);

			const duration = Date.now() - this.executionStart;

			// Add result if not None
			if (result !== undefined && result !== null) {
				this.outputs.push({
					type: 'result',
					content: this.formatPythonValue(result),
					timestamp: duration
				});
			}

			return {
				status: 'success',
				outputs: [...this.outputs],
				duration
			};
		} catch (error) {
			const duration = Date.now() - this.executionStart;
			const errorMessage = error instanceof Error ? error.message : String(error);

			this.outputs.push({
				type: 'error',
				content: errorMessage,
				timestamp: duration
			});

			return {
				status: 'error',
				outputs: [...this.outputs],
				duration,
				error: errorMessage
			};
		}
	}

	private formatPythonValue(value: unknown): string {
		if (value === null || value === undefined) return 'None';
		if (typeof value === 'string') return value;
		if (typeof value === 'number' || typeof value === 'boolean') return String(value);

		try {
			return JSON.stringify(value, null, 2);
		} catch {
			return String(value);
		}
	}

	cancel(): void {
		// Pyodide doesn't support cancellation easily
		// The best we can do is interrupt on the next Python instruction
		// For now, we just note that cancellation was requested
		this.outputs.push({
			type: 'stderr',
			content: 'Cancellation requested (may not take effect immediately)',
			timestamp: Date.now() - this.executionStart
		});
	}

	destroy(): void {
		// Pyodide doesn't have a clean destroy mechanism
		// The instance will be garbage collected when no longer referenced
		this.pyodide = null;
		this.loading = null;
	}

	/**
	 * Load additional Python packages
	 */
	async loadPackages(packages: string[]): Promise<void> {
		if (!this.pyodide) {
			await this.initialize();
		}
		await this.pyodide?.loadPackage(packages);
	}
}

/** Singleton instance */
export const pythonExecutor = new PythonExecutor();
