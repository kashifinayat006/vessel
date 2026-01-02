package api

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/ollama/ollama/api"
)

// RemoteModel represents a model from ollama.com with cached details
type RemoteModel struct {
	Slug            string            `json:"slug"`
	Name            string            `json:"name"`
	Description     string            `json:"description"`
	ModelType       string            `json:"modelType"` // "official" or "community"
	Architecture    string            `json:"architecture,omitempty"`
	ParameterSize   string            `json:"parameterSize,omitempty"`
	ContextLength   int64             `json:"contextLength,omitempty"`
	EmbeddingLength int64             `json:"embeddingLength,omitempty"`
	Quantization    string            `json:"quantization,omitempty"`
	Capabilities    []string          `json:"capabilities"`
	DefaultParams   map[string]any    `json:"defaultParams,omitempty"`
	License         string            `json:"license,omitempty"`
	PullCount       int64             `json:"pullCount"`
	Tags            []string          `json:"tags"`
	TagSizes        map[string]int64  `json:"tagSizes,omitempty"` // Maps tag name to file size in bytes
	OllamaUpdatedAt string            `json:"ollamaUpdatedAt,omitempty"`
	DetailsFetchedAt string           `json:"detailsFetchedAt,omitempty"`
	ScrapedAt       string            `json:"scrapedAt"`
	URL             string            `json:"url"`
}

// ModelRegistryService handles fetching and caching remote models
type ModelRegistryService struct {
	db          *sql.DB
	ollamaClient *api.Client
	httpClient  *http.Client
	mu          sync.RWMutex
}

// NewModelRegistryService creates a new model registry service
func NewModelRegistryService(db *sql.DB, ollamaClient *api.Client) *ModelRegistryService {
	return &ModelRegistryService{
		db:          db,
		ollamaClient: ollamaClient,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// ScrapedModel represents basic model info scraped from ollama.com
type ScrapedModel struct {
	Slug         string
	Name         string
	Description  string
	URL          string
	PullCount    int64
	Tags         []string
	Capabilities []string
	UpdatedAt    string // Relative time like "2 weeks ago" converted to RFC3339
}

// scrapeOllamaLibrary fetches the model list from ollama.com/library
func (s *ModelRegistryService) scrapeOllamaLibrary(ctx context.Context) ([]ScrapedModel, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", "https://ollama.com/library", nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("User-Agent", "OllamaWebUI/1.0")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch library: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status: %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read body: %w", err)
	}

	return parseLibraryHTML(string(body))
}

// parseLibraryHTML extracts model information from the HTML
func parseLibraryHTML(html string) ([]ScrapedModel, error) {
	models := make(map[string]*ScrapedModel)

	// Pattern to find model cards: <a href="/library/modelname" or "/library/namespace/modelname" class="group...">
	// Each card contains description and pull count
	// Note: [^":]+  allows / for community models like "username/modelname"
	cardPattern := regexp.MustCompile(`<a[^>]*href="/library/([^":]+)"[^>]*class="[^"]*group[^"]*"[^>]*>([\s\S]*?)</a>`)
	matches := cardPattern.FindAllStringSubmatch(html, -1)

	for _, match := range matches {
		if len(match) < 3 {
			continue
		}
		slug := strings.TrimSpace(match[1])
		if slug == "" {
			continue
		}

		// Skip if we already have this model
		if _, exists := models[slug]; exists {
			continue
		}

		cardContent := match[2]

		// Extract description from <p class="...text-neutral-800...">
		descPattern := regexp.MustCompile(`<p[^>]*class="[^"]*text-neutral-800[^"]*"[^>]*>([^<]+)</p>`)
		desc := ""
		if dm := descPattern.FindStringSubmatch(cardContent); len(dm) > 1 {
			desc = decodeHTMLEntities(strings.TrimSpace(dm[1]))
		}

		// Extract pull count from <span x-test-pull-count>60.3K</span>
		pullPattern := regexp.MustCompile(`<span[^>]*x-test-pull-count[^>]*>([^<]+)</span>`)
		pullCount := int64(0)
		if pm := pullPattern.FindStringSubmatch(cardContent); len(pm) > 1 {
			pullCount = parsePullCount(pm[1])
		}

		// Extract size tags (8b, 70b, etc.)
		sizePattern := regexp.MustCompile(`<span[^>]*x-test-size[^>]*>([^<]+)</span>`)
		sizeMatches := sizePattern.FindAllStringSubmatch(cardContent, -1)
		tags := []string{}
		for _, sm := range sizeMatches {
			if len(sm) > 1 {
				tags = append(tags, strings.TrimSpace(sm[1]))
			}
		}

		// Extract capabilities from <span x-test-capability>vision</span>
		capPattern := regexp.MustCompile(`<span[^>]*x-test-capability[^>]*>([^<]+)</span>`)
		capMatches := capPattern.FindAllStringSubmatch(cardContent, -1)
		capabilities := []string{}
		for _, cm := range capMatches {
			if len(cm) > 1 {
				cap := strings.TrimSpace(strings.ToLower(cm[1]))
				if cap != "" {
					capabilities = append(capabilities, cap)
				}
			}
		}

		// Extract "cloud" capability which uses different styling (bg-cyan-50 text-cyan-500)
		// Pattern: <span class="...bg-cyan-50...text-cyan-500...">cloud</span>
		cloudPattern := regexp.MustCompile(`<span[^>]*class="[^"]*bg-cyan-50[^"]*text-cyan-500[^"]*"[^>]*>cloud</span>`)
		if cloudPattern.MatchString(cardContent) {
			capabilities = append(capabilities, "cloud")
		}

		// Extract updated time from <span x-test-updated>2 weeks ago</span>
		updatedPattern := regexp.MustCompile(`<span[^>]*x-test-updated[^>]*>([^<]+)</span>`)
		updatedAt := ""
		if um := updatedPattern.FindStringSubmatch(cardContent); len(um) > 1 {
			relativeTime := strings.TrimSpace(um[1])
			updatedAt = parseRelativeTime(relativeTime)
		}

		models[slug] = &ScrapedModel{
			Slug:         slug,
			Name:         slug,
			Description:  desc,
			URL:          "https://ollama.com/library/" + slug,
			PullCount:    pullCount,
			Tags:         tags,
			Capabilities: capabilities,
			UpdatedAt:    updatedAt,
		}
	}

	// Convert map to slice
	result := make([]ScrapedModel, 0, len(models))
	for _, m := range models {
		result = append(result, *m)
	}

	return result, nil
}

// stripHTML removes HTML tags from a string
func stripHTML(s string) string {
	re := regexp.MustCompile(`<[^>]*>`)
	return re.ReplaceAllString(s, " ")
}

// decodeHTMLEntities decodes common HTML entities
func decodeHTMLEntities(s string) string {
	replacements := map[string]string{
		"&#39;":  "'",
		"&#34;":  "\"",
		"&quot;": "\"",
		"&amp;":  "&",
		"&lt;":   "<",
		"&gt;":   ">",
		"&nbsp;": " ",
	}
	for entity, char := range replacements {
		s = strings.ReplaceAll(s, entity, char)
	}
	return s
}

// parseRelativeTime converts relative time strings like "2 weeks ago" to RFC3339 timestamps
func parseRelativeTime(s string) string {
	s = strings.ToLower(strings.TrimSpace(s))
	if s == "" {
		return ""
	}

	now := time.Now()

	// Parse patterns like "2 weeks ago", "1 month ago", "3 days ago"
	pattern := regexp.MustCompile(`(\d+)\s*(second|minute|hour|day|week|month|year)s?\s*ago`)
	matches := pattern.FindStringSubmatch(s)
	if len(matches) < 3 {
		return ""
	}

	num, err := strconv.Atoi(matches[1])
	if err != nil {
		return ""
	}

	unit := matches[2]
	var duration time.Duration

	switch unit {
	case "second":
		duration = time.Duration(num) * time.Second
	case "minute":
		duration = time.Duration(num) * time.Minute
	case "hour":
		duration = time.Duration(num) * time.Hour
	case "day":
		duration = time.Duration(num) * 24 * time.Hour
	case "week":
		duration = time.Duration(num) * 7 * 24 * time.Hour
	case "month":
		duration = time.Duration(num) * 30 * 24 * time.Hour
	case "year":
		duration = time.Duration(num) * 365 * 24 * time.Hour
	default:
		return ""
	}

	return now.Add(-duration).Format(time.RFC3339)
}

// extractDescription tries to find the description for a model
func extractDescription(html, slug string) string {
	// Look for text after the model link that looks like a description
	pattern := regexp.MustCompile(`/library/` + regexp.QuoteMeta(slug) + `"[^>]*>([^<]*)</a>\s*([^<]{10,200})`)
	if m := pattern.FindStringSubmatch(html); len(m) > 2 {
		desc := strings.TrimSpace(m[2])
		// Clean up the description
		desc = strings.ReplaceAll(desc, "\n", " ")
		desc = strings.Join(strings.Fields(desc), " ")
		if len(desc) > 200 {
			desc = desc[:197] + "..."
		}
		return desc
	}
	return ""
}

// inferModelType determines if a model is official or community based on slug structure
// Official models have no namespace (e.g., "llama3.1", "mistral")
// Community models have a namespace prefix (e.g., "username/model-name")
func inferModelType(slug string) string {
	if strings.Contains(slug, "/") {
		return "community"
	}
	return "official"
}

// parsePullCount converts "1.2M" or "500K" to an integer
func parsePullCount(s string) int64 {
	s = strings.TrimSpace(s)
	multiplier := int64(1)

	if strings.HasSuffix(s, "K") {
		multiplier = 1000
		s = strings.TrimSuffix(s, "K")
	} else if strings.HasSuffix(s, "M") {
		multiplier = 1000000
		s = strings.TrimSuffix(s, "M")
	} else if strings.HasSuffix(s, "B") {
		multiplier = 1000000000
		s = strings.TrimSuffix(s, "B")
	}

	if f, err := strconv.ParseFloat(s, 64); err == nil {
		return int64(f * float64(multiplier))
	}
	return 0
}

// scrapeModelDetailPage fetches the individual model page and extracts file sizes per tag
// Example: "2.0GB · 128K context window" -> {"8b": 2147483648}
func (s *ModelRegistryService) scrapeModelDetailPage(ctx context.Context, slug string) (map[string]int64, error) {
	url := "https://ollama.com/library/" + slug
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("User-Agent", "OllamaWebUI/1.0")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch model page: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status: %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read body: %w", err)
	}

	return parseModelPageForSizes(string(body))
}

// parseModelPageForSizes extracts file sizes from the model detail page
// The page has rows like: tag name | "2.0GB · 128K context window · Text · 1 year ago"
func parseModelPageForSizes(html string) (map[string]int64, error) {
	sizes := make(map[string]int64)

	// Pattern to find model rows in the table
	// Looking for tag names and their associated sizes
	// The table typically has rows with tag name and size info like "2.0GB"
	rowPattern := regexp.MustCompile(`href="/library/[^"]+:([^"]+)"[^>]*>[\s\S]*?(\d+(?:\.\d+)?)\s*(GB|MB|KB)`)
	matches := rowPattern.FindAllStringSubmatch(html, -1)

	for _, match := range matches {
		if len(match) >= 4 {
			tag := strings.TrimSpace(match[1])
			sizeStr := match[2]
			unit := match[3]

			if size, err := strconv.ParseFloat(sizeStr, 64); err == nil {
				var bytes int64
				switch unit {
				case "GB":
					bytes = int64(size * 1024 * 1024 * 1024)
				case "MB":
					bytes = int64(size * 1024 * 1024)
				case "KB":
					bytes = int64(size * 1024)
				}
				if bytes > 0 {
					sizes[tag] = bytes
				}
			}
		}
	}

	return sizes, nil
}

// parseSizeToBytes converts "2.0GB" to bytes
func parseSizeToBytes(s string) int64 {
	s = strings.TrimSpace(s)
	var multiplier int64 = 1

	if strings.HasSuffix(s, "GB") {
		multiplier = 1024 * 1024 * 1024
		s = strings.TrimSuffix(s, "GB")
	} else if strings.HasSuffix(s, "MB") {
		multiplier = 1024 * 1024
		s = strings.TrimSuffix(s, "MB")
	} else if strings.HasSuffix(s, "KB") {
		multiplier = 1024
		s = strings.TrimSuffix(s, "KB")
	}

	if f, err := strconv.ParseFloat(strings.TrimSpace(s), 64); err == nil {
		return int64(f * float64(multiplier))
	}
	return 0
}

// FetchAndStoreTagSizes fetches tag sizes for a model from its detail page and stores them
func (s *ModelRegistryService) FetchAndStoreTagSizes(ctx context.Context, slug string) (*RemoteModel, error) {
	sizes, err := s.scrapeModelDetailPage(ctx, slug)
	if err != nil {
		return nil, fmt.Errorf("failed to scrape model page: %w", err)
	}

	// Store in database
	sizesJSON, _ := json.Marshal(sizes)
	_, err = s.db.ExecContext(ctx, `
		UPDATE remote_models SET tag_sizes = ? WHERE slug = ?
	`, string(sizesJSON), slug)
	if err != nil {
		return nil, fmt.Errorf("failed to update tag sizes: %w", err)
	}

	return s.GetModel(ctx, slug)
}

// fetchModelDetails uses ollama show to get detailed model info
func (s *ModelRegistryService) fetchModelDetails(ctx context.Context, slug string) (*api.ShowResponse, error) {
	if s.ollamaClient == nil {
		return nil, fmt.Errorf("ollama client not available")
	}

	resp, err := s.ollamaClient.Show(ctx, &api.ShowRequest{
		Name: slug,
	})
	if err != nil {
		return nil, err
	}

	return resp, nil
}

// SyncModels scrapes ollama.com and updates the database
func (s *ModelRegistryService) SyncModels(ctx context.Context, fetchDetails bool) (int, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	// Scrape the library
	scraped, err := s.scrapeOllamaLibrary(ctx)
	if err != nil {
		return 0, fmt.Errorf("failed to scrape library: %w", err)
	}

	log.Printf("Scraped %d models from ollama.com", len(scraped))

	// Update database
	now := time.Now().UTC().Format(time.RFC3339)
	count := 0

	for _, model := range scraped {
		// Check if context is cancelled
		select {
		case <-ctx.Done():
			return count, ctx.Err()
		default:
		}

		// Upsert model
		tagsJSON, _ := json.Marshal(model.Tags)

		// Use scraped capabilities from ollama.com
		capsJSON, _ := json.Marshal(model.Capabilities)

		// Infer model type (official vs community) based on slug structure
		modelType := inferModelType(model.Slug)

		_, err := s.db.ExecContext(ctx, `
			INSERT INTO remote_models (slug, name, description, model_type, url, pull_count, tags, capabilities, ollama_updated_at, scraped_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			ON CONFLICT(slug) DO UPDATE SET
				description = COALESCE(NULLIF(excluded.description, ''), remote_models.description),
				model_type = excluded.model_type,
				pull_count = excluded.pull_count,
				capabilities = excluded.capabilities,
				ollama_updated_at = COALESCE(excluded.ollama_updated_at, remote_models.ollama_updated_at),
				scraped_at = excluded.scraped_at
		`, model.Slug, model.Name, model.Description, modelType, model.URL, model.PullCount, string(tagsJSON), string(capsJSON), model.UpdatedAt, now)

		if err != nil {
			log.Printf("Failed to upsert model %s: %v", model.Slug, err)
			continue
		}
		count++
	}

	// If fetchDetails is true and we have an Ollama client, update capabilities
	// for installed models using the actual /api/show response (more accurate than scraped data)
	if fetchDetails && s.ollamaClient != nil {
		installedModels, err := s.ollamaClient.List(ctx)
		if err != nil {
			log.Printf("Warning: failed to list installed models for capability sync: %v", err)
		} else {
			log.Printf("Syncing capabilities for %d installed models", len(installedModels.Models))

			for _, installed := range installedModels.Models {
				select {
				case <-ctx.Done():
					return count, ctx.Err()
				default:
				}

				// Extract base model name (e.g., "deepseek-r1" from "deepseek-r1:14b")
				modelName := installed.Model
				baseName := strings.Split(modelName, ":")[0]

				// Fetch real capabilities from Ollama
				details, err := s.fetchModelDetails(ctx, modelName)
				if err != nil {
					log.Printf("Warning: failed to fetch details for %s: %v", modelName, err)
					continue
				}

				// Extract capabilities from the actual Ollama response
				capabilities := []string{}
				if details.Capabilities != nil {
					for _, cap := range details.Capabilities {
						capabilities = append(capabilities, string(cap))
					}
				}
				capsJSON, _ := json.Marshal(capabilities)

				// Update capabilities for the base model name
				_, err = s.db.ExecContext(ctx, `
					UPDATE remote_models SET capabilities = ? WHERE slug = ?
				`, string(capsJSON), baseName)
				if err != nil {
					log.Printf("Warning: failed to update capabilities for %s: %v", baseName, err)
				} else {
					log.Printf("Updated capabilities for %s: %v", baseName, capabilities)
				}
			}
		}
	}

	return count, nil
}

// FetchModelDetails fetches detailed info for a specific model and updates the DB
func (s *ModelRegistryService) FetchModelDetails(ctx context.Context, slug string) (*RemoteModel, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	// Get details from Ollama
	details, err := s.fetchModelDetails(ctx, slug)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch details: %w", err)
	}

	now := time.Now().UTC().Format(time.RFC3339)

	// Extract capabilities
	capabilities := []string{}
	if details.Capabilities != nil {
		for _, cap := range details.Capabilities {
			capabilities = append(capabilities, string(cap))
		}
	}
	capsJSON, _ := json.Marshal(capabilities)

	// Extract default params
	paramsJSON := "{}"
	if details.Parameters != "" {
		// Parse the parameters string into a map
		params := parseOllamaParams(details.Parameters)
		if len(params) > 0 {
			if b, err := json.Marshal(params); err == nil {
				paramsJSON = string(b)
			}
		}
	}

	// Get model info
	arch := ""
	paramSize := ""
	ctxLen := int64(0)
	embedLen := int64(0)
	quant := ""

	if details.ModelInfo != nil {
		for k, v := range details.ModelInfo {
			switch {
			case strings.Contains(k, "architecture"):
				if s, ok := v.(string); ok {
					arch = s
				}
			case strings.Contains(k, "parameter"):
				if s, ok := v.(string); ok {
					paramSize = s
				} else if f, ok := v.(float64); ok {
					paramSize = formatParamCount(int64(f))
				}
			case strings.Contains(k, "context"):
				if f, ok := v.(float64); ok {
					ctxLen = int64(f)
				}
			case strings.Contains(k, "embedding"):
				if f, ok := v.(float64); ok {
					embedLen = int64(f)
				}
			}
		}
	}

	// Get quantization from details
	if details.Details.QuantizationLevel != "" {
		quant = details.Details.QuantizationLevel
	}
	if paramSize == "" && details.Details.ParameterSize != "" {
		paramSize = details.Details.ParameterSize
	}

	// Update database
	_, err = s.db.ExecContext(ctx, `
		UPDATE remote_models SET
			architecture = ?,
			parameter_size = ?,
			context_length = ?,
			embedding_length = ?,
			quantization = ?,
			capabilities = ?,
			default_params = ?,
			license = ?,
			details_fetched_at = ?
		WHERE slug = ?
	`, arch, paramSize, ctxLen, embedLen, quant, string(capsJSON), paramsJSON, details.License, now, slug)

	if err != nil {
		return nil, fmt.Errorf("failed to update model details: %w", err)
	}

	// Return the updated model
	return s.GetModel(ctx, slug)
}

// parseOllamaParams parses the parameters string from ollama show
func parseOllamaParams(params string) map[string]any {
	result := make(map[string]any)
	lines := strings.Split(params, "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		parts := strings.Fields(line)
		if len(parts) >= 2 {
			key := parts[0]
			val := strings.Join(parts[1:], " ")
			// Try to parse as number
			if f, err := strconv.ParseFloat(val, 64); err == nil {
				result[key] = f
			} else {
				result[key] = val
			}
		}
	}
	return result
}

// formatParamCount formats a parameter count like "13900000000" to "13.9B"
func formatParamCount(n int64) string {
	if n >= 1000000000 {
		return fmt.Sprintf("%.1fB", float64(n)/1000000000)
	}
	if n >= 1000000 {
		return fmt.Sprintf("%.1fM", float64(n)/1000000)
	}
	if n >= 1000 {
		return fmt.Sprintf("%.1fK", float64(n)/1000)
	}
	return fmt.Sprintf("%d", n)
}

// parseParamSizeToFloat extracts numeric value from parameter size strings like "8b", "70b", "1.5b"
// Returns value in billions (e.g., "8b" -> 8.0, "70b" -> 70.0, "500m" -> 0.5)
func parseParamSizeToFloat(s string) float64 {
	s = strings.ToLower(strings.TrimSpace(s))
	if s == "" {
		return 0
	}

	// Handle suffix
	multiplier := 1.0
	if strings.HasSuffix(s, "b") {
		s = strings.TrimSuffix(s, "b")
	} else if strings.HasSuffix(s, "m") {
		s = strings.TrimSuffix(s, "m")
		multiplier = 0.001 // Convert millions to billions
	}

	if f, err := strconv.ParseFloat(s, 64); err == nil {
		return f * multiplier
	}
	return 0
}

// getSizeRange returns the size range category for a given parameter size
// small: ≤3B, medium: 4-13B, large: 14-70B, xlarge: >70B
func getSizeRange(paramSize string) string {
	size := parseParamSizeToFloat(paramSize)
	if size <= 0 {
		return ""
	}
	if size <= 3 {
		return "small"
	}
	if size <= 13 {
		return "medium"
	}
	if size <= 70 {
		return "large"
	}
	return "xlarge"
}

// modelMatchesSizeRanges checks if any of the model's tags fall within the requested size ranges
// A model matches if at least one of its tags is in any of the requested ranges
func modelMatchesSizeRanges(tags []string, sizeRanges []string) bool {
	if len(tags) == 0 || len(sizeRanges) == 0 {
		return false
	}
	for _, tag := range tags {
		tagRange := getSizeRange(tag)
		if tagRange == "" {
			continue
		}
		for _, sr := range sizeRanges {
			if sr == tagRange {
				return true
			}
		}
	}
	return false
}

// getContextRange returns the context range category for a given context length
// standard: ≤8K, extended: 8K-32K, large: 32K-128K, unlimited: >128K
func getContextRange(ctxLen int64) string {
	if ctxLen <= 0 {
		return ""
	}
	if ctxLen <= 8192 {
		return "standard"
	}
	if ctxLen <= 32768 {
		return "extended"
	}
	if ctxLen <= 131072 {
		return "large"
	}
	return "unlimited"
}

// extractFamily extracts the model family from slug (e.g., "llama3.2" -> "llama", "qwen2.5" -> "qwen")
func extractFamily(slug string) string {
	// Remove namespace prefix for community models
	if idx := strings.LastIndex(slug, "/"); idx != -1 {
		slug = slug[idx+1:]
	}
	// Extract letters before any digits
	family := ""
	for _, r := range slug {
		if r >= '0' && r <= '9' {
			break
		}
		if r == '-' || r == '_' || r == '.' {
			break
		}
		family += string(r)
	}
	return strings.ToLower(family)
}

// GetModel retrieves a single model from the database
func (s *ModelRegistryService) GetModel(ctx context.Context, slug string) (*RemoteModel, error) {
	row := s.db.QueryRowContext(ctx, `
		SELECT slug, name, description, model_type, architecture, parameter_size,
			context_length, embedding_length, quantization, capabilities, default_params,
			license, pull_count, tags, tag_sizes, ollama_updated_at, details_fetched_at, scraped_at, url
		FROM remote_models WHERE slug = ?
	`, slug)

	return scanRemoteModel(row)
}

// ModelSearchParams holds all search/filter parameters
type ModelSearchParams struct {
	Query         string
	ModelType     string
	Capabilities  []string
	SizeRanges    []string // small, medium, large, xlarge
	ContextRanges []string // standard, extended, large, unlimited
	Family        string
	SortBy        string
	Limit         int
	Offset        int
}

// SearchModels searches for models in the database
func (s *ModelRegistryService) SearchModels(ctx context.Context, query string, modelType string, capabilities []string, sortBy string, limit, offset int) ([]RemoteModel, int, error) {
	return s.SearchModelsAdvanced(ctx, ModelSearchParams{
		Query:        query,
		ModelType:    modelType,
		Capabilities: capabilities,
		SortBy:       sortBy,
		Limit:        limit,
		Offset:       offset,
	})
}

// SearchModelsAdvanced searches for models with all filter options
func (s *ModelRegistryService) SearchModelsAdvanced(ctx context.Context, params ModelSearchParams) ([]RemoteModel, int, error) {
	// Build query
	baseQuery := `FROM remote_models WHERE 1=1`
	args := []any{}

	if params.Query != "" {
		baseQuery += ` AND (slug LIKE ? OR name LIKE ? OR description LIKE ?)`
		q := "%" + params.Query + "%"
		args = append(args, q, q, q)
	}

	if params.ModelType != "" {
		baseQuery += ` AND model_type = ?`
		args = append(args, params.ModelType)
	}

	// Filter by capabilities (JSON array contains)
	for _, cap := range params.Capabilities {
		// Use JSON contains for SQLite - capabilities column stores JSON array like ["vision","code"]
		baseQuery += ` AND capabilities LIKE ?`
		args = append(args, `%"`+cap+`"%`)
	}

	// Filter by family (extracted from slug)
	if params.Family != "" {
		// Match slugs that start with the family name
		baseQuery += ` AND (slug LIKE ? OR slug LIKE ?)`
		args = append(args, params.Family+"%", "%/"+params.Family+"%")
	}

	// Build ORDER BY clause based on sort parameter
	orderBy := "pull_count DESC" // default: most popular
	switch params.SortBy {
	case "name_asc":
		orderBy = "name ASC"
	case "name_desc":
		orderBy = "name DESC"
	case "pulls_asc":
		orderBy = "pull_count ASC"
	case "pulls_desc":
		orderBy = "pull_count DESC"
	case "updated_desc":
		orderBy = "ollama_updated_at DESC NULLS LAST, scraped_at DESC"
	}

	// For size/context filtering, we need to fetch all matching models first
	// then filter and paginate in memory (these filters require computed values)
	needsPostFilter := len(params.SizeRanges) > 0 || len(params.ContextRanges) > 0

	var selectQuery string
	if needsPostFilter {
		// Fetch all (no limit/offset) for post-filtering
		selectQuery = `SELECT slug, name, description, model_type, architecture, parameter_size,
			context_length, embedding_length, quantization, capabilities, default_params,
			license, pull_count, tags, tag_sizes, ollama_updated_at, details_fetched_at, scraped_at, url ` +
			baseQuery + ` ORDER BY ` + orderBy
	} else {
		// Direct pagination
		selectQuery = `SELECT slug, name, description, model_type, architecture, parameter_size,
			context_length, embedding_length, quantization, capabilities, default_params,
			license, pull_count, tags, tag_sizes, ollama_updated_at, details_fetched_at, scraped_at, url ` +
			baseQuery + ` ORDER BY ` + orderBy + ` LIMIT ? OFFSET ?`
		args = append(args, params.Limit, params.Offset)
	}

	rows, err := s.db.QueryContext(ctx, selectQuery, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	models := []RemoteModel{}
	for rows.Next() {
		m, err := scanRemoteModelRows(rows)
		if err != nil {
			return nil, 0, err
		}

		// Apply size range filter based on tags
		if len(params.SizeRanges) > 0 {
			if !modelMatchesSizeRanges(m.Tags, params.SizeRanges) {
				continue // Skip models without matching size tags
			}
		}

		// Apply context range filter
		if len(params.ContextRanges) > 0 {
			modelCtxRange := getContextRange(m.ContextLength)
			if modelCtxRange == "" {
				continue // Skip models without context info
			}
			found := false
			for _, cr := range params.ContextRanges {
				if cr == modelCtxRange {
					found = true
					break
				}
			}
			if !found {
				continue
			}
		}

		models = append(models, *m)
	}

	if err := rows.Err(); err != nil {
		return nil, 0, err
	}

	// Get total after filtering
	total := len(models)

	// Apply pagination for post-filtered results
	if needsPostFilter {
		if params.Offset >= len(models) {
			models = []RemoteModel{}
		} else {
			end := params.Offset + params.Limit
			if end > len(models) {
				end = len(models)
			}
			models = models[params.Offset:end]
		}
	} else {
		// Get total count from DB for non-post-filtered queries
		countQuery := "SELECT COUNT(*) " + baseQuery
		// Remove the limit/offset args we added
		countArgs := args[:len(args)-2]
		if err := s.db.QueryRowContext(ctx, countQuery, countArgs...).Scan(&total); err != nil {
			return nil, 0, err
		}
	}

	return models, total, nil
}

// GetSyncStatus returns info about when models were last synced
func (s *ModelRegistryService) GetSyncStatus(ctx context.Context) (map[string]any, error) {
	var count int
	var lastSync sql.NullString

	err := s.db.QueryRowContext(ctx, `SELECT COUNT(*), MAX(scraped_at) FROM remote_models`).Scan(&count, &lastSync)
	if err != nil {
		return nil, err
	}

	return map[string]any{
		"modelCount": count,
		"lastSync":   lastSync.String,
	}, nil
}

// scanRemoteModel scans a single row into a RemoteModel
func scanRemoteModel(row *sql.Row) (*RemoteModel, error) {
	var m RemoteModel
	var caps, params, tags, tagSizes string
	var arch, paramSize, quant, license, ollamaUpdated, detailsFetched sql.NullString
	var ctxLen, embedLen sql.NullInt64

	err := row.Scan(
		&m.Slug, &m.Name, &m.Description, &m.ModelType,
		&arch, &paramSize, &ctxLen, &embedLen, &quant,
		&caps, &params, &license, &m.PullCount, &tags, &tagSizes,
		&ollamaUpdated, &detailsFetched, &m.ScrapedAt, &m.URL,
	)
	if err != nil {
		return nil, err
	}

	m.Architecture = arch.String
	m.ParameterSize = paramSize.String
	m.ContextLength = ctxLen.Int64
	m.EmbeddingLength = embedLen.Int64
	m.Quantization = quant.String
	m.License = license.String
	m.OllamaUpdatedAt = ollamaUpdated.String
	m.DetailsFetchedAt = detailsFetched.String

	json.Unmarshal([]byte(caps), &m.Capabilities)
	json.Unmarshal([]byte(params), &m.DefaultParams)
	json.Unmarshal([]byte(tags), &m.Tags)
	json.Unmarshal([]byte(tagSizes), &m.TagSizes)

	if m.Capabilities == nil {
		m.Capabilities = []string{}
	}
	if m.Tags == nil {
		m.Tags = []string{}
	}
	if m.TagSizes == nil {
		m.TagSizes = make(map[string]int64)
	}

	return &m, nil
}

// scanRemoteModelRows scans from rows
func scanRemoteModelRows(rows *sql.Rows) (*RemoteModel, error) {
	var m RemoteModel
	var caps, params, tags, tagSizes string
	var arch, paramSize, quant, license, ollamaUpdated, detailsFetched sql.NullString
	var ctxLen, embedLen sql.NullInt64

	err := rows.Scan(
		&m.Slug, &m.Name, &m.Description, &m.ModelType,
		&arch, &paramSize, &ctxLen, &embedLen, &quant,
		&caps, &params, &license, &m.PullCount, &tags, &tagSizes,
		&ollamaUpdated, &detailsFetched, &m.ScrapedAt, &m.URL,
	)
	if err != nil {
		return nil, err
	}

	m.Architecture = arch.String
	m.ParameterSize = paramSize.String
	m.ContextLength = ctxLen.Int64
	m.EmbeddingLength = embedLen.Int64
	m.Quantization = quant.String
	m.License = license.String
	m.OllamaUpdatedAt = ollamaUpdated.String
	m.DetailsFetchedAt = detailsFetched.String

	json.Unmarshal([]byte(caps), &m.Capabilities)
	json.Unmarshal([]byte(params), &m.DefaultParams)
	json.Unmarshal([]byte(tags), &m.Tags)
	json.Unmarshal([]byte(tagSizes), &m.TagSizes)

	if m.Capabilities == nil {
		m.Capabilities = []string{}
	}
	if m.Tags == nil {
		m.Tags = []string{}
	}
	if m.TagSizes == nil {
		m.TagSizes = make(map[string]int64)
	}

	return &m, nil
}

// === HTTP Handlers ===

// ListRemoteModelsHandler returns a handler for listing/searching remote models
func (s *ModelRegistryService) ListRemoteModelsHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		params := ModelSearchParams{
			Query:     c.Query("search"),
			ModelType: c.Query("type"),
			SortBy:    c.Query("sort"), // name_asc, name_desc, pulls_asc, pulls_desc, updated_desc
			Family:    c.Query("family"),
			Limit:     50,
			Offset:    0,
		}

		if l, err := strconv.Atoi(c.Query("limit")); err == nil && l > 0 && l <= 200 {
			params.Limit = l
		}
		if o, err := strconv.Atoi(c.Query("offset")); err == nil && o >= 0 {
			params.Offset = o
		}

		// Parse capabilities filter (comma-separated)
		if caps := c.Query("capabilities"); caps != "" {
			for _, cap := range strings.Split(caps, ",") {
				cap = strings.TrimSpace(cap)
				if cap != "" {
					params.Capabilities = append(params.Capabilities, cap)
				}
			}
		}

		// Parse size range filter (comma-separated: small,medium,large,xlarge)
		if sizes := c.Query("sizeRange"); sizes != "" {
			for _, sz := range strings.Split(sizes, ",") {
				sz = strings.TrimSpace(strings.ToLower(sz))
				if sz == "small" || sz == "medium" || sz == "large" || sz == "xlarge" {
					params.SizeRanges = append(params.SizeRanges, sz)
				}
			}
		}

		// Parse context range filter (comma-separated: standard,extended,large,unlimited)
		if ctx := c.Query("contextRange"); ctx != "" {
			for _, cr := range strings.Split(ctx, ",") {
				cr = strings.TrimSpace(strings.ToLower(cr))
				if cr == "standard" || cr == "extended" || cr == "large" || cr == "unlimited" {
					params.ContextRanges = append(params.ContextRanges, cr)
				}
			}
		}

		models, total, err := s.SearchModelsAdvanced(c.Request.Context(), params)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"models": models,
			"total":  total,
			"limit":  params.Limit,
			"offset": params.Offset,
		})
	}
}

// GetRemoteModelHandler returns a handler for getting a single model
func (s *ModelRegistryService) GetRemoteModelHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		slug := c.Param("slug")

		model, err := s.GetModel(c.Request.Context(), slug)
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "model not found"})
			return
		}
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, model)
	}
}

// FetchModelDetailsHandler returns a handler for fetching detailed model info
func (s *ModelRegistryService) FetchModelDetailsHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		slug := c.Param("slug")

		model, err := s.FetchModelDetails(c.Request.Context(), slug)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, model)
	}
}

// FetchTagSizesHandler returns a handler for fetching file sizes per tag
func (s *ModelRegistryService) FetchTagSizesHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		slug := c.Param("slug")

		model, err := s.FetchAndStoreTagSizes(c.Request.Context(), slug)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, model)
	}
}

// SyncModelsHandler returns a handler for syncing models from ollama.com
func (s *ModelRegistryService) SyncModelsHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		fetchDetails := c.Query("details") == "true"

		count, err := s.SyncModels(c.Request.Context(), fetchDetails)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"synced": count,
			"message": fmt.Sprintf("Synced %d models from ollama.com", count),
		})
	}
}

// SyncStatusHandler returns a handler for getting sync status
func (s *ModelRegistryService) SyncStatusHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		status, err := s.GetSyncStatus(c.Request.Context())
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, status)
	}
}

// === Local Models Management ===

// LocalModel represents a local model with details and update status
type LocalModel struct {
	Name            string `json:"name"`
	Model           string `json:"model"`
	ModifiedAt      string `json:"modifiedAt"`
	Size            int64  `json:"size"`
	Digest          string `json:"digest"`
	Family          string `json:"family"`
	ParameterSize   string `json:"parameterSize"`
	QuantizationLevel string `json:"quantizationLevel"`
	// Update status (populated by CheckUpdatesHandler)
	HasUpdate       bool   `json:"hasUpdate,omitempty"`
	RemoteUpdatedAt string `json:"remoteUpdatedAt,omitempty"`
}

// LocalModelsResponse is the response for listing local models
type LocalModelsResponse struct {
	Models []LocalModel `json:"models"`
	Total  int          `json:"total"`
	Limit  int          `json:"limit"`
	Offset int          `json:"offset"`
}

// UpdateCheckResponse is the response for update checking
type UpdateCheckResponse struct {
	Updates         []LocalModel `json:"updates"`         // Models with updates available
	TotalLocal      int          `json:"totalLocal"`      // Total local models checked
	UpdatesAvailable int         `json:"updatesAvailable"` // Count of models with updates
}

// ListLocalModelsHandler returns local models with filtering, sorting, and pagination
// Query params:
//   - search: filter by name (case-insensitive substring match)
//   - family: filter by model family
//   - sort: name_asc, name_desc, size_asc, size_desc, modified_asc, modified_desc (default: name_asc)
//   - limit: max results (default 50, max 200)
//   - offset: pagination offset
func (s *ModelRegistryService) ListLocalModelsHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		if s.ollamaClient == nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Ollama client not available"})
			return
		}

		// Parse query params
		search := strings.ToLower(c.Query("search"))
		family := strings.ToLower(c.Query("family"))
		sortBy := c.Query("sort")
		if sortBy == "" {
			sortBy = "name_asc"
		}

		limit := 50
		offset := 0
		if l, err := strconv.Atoi(c.Query("limit")); err == nil && l > 0 && l <= 200 {
			limit = l
		}
		if o, err := strconv.Atoi(c.Query("offset")); err == nil && o >= 0 {
			offset = o
		}

		// Fetch all local models from Ollama
		resp, err := s.ollamaClient.List(c.Request.Context())
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "failed to list models from Ollama: " + err.Error()})
			return
		}

		// Convert to LocalModel and apply filters
		var filtered []LocalModel
		for _, m := range resp.Models {
			lm := LocalModel{
				Name:              m.Name,
				Model:             m.Model,
				ModifiedAt:        m.ModifiedAt.Format(time.RFC3339),
				Size:              m.Size,
				Digest:            m.Digest,
				Family:            m.Details.Family,
				ParameterSize:     m.Details.ParameterSize,
				QuantizationLevel: m.Details.QuantizationLevel,
			}

			// Apply search filter
			if search != "" && !strings.Contains(strings.ToLower(lm.Name), search) {
				continue
			}

			// Apply family filter
			if family != "" && strings.ToLower(lm.Family) != family {
				continue
			}

			filtered = append(filtered, lm)
		}

		// Sort
		switch sortBy {
		case "name_asc":
			sort.Slice(filtered, func(i, j int) bool {
				return strings.ToLower(filtered[i].Name) < strings.ToLower(filtered[j].Name)
			})
		case "name_desc":
			sort.Slice(filtered, func(i, j int) bool {
				return strings.ToLower(filtered[i].Name) > strings.ToLower(filtered[j].Name)
			})
		case "size_asc":
			sort.Slice(filtered, func(i, j int) bool {
				return filtered[i].Size < filtered[j].Size
			})
		case "size_desc":
			sort.Slice(filtered, func(i, j int) bool {
				return filtered[i].Size > filtered[j].Size
			})
		case "modified_asc":
			sort.Slice(filtered, func(i, j int) bool {
				return filtered[i].ModifiedAt < filtered[j].ModifiedAt
			})
		case "modified_desc":
			sort.Slice(filtered, func(i, j int) bool {
				return filtered[i].ModifiedAt > filtered[j].ModifiedAt
			})
		}

		// Paginate
		total := len(filtered)
		if offset >= total {
			filtered = []LocalModel{}
		} else {
			end := offset + limit
			if end > total {
				end = total
			}
			filtered = filtered[offset:end]
		}

		c.JSON(http.StatusOK, LocalModelsResponse{
			Models: filtered,
			Total:  total,
			Limit:  limit,
			Offset: offset,
		})
	}
}

// CheckUpdatesHandler checks for available updates by comparing local models with remote registry
// Returns models that have updates available (remote ollamaUpdatedAt > local modifiedAt)
func (s *ModelRegistryService) CheckUpdatesHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		if s.ollamaClient == nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Ollama client not available"})
			return
		}

		// Fetch local models from Ollama
		localResp, err := s.ollamaClient.List(c.Request.Context())
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "failed to list local models: " + err.Error()})
			return
		}

		if len(localResp.Models) == 0 {
			c.JSON(http.StatusOK, UpdateCheckResponse{
				Updates:          []LocalModel{},
				TotalLocal:       0,
				UpdatesAvailable: 0,
			})
			return
		}

		// Build map of remote models from our cache (already fetched from ollama.com)
		remoteModels, _, err := s.SearchModels(c.Request.Context(), "", "", nil, "", 1000, 0)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to query remote models: " + err.Error()})
			return
		}

		remoteMap := make(map[string]*RemoteModel)
		for i := range remoteModels {
			remoteMap[strings.ToLower(remoteModels[i].Slug)] = &remoteModels[i]
		}

		// Compare local vs remote
		var updates []LocalModel
		for _, local := range localResp.Models {
			lm := LocalModel{
				Name:              local.Name,
				Model:             local.Model,
				ModifiedAt:        local.ModifiedAt.Format(time.RFC3339),
				Size:              local.Size,
				Digest:            local.Digest,
				Family:            local.Details.Family,
				ParameterSize:     local.Details.ParameterSize,
				QuantizationLevel: local.Details.QuantizationLevel,
			}

			// Parse model name to get base name (e.g., "llama3.2:8b" -> "llama3.2")
			baseName := local.Name
			if colonIdx := strings.Index(baseName, ":"); colonIdx != -1 {
				baseName = baseName[:colonIdx]
			}

			// Look up in remote cache
			if remote, ok := remoteMap[strings.ToLower(baseName)]; ok && remote.OllamaUpdatedAt != "" {
				remoteTime, err1 := time.Parse(time.RFC3339, remote.OllamaUpdatedAt)
				localTime := local.ModifiedAt

				if err1 == nil && remoteTime.After(localTime) {
					lm.HasUpdate = true
					lm.RemoteUpdatedAt = remote.OllamaUpdatedAt
					updates = append(updates, lm)
				}
			}
		}

		c.JSON(http.StatusOK, UpdateCheckResponse{
			Updates:          updates,
			TotalLocal:       len(localResp.Models),
			UpdatesAvailable: len(updates),
		})
	}
}

// GetLocalFamiliesHandler returns unique model families from local models
// Useful for populating filter dropdowns
func (s *ModelRegistryService) GetLocalFamiliesHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		if s.ollamaClient == nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Ollama client not available"})
			return
		}

		resp, err := s.ollamaClient.List(c.Request.Context())
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "failed to list models: " + err.Error()})
			return
		}

		familySet := make(map[string]bool)
		for _, m := range resp.Models {
			if m.Details.Family != "" {
				familySet[m.Details.Family] = true
			}
		}

		families := make([]string, 0, len(familySet))
		for f := range familySet {
			families = append(families, f)
		}
		sort.Strings(families)

		c.JSON(http.StatusOK, gin.H{"families": families})
	}
}

// GetRemoteFamiliesHandler returns unique model families from remote models
// Useful for populating filter dropdowns
func (s *ModelRegistryService) GetRemoteFamiliesHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		rows, err := s.db.QueryContext(c.Request.Context(), `SELECT DISTINCT slug FROM remote_models`)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()

		familySet := make(map[string]bool)
		for rows.Next() {
			var slug string
			if err := rows.Scan(&slug); err != nil {
				continue
			}
			family := extractFamily(slug)
			if family != "" {
				familySet[family] = true
			}
		}

		families := make([]string, 0, len(familySet))
		for f := range familySet {
			families = append(families, f)
		}
		sort.Strings(families)

		c.JSON(http.StatusOK, gin.H{"families": families})
	}
}
