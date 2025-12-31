package api

import (
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// IPGeoResponse represents the response from ip-api.com
type IPGeoResponse struct {
	Status      string  `json:"status"`
	Message     string  `json:"message,omitempty"`
	Country     string  `json:"country"`
	CountryCode string  `json:"countryCode"`
	Region      string  `json:"region"`
	RegionName  string  `json:"regionName"`
	City        string  `json:"city"`
	Zip         string  `json:"zip"`
	Lat         float64 `json:"lat"`
	Lon         float64 `json:"lon"`
	Timezone    string  `json:"timezone"`
	ISP         string  `json:"isp"`
	Query       string  `json:"query"` // The IP that was looked up
}

// LocationResponse is what we return to the frontend
type LocationResponse struct {
	Success     bool    `json:"success"`
	City        string  `json:"city,omitempty"`
	Region      string  `json:"region,omitempty"`
	Country     string  `json:"country,omitempty"`
	CountryCode string  `json:"countryCode,omitempty"`
	Latitude    float64 `json:"latitude,omitempty"`
	Longitude   float64 `json:"longitude,omitempty"`
	Timezone    string  `json:"timezone,omitempty"`
	IP          string  `json:"ip,omitempty"`
	Error       string  `json:"error,omitempty"`
	Source      string  `json:"source"` // "ip" to indicate this is IP-based
}

// getClientIP extracts the real client IP, handling proxies
func getClientIP(c *gin.Context) string {
	// Check X-Forwarded-For first (for reverse proxies)
	xff := c.GetHeader("X-Forwarded-For")
	if xff != "" {
		// First IP is the original client
		if i := strings.IndexByte(xff, ','); i >= 0 {
			return strings.TrimSpace(xff[:i])
		}
		return strings.TrimSpace(xff)
	}

	// Check X-Real-IP (nginx style)
	xri := c.GetHeader("X-Real-IP")
	if xri != "" {
		return strings.TrimSpace(xri)
	}

	// Fallback to RemoteAddr
	host, _, err := net.SplitHostPort(c.Request.RemoteAddr)
	if err != nil {
		return c.Request.RemoteAddr
	}
	return host
}

// isPrivateIP checks if an IP is private/localhost
func isPrivateIP(ip string) bool {
	parsed := net.ParseIP(ip)
	if parsed == nil {
		return false
	}

	// Check for localhost
	if parsed.IsLoopback() {
		return true
	}

	// Check for private ranges
	privateRanges := []string{
		"10.0.0.0/8",
		"172.16.0.0/12",
		"192.168.0.0/16",
		"fc00::/7", // IPv6 private
	}

	for _, cidr := range privateRanges {
		_, network, err := net.ParseCIDR(cidr)
		if err != nil {
			continue
		}
		if network.Contains(parsed) {
			return true
		}
	}

	return false
}

// IPGeolocationHandler returns location based on client IP
func IPGeolocationHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		clientIP := getClientIP(c)

		// If running locally, we can't geolocate private IPs
		// ip-api.com will use the server's public IP in this case
		ipToLookup := clientIP
		if isPrivateIP(clientIP) {
			// Let ip-api.com auto-detect from the request
			ipToLookup = ""
		}

		// Build the URL - ip-api.com is free for non-commercial use (45 req/min)
		// Using HTTP because HTTPS requires paid plan
		url := "http://ip-api.com/json/"
		if ipToLookup != "" {
			url += ipToLookup
		}

		// Make the request
		httpClient := &http.Client{Timeout: 10 * time.Second}
		resp, err := httpClient.Get(url)
		if err != nil {
			c.JSON(http.StatusServiceUnavailable, LocationResponse{
				Success: false,
				Error:   "Failed to reach geolocation service",
				Source:  "ip",
			})
			return
		}
		defer resp.Body.Close()

		var geoResp IPGeoResponse
		if err := json.NewDecoder(resp.Body).Decode(&geoResp); err != nil {
			c.JSON(http.StatusInternalServerError, LocationResponse{
				Success: false,
				Error:   "Failed to parse geolocation response",
				Source:  "ip",
			})
			return
		}

		// Check if ip-api returned an error
		if geoResp.Status != "success" {
			c.JSON(http.StatusOK, LocationResponse{
				Success: false,
				Error:   fmt.Sprintf("Geolocation failed: %s", geoResp.Message),
				Source:  "ip",
			})
			return
		}

		c.JSON(http.StatusOK, LocationResponse{
			Success:     true,
			City:        geoResp.City,
			Region:      geoResp.RegionName,
			Country:     geoResp.Country,
			CountryCode: geoResp.CountryCode,
			Latitude:    geoResp.Lat,
			Longitude:   geoResp.Lon,
			Timezone:    geoResp.Timezone,
			IP:          geoResp.Query,
			Source:      "ip",
		})
	}
}
