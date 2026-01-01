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

		models[slug] = &ScrapedModel{
			Slug:         slug,
			Name:         slug,
			Description:  desc,
			URL:          "https://ollama.com/library/" + slug,
			PullCount:    pullCount,
			Tags:         tags,
			Capabilities: capabilities,
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
			INSERT INTO remote_models (slug, name, description, model_type, url, pull_count, tags, capabilities, scraped_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
			ON CONFLICT(slug) DO UPDATE SET
				description = COALESCE(NULLIF(excluded.description, ''), remote_models.description),
				model_type = excluded.model_type,
				pull_count = excluded.pull_count,
				capabilities = excluded.capabilities,
				scraped_at = excluded.scraped_at
		`, model.Slug, model.Name, model.Description, modelType, model.URL, model.PullCount, string(tagsJSON), string(capsJSON), now)

		if err != nil {
			log.Printf("Failed to upsert model %s: %v", model.Slug, err)
			continue
		}
		count++
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

// SearchModels searches for models in the database
func (s *ModelRegistryService) SearchModels(ctx context.Context, query string, modelType string, capabilities []string, limit, offset int) ([]RemoteModel, int, error) {
	// Build query
	baseQuery := `FROM remote_models WHERE 1=1`
	args := []any{}

	if query != "" {
		baseQuery += ` AND (slug LIKE ? OR name LIKE ? OR description LIKE ?)`
		q := "%" + query + "%"
		args = append(args, q, q, q)
	}

	if modelType != "" {
		baseQuery += ` AND model_type = ?`
		args = append(args, modelType)
	}

	// Filter by capabilities (JSON array contains)
	for _, cap := range capabilities {
		// Use JSON contains for SQLite - capabilities column stores JSON array like ["vision","code"]
		baseQuery += ` AND capabilities LIKE ?`
		args = append(args, `%"`+cap+`"%`)
	}

	// Get total count
	var total int
	countQuery := "SELECT COUNT(*) " + baseQuery
	if err := s.db.QueryRowContext(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	// Get models
	selectQuery := `SELECT slug, name, description, model_type, architecture, parameter_size,
		context_length, embedding_length, quantization, capabilities, default_params,
		license, pull_count, tags, tag_sizes, ollama_updated_at, details_fetched_at, scraped_at, url ` +
		baseQuery + ` ORDER BY pull_count DESC LIMIT ? OFFSET ?`
	args = append(args, limit, offset)

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
		models = append(models, *m)
	}

	return models, total, rows.Err()
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
		query := c.Query("search")
		modelType := c.Query("type")
		limit := 50
		offset := 0

		if l, err := strconv.Atoi(c.Query("limit")); err == nil && l > 0 && l <= 200 {
			limit = l
		}
		if o, err := strconv.Atoi(c.Query("offset")); err == nil && o >= 0 {
			offset = o
		}

		// Parse capabilities filter (comma-separated)
		var capabilities []string
		if caps := c.Query("capabilities"); caps != "" {
			for _, cap := range strings.Split(caps, ",") {
				cap = strings.TrimSpace(cap)
				if cap != "" {
					capabilities = append(capabilities, cap)
				}
			}
		}

		models, total, err := s.SearchModels(c.Request.Context(), query, modelType, capabilities, limit, offset)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"models": models,
			"total":  total,
			"limit":  limit,
			"offset": offset,
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
