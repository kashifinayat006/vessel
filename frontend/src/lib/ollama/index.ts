/**
 * Ollama API Integration Layer
 *
 * Provides a complete TypeScript client for the Ollama API with:
 * - Full type definitions for all API endpoints
 * - Streaming support using async generators and callbacks
 * - Comprehensive error handling with classification and retry logic
 * - AbortSignal support for request cancellation
 *
 * @example Basic usage
 * ```typescript
 * import { ollamaClient } from '$lib/ollama';
 *
 * // List models
 * const { models } = await ollamaClient.listModels();
 *
 * // Non-streaming chat
 * const response = await ollamaClient.chat({
 *   model: 'llama3.2',
 *   messages: [{ role: 'user', content: 'Hello!' }]
 * });
 *
 * // Streaming chat with async generator
 * for await (const chunk of ollamaClient.streamChat({
 *   model: 'llama3.2',
 *   messages: [{ role: 'user', content: 'Hello!' }]
 * })) {
 *   console.log(chunk.message.content);
 * }
 *
 * // Streaming chat with callbacks
 * await ollamaClient.streamChatWithCallbacks(
 *   { model: 'llama3.2', messages: [{ role: 'user', content: 'Hello!' }] },
 *   { onToken: (token) => console.log(token) }
 * );
 * ```
 *
 * @example Custom client configuration
 * ```typescript
 * import { OllamaClient } from '$lib/ollama';
 *
 * const client = new OllamaClient({
 *   baseUrl: 'http://my-ollama-server:11434',
 *   defaultTimeoutMs: 60000,
 *   enableRetry: true
 * });
 * ```
 */

// Client
export {
	OllamaClient,
	ollamaClient,
	type OllamaClientConfig,
	type ChatOptions,
	type ConnectionStatus,
	type StreamChatResult,
	type StreamChatCallbacks
} from './client.js';

// Types
export type {
	// Model types
	OllamaModel,
	OllamaModelDetails,
	OllamaModelsResponse,
	OllamaRunningModel,
	OllamaRunningModelsResponse,

	// Message types
	OllamaMessage,
	OllamaMessageRole,
	OllamaToolCall,
	OllamaToolCallFunction,

	// Tool types
	OllamaToolDefinition,
	OllamaToolFunction,
	JsonSchema,
	JsonSchemaProperty,
	JsonSchemaType,

	// Chat types
	OllamaChatRequest,
	OllamaChatResponse,
	OllamaChatStreamChunk,
	OllamaChatMetrics,
	OllamaModelOptions,

	// Generate types
	OllamaGenerateRequest,
	OllamaGenerateResponse,
	OllamaGenerateStreamChunk,

	// Other API types
	OllamaShowRequest,
	OllamaShowResponse,
	OllamaVersionResponse,
	OllamaEmbedRequest,
	OllamaEmbedResponse,

	// Error types
	OllamaErrorResponse,
	OllamaErrorCode,
	OllamaStreamCallbacks
} from './types.js';

// Errors
export {
	OllamaError,
	OllamaConnectionError,
	OllamaTimeoutError,
	OllamaModelNotFoundError,
	OllamaInvalidRequestError,
	OllamaStreamError,
	OllamaParseError,
	OllamaAbortError,
	classifyError,
	createErrorFromResponse,
	withRetry,
	type RetryOptions
} from './errors.js';

// Streaming utilities
export {
	streamChat,
	streamChatWithCallbacks,
	NDJSONParser,
	collectStream,
	type StreamChatOptions
} from './streaming.js';

// Image processing for vision models
export {
	processImageForOllama,
	processImagesForOllama,
	isValidImageType,
	base64ToDataUrl,
	formatFileSize,
	ImageProcessingError,
	type ProcessedImage
} from './image-processor.js';
