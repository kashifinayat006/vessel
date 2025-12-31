package api

import (
	"io"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

// OllamaProxyHandler returns a handler that proxies requests to Ollama
func OllamaProxyHandler(ollamaURL string) gin.HandlerFunc {
	return func(c *gin.Context) {
		path := c.Param("path")
		targetURL := strings.TrimSuffix(ollamaURL, "/") + path

		// Create proxy request
		req, err := http.NewRequestWithContext(c.Request.Context(), c.Request.Method, targetURL, c.Request.Body)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create proxy request"})
			return
		}

		// Copy headers
		for key, values := range c.Request.Header {
			for _, value := range values {
				req.Header.Add(key, value)
			}
		}

		// Execute request
		client := &http.Client{}
		resp, err := client.Do(req)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "failed to reach Ollama: " + err.Error()})
			return
		}
		defer resp.Body.Close()

		// Copy response headers
		for key, values := range resp.Header {
			for _, value := range values {
				c.Header(key, value)
			}
		}

		// Stream response body
		c.Status(resp.StatusCode)
		io.Copy(c.Writer, resp.Body)
	}
}
