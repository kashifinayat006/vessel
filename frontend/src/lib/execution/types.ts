/**
 * Code execution types
 */

/** Supported execution runtimes */
export type ExecutionRuntime = 'javascript' | 'typescript' | 'python' | 'html' | 'shell';

/** Execution status */
export type ExecutionStatus = 'idle' | 'running' | 'success' | 'error' | 'cancelled';

/** Output type for execution results */
export type OutputType = 'stdout' | 'stderr' | 'result' | 'error' | 'image' | 'html';

/** Single output entry */
export interface ExecutionOutput {
	type: OutputType;
	content: string;
	timestamp: number;
}

/** Execution result */
export interface ExecutionResult {
	status: ExecutionStatus;
	outputs: ExecutionOutput[];
	duration: number;
	error?: string;
}

/** Execution request */
export interface ExecutionRequest {
	code: string;
	runtime: ExecutionRuntime;
	/** Optional filename for context */
	filename?: string;
	/** Timeout in milliseconds */
	timeout?: number;
}

/** Runtime capabilities */
export interface RuntimeCapabilities {
	/** Runtime identifier */
	runtime: ExecutionRuntime;
	/** Human-readable name */
	name: string;
	/** Whether the runtime is available */
	available: boolean;
	/** File extensions this runtime handles */
	extensions: string[];
	/** Language aliases (for code block detection) */
	aliases: string[];
	/** Whether this runtime supports package installation */
	supportsPackages: boolean;
	/** Whether this runtime can produce visual output */
	supportsVisualOutput: boolean;
}

/** Code block metadata extracted from markdown */
export interface CodeBlockMeta {
	/** The code content */
	code: string;
	/** Detected language */
	language: string;
	/** Normalized runtime (if executable) */
	runtime: ExecutionRuntime | null;
	/** Whether this code can be executed */
	executable: boolean;
	/** Optional filename hint from code fence */
	filename?: string;
}

/** Executor interface - implemented by each runtime */
export interface CodeExecutor {
	/** Runtime this executor handles */
	runtime: ExecutionRuntime;

	/** Check if the executor is ready */
	isReady(): boolean;

	/** Initialize the executor (load WASM, etc.) */
	initialize(): Promise<void>;

	/** Execute code and return result */
	execute(request: ExecutionRequest): Promise<ExecutionResult>;

	/** Cancel current execution */
	cancel(): void;

	/** Clean up resources */
	destroy(): void;
}

/** Language to runtime mapping */
export const LANGUAGE_RUNTIME_MAP: Record<string, ExecutionRuntime> = {
	// JavaScript
	javascript: 'javascript',
	js: 'javascript',
	jsx: 'javascript',
	mjs: 'javascript',
	cjs: 'javascript',

	// TypeScript
	typescript: 'typescript',
	ts: 'typescript',
	tsx: 'typescript',

	// Python
	python: 'python',
	py: 'python',
	python3: 'python',

	// HTML (preview)
	html: 'html',
	htm: 'html',

	// Shell (limited)
	bash: 'shell',
	sh: 'shell',
	shell: 'shell',
	zsh: 'shell'
};

/** Get runtime from language string */
export function getRuntime(language: string): ExecutionRuntime | null {
	const normalized = language.toLowerCase().trim();
	return LANGUAGE_RUNTIME_MAP[normalized] ?? null;
}

/** Check if a language is executable */
export function isExecutable(language: string): boolean {
	return getRuntime(language) !== null;
}

/** Default timeout for code execution (30 seconds) */
export const DEFAULT_EXECUTION_TIMEOUT = 30000;

/** Maximum output size (1MB) */
export const MAX_OUTPUT_SIZE = 1024 * 1024;
