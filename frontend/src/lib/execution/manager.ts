/**
 * Execution manager - coordinates code execution across runtimes
 */

import type {
	CodeExecutor,
	ExecutionRequest,
	ExecutionResult,
	ExecutionRuntime,
	RuntimeCapabilities
} from './types.js';
import { getRuntime, isExecutable } from './types.js';
import { jsExecutor } from './javascript-executor.js';
import { pythonExecutor } from './python-executor.js';

/** Runtime capability definitions */
const RUNTIME_CAPABILITIES: RuntimeCapabilities[] = [
	{
		runtime: 'javascript',
		name: 'JavaScript',
		available: true,
		extensions: ['.js', '.mjs', '.cjs'],
		aliases: ['js', 'javascript', 'jsx', 'mjs', 'cjs'],
		supportsPackages: false,
		supportsVisualOutput: false
	},
	{
		runtime: 'typescript',
		name: 'TypeScript',
		available: false, // Requires transpilation - future feature
		extensions: ['.ts', '.tsx'],
		aliases: ['ts', 'typescript', 'tsx'],
		supportsPackages: false,
		supportsVisualOutput: false
	},
	{
		runtime: 'python',
		name: 'Python (Pyodide)',
		available: true,
		extensions: ['.py'],
		aliases: ['python', 'py', 'python3'],
		supportsPackages: true,
		supportsVisualOutput: true // matplotlib support
	},
	{
		runtime: 'html',
		name: 'HTML Preview',
		available: true,
		extensions: ['.html', '.htm'],
		aliases: ['html', 'htm'],
		supportsPackages: false,
		supportsVisualOutput: true
	},
	{
		runtime: 'shell',
		name: 'Shell (Limited)',
		available: false, // Not safe in browser
		extensions: ['.sh', '.bash'],
		aliases: ['bash', 'sh', 'shell', 'zsh'],
		supportsPackages: false,
		supportsVisualOutput: false
	}
];

/** Execution manager class */
class ExecutionManager {
	private executors: Map<ExecutionRuntime, CodeExecutor> = new Map();
	private initPromises: Map<ExecutionRuntime, Promise<void>> = new Map();

	constructor() {
		// Register built-in executors
		this.executors.set('javascript', jsExecutor);
		this.executors.set('python', pythonExecutor);
	}

	/**
	 * Get capabilities for all runtimes
	 */
	getCapabilities(): RuntimeCapabilities[] {
		return RUNTIME_CAPABILITIES;
	}

	/**
	 * Get capabilities for a specific runtime
	 */
	getRuntimeCapabilities(runtime: ExecutionRuntime): RuntimeCapabilities | null {
		return RUNTIME_CAPABILITIES.find((c) => c.runtime === runtime) ?? null;
	}

	/**
	 * Check if a runtime is available
	 */
	isRuntimeAvailable(runtime: ExecutionRuntime): boolean {
		const caps = this.getRuntimeCapabilities(runtime);
		return caps?.available ?? false;
	}

	/**
	 * Check if a language can be executed
	 */
	canExecute(language: string): boolean {
		const runtime = getRuntime(language);
		if (!runtime) return false;
		return this.isRuntimeAvailable(runtime);
	}

	/**
	 * Initialize a runtime (lazy loading)
	 */
	async initializeRuntime(runtime: ExecutionRuntime): Promise<void> {
		const executor = this.executors.get(runtime);
		if (!executor) {
			throw new Error(`No executor registered for runtime: ${runtime}`);
		}

		// Check if already initializing
		const existing = this.initPromises.get(runtime);
		if (existing) return existing;

		// Check if already ready
		if (executor.isReady()) return;

		// Initialize
		const promise = executor.initialize();
		this.initPromises.set(runtime, promise);

		try {
			await promise;
		} finally {
			this.initPromises.delete(runtime);
		}
	}

	/**
	 * Execute code
	 */
	async execute(request: ExecutionRequest): Promise<ExecutionResult> {
		const { runtime, code } = request;

		// Check if runtime is available
		if (!this.isRuntimeAvailable(runtime)) {
			return {
				status: 'error',
				outputs: [{
					type: 'error',
					content: `Runtime "${runtime}" is not available`,
					timestamp: 0
				}],
				duration: 0,
				error: `Runtime "${runtime}" is not available`
			};
		}

		// Get executor
		const executor = this.executors.get(runtime);
		if (!executor) {
			return {
				status: 'error',
				outputs: [{
					type: 'error',
					content: `No executor for runtime: ${runtime}`,
					timestamp: 0
				}],
				duration: 0,
				error: `No executor for runtime: ${runtime}`
			};
		}

		// Initialize if needed
		await this.initializeRuntime(runtime);

		// Execute
		return executor.execute(request);
	}

	/**
	 * Execute code by language (auto-detects runtime)
	 */
	async executeByLanguage(
		code: string,
		language: string,
		options?: Partial<Omit<ExecutionRequest, 'code' | 'runtime'>>
	): Promise<ExecutionResult> {
		const runtime = getRuntime(language);

		if (!runtime) {
			return {
				status: 'error',
				outputs: [{
					type: 'error',
					content: `Unknown language: ${language}`,
					timestamp: 0
				}],
				duration: 0,
				error: `Unknown language: ${language}`
			};
		}

		return this.execute({
			code,
			runtime,
			...options
		});
	}

	/**
	 * Cancel execution for a runtime
	 */
	cancel(runtime: ExecutionRuntime): void {
		const executor = this.executors.get(runtime);
		executor?.cancel();
	}

	/**
	 * Cancel all executions
	 */
	cancelAll(): void {
		for (const executor of this.executors.values()) {
			executor.cancel();
		}
	}

	/**
	 * Clean up all executors
	 */
	destroy(): void {
		for (const executor of this.executors.values()) {
			executor.destroy();
		}
		this.executors.clear();
		this.initPromises.clear();
	}
}

/** Singleton execution manager */
export const executionManager = new ExecutionManager();
