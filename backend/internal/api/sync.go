package api

import (
	"database/sql"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"ollama-webui-backend/internal/models"
)

// PushChangesRequest represents the request body for pushing changes
type PushChangesRequest struct {
	Chats    []models.Chat    `json:"chats"`
	Messages []models.Message `json:"messages"`
}

// PushChangesHandler returns a handler for pushing changes from client
func PushChangesHandler(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req PushChangesRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
			return
		}

		tx, err := db.Begin()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to start transaction"})
			return
		}
		defer tx.Rollback()

		// Process chats
		for _, chat := range req.Chats {
			// Check if chat exists
			var existingVersion int64
			err := tx.QueryRow("SELECT sync_version FROM chats WHERE id = ?", chat.ID).Scan(&existingVersion)

			if err == sql.ErrNoRows {
				// Insert new chat
				_, err = tx.Exec(`
					INSERT INTO chats (id, title, model, pinned, archived, created_at, updated_at, sync_version)
					VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
					chat.ID, chat.Title, chat.Model, chat.Pinned, chat.Archived,
					chat.CreatedAt, chat.UpdatedAt, chat.SyncVersion,
				)
			} else if err == nil && chat.SyncVersion > existingVersion {
				// Update existing chat if incoming version is higher
				_, err = tx.Exec(`
					UPDATE chats SET title = ?, model = ?, pinned = ?, archived = ?,
					updated_at = ?, sync_version = ?
					WHERE id = ?`,
					chat.Title, chat.Model, chat.Pinned, chat.Archived,
					chat.UpdatedAt, chat.SyncVersion, chat.ID,
				)
			}

			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to sync chat: " + err.Error()})
				return
			}
		}

		// Process messages
		for _, msg := range req.Messages {
			// Check if message exists
			var existingVersion int64
			err := tx.QueryRow("SELECT sync_version FROM messages WHERE id = ?", msg.ID).Scan(&existingVersion)

			if err == sql.ErrNoRows {
				// Insert new message
				_, err = tx.Exec(`
					INSERT INTO messages (id, chat_id, parent_id, role, content, sibling_index, created_at, sync_version)
					VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
					msg.ID, msg.ChatID, msg.ParentID, msg.Role, msg.Content,
					msg.SiblingIndex, msg.CreatedAt, msg.SyncVersion,
				)
			} else if err == nil && msg.SyncVersion > existingVersion {
				// Update existing message if incoming version is higher
				_, err = tx.Exec(`
					UPDATE messages SET content = ?, sibling_index = ?, sync_version = ?
					WHERE id = ?`,
					msg.Content, msg.SiblingIndex, msg.SyncVersion, msg.ID,
				)
			}

			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to sync message: " + err.Error()})
				return
			}
		}

		if err := tx.Commit(); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to commit transaction"})
			return
		}

		// Get current max sync version
		maxVersion, err := models.GetMaxSyncVersion(db)
		if err != nil {
			maxVersion = 0
		}

		c.JSON(http.StatusOK, gin.H{
			"message":      "changes pushed successfully",
			"sync_version": maxVersion,
		})
	}
}

// PullChangesHandler returns a handler for pulling changes from server
func PullChangesHandler(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		sinceVersionStr := c.Query("since_version")
		var sinceVersion int64 = 0

		if sinceVersionStr != "" {
			var err error
			sinceVersion, err = strconv.ParseInt(sinceVersionStr, 10, 64)
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "invalid since_version parameter"})
				return
			}
		}

		// Get changed chats
		chats, err := models.GetChangedChats(db, sinceVersion)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		if chats == nil {
			chats = []models.Chat{}
		}

		// Get current max sync version
		maxVersion, err := models.GetMaxSyncVersion(db)
		if err != nil {
			maxVersion = 0
		}

		c.JSON(http.StatusOK, gin.H{
			"chats":        chats,
			"sync_version": maxVersion,
		})
	}
}
