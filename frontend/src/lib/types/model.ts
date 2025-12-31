/**
 * Ollama model types matching the API response structure
 */

/** Model details from Ollama API */
export interface OllamaModelDetails {
	parent_model: string;
	format: string;
	family: string;
	families: string[] | null;
	parameter_size: string;
	quantization_level: string;
}

/** Single model from Ollama API /api/tags response */
export interface OllamaModel {
	name: string;
	model: string;
	modified_at: string;
	size: number;
	digest: string;
	details: OllamaModelDetails;
}

/** Response from Ollama /api/tags endpoint */
export interface OllamaModelsResponse {
	models: OllamaModel[];
}

/** Grouped models by family */
export interface ModelGroup {
	family: string;
	models: OllamaModel[];
}
