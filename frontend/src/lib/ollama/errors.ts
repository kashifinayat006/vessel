/**
 * Error handling for Ollama API
 */

import type { OllamaErrorCode, OllamaErrorResponse } from './types.js';

// ============================================================================
// Error Classes
// ============================================================================

/**
 * Base error class for Ollama API errors
 */
export class OllamaError extends Error {
	public readonly code: OllamaErrorCode;
	public readonly statusCode?: number;
	public readonly originalError?: Error;

	constructor(
		message: string,
		code: OllamaErrorCode,
		options?: {
			statusCode?: number;
			cause?: Error;
		}
	) {
		super(message, { cause: options?.cause });
		this.name = 'OllamaError';
		this.code = code;
		this.statusCode = options?.statusCode;
		this.originalError = options?.cause;
	}

	/** Check if error is retryable */
	get isRetryable(): boolean {
		return (
			this.code === 'CONNECTION_ERROR' ||
			this.code === 'TIMEOUT_ERROR' ||
			this.code === 'SERVER_ERROR'
		);
	}
}

/**
 * Connection error when Ollama server is unreachable
 */
export class OllamaConnectionError extends OllamaError {
	constructor(message: string, cause?: Error) {
		super(message, 'CONNECTION_ERROR', { cause });
		this.name = 'OllamaConnectionError';
	}
}

/**
 * Timeout error when request takes too long
 */
export class OllamaTimeoutError extends OllamaError {
	public readonly timeoutMs: number;

	constructor(message: string, timeoutMs: number, cause?: Error) {
		super(message, 'TIMEOUT_ERROR', { cause });
		this.name = 'OllamaTimeoutError';
		this.timeoutMs = timeoutMs;
	}
}

/**
 * Error when requested model is not found
 */
export class OllamaModelNotFoundError extends OllamaError {
	public readonly modelName: string;

	constructor(modelName: string, message?: string) {
		super(message ?? `Model '${modelName}' not found`, 'MODEL_NOT_FOUND', { statusCode: 404 });
		this.name = 'OllamaModelNotFoundError';
		this.modelName = modelName;
	}
}

/**
 * Error when request is invalid
 */
export class OllamaInvalidRequestError extends OllamaError {
	constructor(message: string) {
		super(message, 'INVALID_REQUEST', { statusCode: 400 });
		this.name = 'OllamaInvalidRequestError';
	}
}

/**
 * Error when streaming fails
 */
export class OllamaStreamError extends OllamaError {
	constructor(message: string, cause?: Error) {
		super(message, 'STREAM_ERROR', { cause });
		this.name = 'OllamaStreamError';
	}
}

/**
 * Error when parsing response fails
 */
export class OllamaParseError extends OllamaError {
	public readonly rawData?: string;

	constructor(message: string, rawData?: string, cause?: Error) {
		super(message, 'PARSE_ERROR', { cause });
		this.name = 'OllamaParseError';
		this.rawData = rawData;
	}
}

/**
 * Error when request is aborted
 */
export class OllamaAbortError extends OllamaError {
	constructor(message?: string) {
		super(message ?? 'Request was aborted', 'ABORT_ERROR');
		this.name = 'OllamaAbortError';
	}
}

// ============================================================================
// Error Classification
// ============================================================================

/**
 * Classifies an unknown error into a specific OllamaError type
 */
export function classifyError(error: unknown, context?: string): OllamaError {
	// Already an OllamaError
	if (error instanceof OllamaError) {
		return error;
	}

	const prefix = context ? `${context}: ` : '';

	// Handle fetch/network errors
	if (error instanceof TypeError) {
		// Network errors often manifest as TypeError
		if (error.message.includes('fetch') || error.message.includes('network')) {
			return new OllamaConnectionError(
				`${prefix}Network error: ${error.message}`,
				error
			);
		}
	}

	// Handle DOMException (abort, timeout)
	if (error instanceof DOMException) {
		if (error.name === 'AbortError') {
			return new OllamaAbortError(`${prefix}Request aborted`);
		}
		if (error.name === 'TimeoutError') {
			return new OllamaTimeoutError(`${prefix}Request timed out`, 0, error);
		}
	}

	// Handle generic Error
	if (error instanceof Error) {
		const message = error.message.toLowerCase();

		// Connection errors
		if (
			message.includes('econnrefused') ||
			message.includes('enotfound') ||
			message.includes('connection refused') ||
			message.includes('network') ||
			message.includes('failed to fetch')
		) {
			return new OllamaConnectionError(
				`${prefix}Connection failed: ${error.message}`,
				error
			);
		}

		// Timeout errors
		if (message.includes('timeout') || message.includes('timed out')) {
			return new OllamaTimeoutError(
				`${prefix}Request timed out: ${error.message}`,
				0,
				error
			);
		}

		// Abort errors
		if (message.includes('abort')) {
			return new OllamaAbortError(`${prefix}${error.message}`);
		}

		// Unknown error
		return new OllamaError(
			`${prefix}${error.message}`,
			'UNKNOWN_ERROR',
			{ cause: error }
		);
	}

	// Handle unknown types
	return new OllamaError(
		`${prefix}Unknown error: ${String(error)}`,
		'UNKNOWN_ERROR'
	);
}

/**
 * Creates an appropriate error from an HTTP response
 */
export async function createErrorFromResponse(
	response: Response,
	context?: string
): Promise<OllamaError> {
	const prefix = context ? `${context}: ` : '';
	let errorMessage = `HTTP ${response.status}`;

	try {
		const body = await response.text();
		if (body) {
			try {
				const parsed = JSON.parse(body) as OllamaErrorResponse;
				if (parsed.error) {
					errorMessage = parsed.error;
				}
			} catch {
				// Not JSON, use raw text
				errorMessage = body;
			}
		}
	} catch {
		// Ignore body read errors
	}

	// Classify by status code
	switch (response.status) {
		case 400:
			return new OllamaInvalidRequestError(`${prefix}${errorMessage}`);

		case 404:
			// Check if it's a model not found error
			if (errorMessage.toLowerCase().includes('model')) {
				const modelMatch = errorMessage.match(/model\s+['"]?([^'"]+)['"]?/i);
				const modelName = modelMatch?.[1] ?? 'unknown';
				return new OllamaModelNotFoundError(modelName, `${prefix}${errorMessage}`);
			}
			return new OllamaError(`${prefix}${errorMessage}`, 'MODEL_NOT_FOUND', {
				statusCode: 404
			});

		case 408:
		case 504:
			return new OllamaTimeoutError(`${prefix}${errorMessage}`, 0);

		case 500:
		case 502:
		case 503:
			return new OllamaError(`${prefix}${errorMessage}`, 'SERVER_ERROR', {
				statusCode: response.status
			});

		default:
			return new OllamaError(`${prefix}${errorMessage}`, 'UNKNOWN_ERROR', {
				statusCode: response.status
			});
	}
}

// ============================================================================
// Retry Helper
// ============================================================================

/** Options for retry behavior */
export interface RetryOptions {
	/** Maximum number of retry attempts (default: 3) */
	maxAttempts?: number;
	/** Initial delay in milliseconds (default: 1000) */
	initialDelayMs?: number;
	/** Maximum delay in milliseconds (default: 10000) */
	maxDelayMs?: number;
	/** Backoff multiplier (default: 2) */
	backoffMultiplier?: number;
	/** AbortSignal for cancellation */
	signal?: AbortSignal;
	/** Callback for retry attempts */
	onRetry?: (error: OllamaError, attempt: number, delayMs: number) => void;
	/** Custom function to determine if error is retryable */
	isRetryable?: (error: OllamaError) => boolean;
}

/**
 * Wraps an async function with retry logic using exponential backoff
 */
export async function withRetry<T>(
	fn: () => Promise<T>,
	options: RetryOptions = {}
): Promise<T> {
	const {
		maxAttempts = 3,
		initialDelayMs = 1000,
		maxDelayMs = 10000,
		backoffMultiplier = 2,
		signal,
		onRetry,
		isRetryable = (error: OllamaError) => error.isRetryable
	} = options;

	let lastError: OllamaError | undefined;
	let delayMs = initialDelayMs;

	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		// Check for abort before each attempt
		if (signal?.aborted) {
			throw new OllamaAbortError('Operation aborted before retry');
		}

		try {
			return await fn();
		} catch (error) {
			lastError = classifyError(error);

			// Don't retry non-retryable errors or on last attempt
			if (!isRetryable(lastError) || attempt === maxAttempts) {
				throw lastError;
			}

			// Don't retry abort errors
			if (lastError.code === 'ABORT_ERROR') {
				throw lastError;
			}

			// Notify about retry
			onRetry?.(lastError, attempt, delayMs);

			// Wait with exponential backoff
			await sleep(delayMs, signal);

			// Increase delay for next attempt
			delayMs = Math.min(delayMs * backoffMultiplier, maxDelayMs);
		}
	}

	// This should never be reached, but TypeScript needs it
	throw lastError ?? new OllamaError('Retry failed', 'UNKNOWN_ERROR');
}

/**
 * Sleep for a specified duration with abort support
 */
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
	return new Promise((resolve, reject) => {
		if (signal?.aborted) {
			reject(new OllamaAbortError('Sleep aborted'));
			return;
		}

		const timeout = setTimeout(resolve, ms);

		signal?.addEventListener(
			'abort',
			() => {
				clearTimeout(timeout);
				reject(new OllamaAbortError('Sleep aborted'));
			},
			{ once: true }
		);
	});
}
