/**
 * JavaScript code executor
 *
 * Executes JavaScript code in an isolated context using a Web Worker.
 * Provides console capture, timeout handling, and result serialization.
 *
 * SECURITY NOTE: This intentionally uses eval() inside a Web Worker to execute
 * user-provided code. The Web Worker provides isolation from the main thread.
 * This is the standard pattern for browser-based code playgrounds.
 */

import type {
	CodeExecutor,
	ExecutionRequest,
	ExecutionResult
} from './types.js';
import { DEFAULT_EXECUTION_TIMEOUT } from './types.js';

/** Worker script as a blob URL */
function createWorkerScript(): string {
	// This script runs inside an isolated Web Worker
	// It captures console output and safely executes user code
	const script = `
		// Captured console outputs
		const outputs = [];
		let executionStart = Date.now();

		// Override console methods to capture output
		const originalConsole = { ...console };
		console.log = (...args) => {
			outputs.push({ type: 'stdout', content: args.map(formatValue).join(' '), timestamp: Date.now() - executionStart });
		};
		console.error = (...args) => {
			outputs.push({ type: 'stderr', content: args.map(formatValue).join(' '), timestamp: Date.now() - executionStart });
		};
		console.warn = (...args) => {
			outputs.push({ type: 'stderr', content: '[warn] ' + args.map(formatValue).join(' '), timestamp: Date.now() - executionStart });
		};
		console.info = (...args) => {
			outputs.push({ type: 'stdout', content: args.map(formatValue).join(' '), timestamp: Date.now() - executionStart });
		};

		// Format values for display
		function formatValue(val) {
			if (val === undefined) return 'undefined';
			if (val === null) return 'null';
			if (typeof val === 'function') return val.toString();
			if (typeof val === 'object') {
				try {
					return JSON.stringify(val, null, 2);
				} catch {
					return String(val);
				}
			}
			return String(val);
		}

		// Execute code using Function constructor (safer than direct eval)
		async function executeCode(code) {
			// Wrap in async function to support top-level await
			const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
			const fn = new AsyncFunction(code);
			return await fn();
		}

		// Handle execution requests
		self.onmessage = async (event) => {
			const { code, id } = event.data;
			outputs.length = 0;
			executionStart = Date.now();

			try {
				const result = await executeCode(code);

				// Add result if not undefined
				if (result !== undefined) {
					outputs.push({
						type: 'result',
						content: formatValue(result),
						timestamp: Date.now() - executionStart
					});
				}

				self.postMessage({
					id,
					status: 'success',
					outputs: outputs.slice(),
					duration: Date.now() - executionStart
				});
			} catch (error) {
				outputs.push({
					type: 'error',
					content: error.message || String(error),
					timestamp: Date.now() - executionStart
				});

				self.postMessage({
					id,
					status: 'error',
					outputs: outputs.slice(),
					duration: Date.now() - executionStart,
					error: error.message || String(error)
				});
			}
		};
	`;

	const blob = new Blob([script], { type: 'application/javascript' });
	return URL.createObjectURL(blob);
}

/** JavaScript executor using Web Workers */
export class JavaScriptExecutor implements CodeExecutor {
	readonly runtime = 'javascript' as const;

	private worker: Worker | null = null;
	private workerUrl: string | null = null;
	private currentRequestId = 0;
	private pendingRequest: {
		id: number;
		resolve: (result: ExecutionResult) => void;
		reject: (error: Error) => void;
		timeout: ReturnType<typeof setTimeout>;
	} | null = null;

	isReady(): boolean {
		return this.worker !== null;
	}

	async initialize(): Promise<void> {
		if (this.worker) return;

		this.workerUrl = createWorkerScript();
		this.worker = new Worker(this.workerUrl);

		this.worker.onmessage = (event) => {
			const { id, status, outputs, duration, error } = event.data;

			if (this.pendingRequest && this.pendingRequest.id === id) {
				clearTimeout(this.pendingRequest.timeout);
				this.pendingRequest.resolve({ status, outputs, duration, error });
				this.pendingRequest = null;
			}
		};

		this.worker.onerror = (event) => {
			if (this.pendingRequest) {
				clearTimeout(this.pendingRequest.timeout);
				this.pendingRequest.reject(new Error(event.message));
				this.pendingRequest = null;
			}
		};
	}

	async execute(request: ExecutionRequest): Promise<ExecutionResult> {
		if (!this.worker) {
			await this.initialize();
		}

		// Cancel any pending request
		if (this.pendingRequest) {
			this.cancel();
		}

		const id = ++this.currentRequestId;
		const timeout = request.timeout ?? DEFAULT_EXECUTION_TIMEOUT;

		return new Promise((resolve, reject) => {
			const timeoutHandle = setTimeout(() => {
				if (this.pendingRequest?.id === id) {
					this.pendingRequest = null;
					// Terminate and recreate worker on timeout
					this.terminateWorker();
					resolve({
						status: 'error',
						outputs: [{
							type: 'error',
							content: `Execution timed out after ${timeout}ms`,
							timestamp: timeout
						}],
						duration: timeout,
						error: 'Execution timed out'
					});
				}
			}, timeout);

			this.pendingRequest = { id, resolve, reject, timeout: timeoutHandle };
			this.worker!.postMessage({ code: request.code, id });
		});
	}

	cancel(): void {
		if (this.pendingRequest) {
			clearTimeout(this.pendingRequest.timeout);
			this.pendingRequest.resolve({
				status: 'cancelled',
				outputs: [{
					type: 'stderr',
					content: 'Execution cancelled',
					timestamp: 0
				}],
				duration: 0
			});
			this.pendingRequest = null;
		}
		// Terminate and recreate worker to stop execution
		this.terminateWorker();
	}

	private terminateWorker(): void {
		if (this.worker) {
			this.worker.terminate();
			this.worker = null;
		}
	}

	destroy(): void {
		this.cancel();
		if (this.workerUrl) {
			URL.revokeObjectURL(this.workerUrl);
			this.workerUrl = null;
		}
	}
}

/** Singleton instance */
export const jsExecutor = new JavaScriptExecutor();
