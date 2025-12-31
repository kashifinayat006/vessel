package api

import (
	"io"
	"net/http"
	"net/url"
	"time"

	"github.com/gin-gonic/gin"
)

// URLFetchRequest represents a request to fetch a URL
type URLFetchRequest struct {
	URL       string `json:"url" binding:"required"`
	MaxLength int    `json:"maxLength"`
}

// URLFetchProxyHandler returns a handler that fetches URLs for the frontend
// This bypasses CORS restrictions for the fetch_url tool
func URLFetchProxyHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		var req URLFetchRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request: " + err.Error()})
			return
		}

		// Validate URL
		parsedURL, err := url.Parse(req.URL)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid URL: " + err.Error()})
			return
		}

		// Only allow HTTP/HTTPS
		if parsedURL.Scheme != "http" && parsedURL.Scheme != "https" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "only HTTP and HTTPS URLs are supported"})
			return
		}

		// Create HTTP client with timeout
		client := &http.Client{
			Timeout: 15 * time.Second,
		}

		// Create request
		httpReq, err := http.NewRequestWithContext(c.Request.Context(), "GET", req.URL, nil)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create request: " + err.Error()})
			return
		}

		// Set user agent
		httpReq.Header.Set("User-Agent", "OllamaWebUI/1.0 (URL Fetch Proxy)")
		httpReq.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")

		// Execute request
		resp, err := client.Do(httpReq)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "failed to fetch URL: " + err.Error()})
			return
		}
		defer resp.Body.Close()

		// Check status
		if resp.StatusCode >= 400 {
			c.JSON(http.StatusBadGateway, gin.H{"error": "HTTP " + resp.Status})
			return
		}

		// Set max length (default 500KB)
		maxLen := req.MaxLength
		if maxLen <= 0 || maxLen > 500000 {
			maxLen = 500000
		}

		// Read response body with limit
		body, err := io.ReadAll(io.LimitReader(resp.Body, int64(maxLen)))
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to read response: " + err.Error()})
			return
		}

		// Return the content
		c.JSON(http.StatusOK, gin.H{
			"content":     string(body),
			"contentType": resp.Header.Get("Content-Type"),
			"url":         resp.Request.URL.String(), // Final URL after redirects
			"status":      resp.StatusCode,
		})
	}
}
