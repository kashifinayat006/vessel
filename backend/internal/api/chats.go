package api

import (
	"database/sql"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"vessel-backend/internal/models"
)

// ListChatsHandler returns a handler for listing all chats
func ListChatsHandler(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		includeArchived := c.Query("include_archived") == "true"

		chats, err := models.ListChats(db, includeArchived)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		if chats == nil {
			chats = []models.Chat{}
		}

		c.JSON(http.StatusOK, gin.H{"chats": chats})
	}
}

// ListGroupedChatsHandler returns a handler for listing chats grouped by date
// with search, filter, and pagination support
func ListGroupedChatsHandler(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		search := c.Query("search")
		includeArchived := c.Query("include_archived") == "true"

		limit := 0
		if limitStr := c.Query("limit"); limitStr != "" {
			if l, err := strconv.Atoi(limitStr); err == nil && l > 0 {
				limit = l
			}
		}

		offset := 0
		if offsetStr := c.Query("offset"); offsetStr != "" {
			if o, err := strconv.Atoi(offsetStr); err == nil && o >= 0 {
				offset = o
			}
		}

		response, err := models.ListChatsGrouped(db, search, includeArchived, limit, offset)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, response)
	}
}

// GetChatHandler returns a handler for getting a single chat
func GetChatHandler(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")

		chat, err := models.GetChat(db, id)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		if chat == nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "chat not found"})
			return
		}

		c.JSON(http.StatusOK, chat)
	}
}

// CreateChatRequest represents the request body for creating a chat
type CreateChatRequest struct {
	Title string `json:"title"`
	Model string `json:"model"`
}

// CreateChatHandler returns a handler for creating a new chat
func CreateChatHandler(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req CreateChatRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
			return
		}

		chat := &models.Chat{
			Title: req.Title,
			Model: req.Model,
		}

		if chat.Title == "" {
			chat.Title = "New Chat"
		}

		if err := models.CreateChat(db, chat); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusCreated, chat)
	}
}

// UpdateChatRequest represents the request body for updating a chat
type UpdateChatRequest struct {
	Title    *string `json:"title,omitempty"`
	Model    *string `json:"model,omitempty"`
	Pinned   *bool   `json:"pinned,omitempty"`
	Archived *bool   `json:"archived,omitempty"`
}

// UpdateChatHandler returns a handler for updating a chat
func UpdateChatHandler(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")

		// Get existing chat
		chat, err := models.GetChat(db, id)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if chat == nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "chat not found"})
			return
		}

		// Parse update request
		var req UpdateChatRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
			return
		}

		// Apply updates
		if req.Title != nil {
			chat.Title = *req.Title
		}
		if req.Model != nil {
			chat.Model = *req.Model
		}
		if req.Pinned != nil {
			chat.Pinned = *req.Pinned
		}
		if req.Archived != nil {
			chat.Archived = *req.Archived
		}

		if err := models.UpdateChat(db, chat); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, chat)
	}
}

// DeleteChatHandler returns a handler for deleting a chat
func DeleteChatHandler(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")

		if err := models.DeleteChat(db, id); err != nil {
			if err.Error() == "chat not found" {
				c.JSON(http.StatusNotFound, gin.H{"error": "chat not found"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "chat deleted"})
	}
}

// CreateMessageRequest represents the request body for creating a message
type CreateMessageRequest struct {
	ParentID     *string `json:"parent_id,omitempty"`
	Role         string  `json:"role" binding:"required"`
	Content      string  `json:"content" binding:"required"`
	SiblingIndex int     `json:"sibling_index"`
}

// CreateMessageHandler returns a handler for creating a new message
func CreateMessageHandler(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		chatID := c.Param("id")

		// Verify chat exists
		chat, err := models.GetChat(db, chatID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if chat == nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "chat not found"})
			return
		}

		var req CreateMessageRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
			return
		}

		// Validate role
		if req.Role != "user" && req.Role != "assistant" && req.Role != "system" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "role must be 'user', 'assistant', or 'system'"})
			return
		}

		msg := &models.Message{
			ChatID:       chatID,
			ParentID:     req.ParentID,
			Role:         req.Role,
			Content:      req.Content,
			SiblingIndex: req.SiblingIndex,
		}

		if err := models.CreateMessage(db, msg); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusCreated, msg)
	}
}
