package models

import (
	"database/sql"
	"fmt"
	"time"

	"github.com/google/uuid"
)

// Chat represents a chat conversation
type Chat struct {
	ID          string    `json:"id"`
	Title       string    `json:"title"`
	Model       string    `json:"model"`
	Pinned      bool      `json:"pinned"`
	Archived    bool      `json:"archived"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
	SyncVersion int64     `json:"sync_version"`
	Messages    []Message `json:"messages,omitempty"`
}

// Message represents a chat message
type Message struct {
	ID           string       `json:"id"`
	ChatID       string       `json:"chat_id"`
	ParentID     *string      `json:"parent_id,omitempty"`
	Role         string       `json:"role"`
	Content      string       `json:"content"`
	SiblingIndex int          `json:"sibling_index"`
	CreatedAt    time.Time    `json:"created_at"`
	SyncVersion  int64        `json:"sync_version"`
	Attachments  []Attachment `json:"attachments,omitempty"`
}

// Attachment represents a file attached to a message
type Attachment struct {
	ID        string `json:"id"`
	MessageID string `json:"message_id"`
	MimeType  string `json:"mime_type"`
	Data      []byte `json:"data,omitempty"`
	Filename  string `json:"filename"`
}

// CreateChat creates a new chat in the database
func CreateChat(db *sql.DB, chat *Chat) error {
	if chat.ID == "" {
		chat.ID = uuid.New().String()
	}
	now := time.Now().UTC()
	chat.CreatedAt = now
	chat.UpdatedAt = now
	chat.SyncVersion = 1

	_, err := db.Exec(`
		INSERT INTO chats (id, title, model, pinned, archived, created_at, updated_at, sync_version)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		chat.ID, chat.Title, chat.Model, chat.Pinned, chat.Archived,
		chat.CreatedAt.Format(time.RFC3339), chat.UpdatedAt.Format(time.RFC3339), chat.SyncVersion,
	)
	if err != nil {
		return fmt.Errorf("failed to create chat: %w", err)
	}
	return nil
}

// GetChat retrieves a chat by ID with its messages
func GetChat(db *sql.DB, id string) (*Chat, error) {
	chat := &Chat{}
	var createdAt, updatedAt string
	var pinned, archived int

	err := db.QueryRow(`
		SELECT id, title, model, pinned, archived, created_at, updated_at, sync_version
		FROM chats WHERE id = ?`, id).Scan(
		&chat.ID, &chat.Title, &chat.Model, &pinned, &archived,
		&createdAt, &updatedAt, &chat.SyncVersion,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get chat: %w", err)
	}

	chat.Pinned = pinned == 1
	chat.Archived = archived == 1
	chat.CreatedAt, _ = time.Parse(time.RFC3339, createdAt)
	chat.UpdatedAt, _ = time.Parse(time.RFC3339, updatedAt)

	// Get messages
	messages, err := GetMessagesByChatID(db, id)
	if err != nil {
		return nil, err
	}
	chat.Messages = messages

	return chat, nil
}

// ListChats retrieves all chats ordered by updated_at
func ListChats(db *sql.DB, includeArchived bool) ([]Chat, error) {
	query := `
		SELECT id, title, model, pinned, archived, created_at, updated_at, sync_version
		FROM chats`
	if !includeArchived {
		query += " WHERE archived = 0"
	}
	query += " ORDER BY pinned DESC, updated_at DESC"

	rows, err := db.Query(query)
	if err != nil {
		return nil, fmt.Errorf("failed to list chats: %w", err)
	}
	defer rows.Close()

	var chats []Chat
	for rows.Next() {
		var chat Chat
		var createdAt, updatedAt string
		var pinned, archived int

		if err := rows.Scan(&chat.ID, &chat.Title, &chat.Model, &pinned, &archived,
			&createdAt, &updatedAt, &chat.SyncVersion); err != nil {
			return nil, fmt.Errorf("failed to scan chat: %w", err)
		}

		chat.Pinned = pinned == 1
		chat.Archived = archived == 1
		chat.CreatedAt, _ = time.Parse(time.RFC3339, createdAt)
		chat.UpdatedAt, _ = time.Parse(time.RFC3339, updatedAt)
		chats = append(chats, chat)
	}

	return chats, nil
}

// UpdateChat updates an existing chat
func UpdateChat(db *sql.DB, chat *Chat) error {
	chat.UpdatedAt = time.Now().UTC()
	chat.SyncVersion++

	result, err := db.Exec(`
		UPDATE chats SET title = ?, model = ?, pinned = ?, archived = ?,
		updated_at = ?, sync_version = ?
		WHERE id = ?`,
		chat.Title, chat.Model, chat.Pinned, chat.Archived,
		chat.UpdatedAt.Format(time.RFC3339), chat.SyncVersion, chat.ID,
	)
	if err != nil {
		return fmt.Errorf("failed to update chat: %w", err)
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		return fmt.Errorf("chat not found")
	}

	return nil
}

// DeleteChat deletes a chat and its associated messages
func DeleteChat(db *sql.DB, id string) error {
	result, err := db.Exec("DELETE FROM chats WHERE id = ?", id)
	if err != nil {
		return fmt.Errorf("failed to delete chat: %w", err)
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		return fmt.Errorf("chat not found")
	}

	return nil
}

// CreateMessage creates a new message in the database
func CreateMessage(db *sql.DB, msg *Message) error {
	if msg.ID == "" {
		msg.ID = uuid.New().String()
	}
	msg.CreatedAt = time.Now().UTC()
	msg.SyncVersion = 1

	_, err := db.Exec(`
		INSERT INTO messages (id, chat_id, parent_id, role, content, sibling_index, created_at, sync_version)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		msg.ID, msg.ChatID, msg.ParentID, msg.Role, msg.Content,
		msg.SiblingIndex, msg.CreatedAt.Format(time.RFC3339), msg.SyncVersion,
	)
	if err != nil {
		return fmt.Errorf("failed to create message: %w", err)
	}

	// Update chat's updated_at timestamp
	db.Exec("UPDATE chats SET updated_at = ?, sync_version = sync_version + 1 WHERE id = ?",
		time.Now().UTC().Format(time.RFC3339), msg.ChatID)

	return nil
}

// GetMessagesByChatID retrieves all messages for a chat
func GetMessagesByChatID(db *sql.DB, chatID string) ([]Message, error) {
	rows, err := db.Query(`
		SELECT id, chat_id, parent_id, role, content, sibling_index, created_at, sync_version
		FROM messages WHERE chat_id = ? ORDER BY created_at ASC`, chatID)
	if err != nil {
		return nil, fmt.Errorf("failed to get messages: %w", err)
	}
	defer rows.Close()

	var messages []Message
	for rows.Next() {
		var msg Message
		var createdAt string
		var parentID sql.NullString

		if err := rows.Scan(&msg.ID, &msg.ChatID, &parentID, &msg.Role,
			&msg.Content, &msg.SiblingIndex, &createdAt, &msg.SyncVersion); err != nil {
			return nil, fmt.Errorf("failed to scan message: %w", err)
		}

		if parentID.Valid {
			msg.ParentID = &parentID.String
		}
		msg.CreatedAt, _ = time.Parse(time.RFC3339, createdAt)
		messages = append(messages, msg)
	}

	return messages, nil
}

// GetChangedChats retrieves chats changed since a given sync version
func GetChangedChats(db *sql.DB, sinceVersion int64) ([]Chat, error) {
	rows, err := db.Query(`
		SELECT id, title, model, pinned, archived, created_at, updated_at, sync_version
		FROM chats WHERE sync_version > ? ORDER BY sync_version ASC`, sinceVersion)
	if err != nil {
		return nil, fmt.Errorf("failed to get changed chats: %w", err)
	}
	defer rows.Close()

	var chats []Chat
	for rows.Next() {
		var chat Chat
		var createdAt, updatedAt string
		var pinned, archived int

		if err := rows.Scan(&chat.ID, &chat.Title, &chat.Model, &pinned, &archived,
			&createdAt, &updatedAt, &chat.SyncVersion); err != nil {
			return nil, fmt.Errorf("failed to scan chat: %w", err)
		}

		chat.Pinned = pinned == 1
		chat.Archived = archived == 1
		chat.CreatedAt, _ = time.Parse(time.RFC3339, createdAt)
		chat.UpdatedAt, _ = time.Parse(time.RFC3339, updatedAt)

		// Get messages for this chat
		messages, err := GetMessagesByChatID(db, chat.ID)
		if err != nil {
			return nil, err
		}
		chat.Messages = messages

		chats = append(chats, chat)
	}

	return chats, nil
}

// DateGroup represents a date-based grouping label
type DateGroup string

const (
	DateGroupToday     DateGroup = "Today"
	DateGroupYesterday DateGroup = "Yesterday"
	DateGroupThisWeek  DateGroup = "This Week"
	DateGroupLastWeek  DateGroup = "Last Week"
	DateGroupThisMonth DateGroup = "This Month"
	DateGroupLastMonth DateGroup = "Last Month"
	DateGroupOlder     DateGroup = "Older"
)

// GroupedChat represents a chat in a grouped list (without messages for efficiency)
type GroupedChat struct {
	ID        string    `json:"id"`
	Title     string    `json:"title"`
	Model     string    `json:"model"`
	Pinned    bool      `json:"pinned"`
	Archived  bool      `json:"archived"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// ChatGroup represents a group of chats with a date label
type ChatGroup struct {
	Group string        `json:"group"`
	Chats []GroupedChat `json:"chats"`
}

// GroupedChatsResponse represents the paginated grouped chats response
type GroupedChatsResponse struct {
	Groups      []ChatGroup `json:"groups"`
	Total       int         `json:"total"`
	TotalPinned int         `json:"totalPinned"`
}

// getDateGroup determines which date group a timestamp belongs to
func getDateGroup(t time.Time, now time.Time) DateGroup {
	startOfToday := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	startOfYesterday := startOfToday.AddDate(0, 0, -1)

	// Calculate start of this week (Monday)
	daysFromMonday := int(now.Weekday()) - 1
	if daysFromMonday < 0 {
		daysFromMonday = 6 // Sunday
	}
	startOfThisWeek := startOfToday.AddDate(0, 0, -daysFromMonday)
	startOfLastWeek := startOfThisWeek.AddDate(0, 0, -7)

	// Start of this month and last month
	startOfThisMonth := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
	startOfLastMonth := startOfThisMonth.AddDate(0, -1, 0)

	if t.After(startOfToday) || t.Equal(startOfToday) {
		return DateGroupToday
	}
	if t.After(startOfYesterday) || t.Equal(startOfYesterday) {
		return DateGroupYesterday
	}
	if t.After(startOfThisWeek) || t.Equal(startOfThisWeek) {
		return DateGroupThisWeek
	}
	if t.After(startOfLastWeek) || t.Equal(startOfLastWeek) {
		return DateGroupLastWeek
	}
	if t.After(startOfThisMonth) || t.Equal(startOfThisMonth) {
		return DateGroupThisMonth
	}
	if t.After(startOfLastMonth) || t.Equal(startOfLastMonth) {
		return DateGroupLastMonth
	}
	return DateGroupOlder
}

// ListChatsGrouped retrieves chats grouped by date with search/filter support
func ListChatsGrouped(db *sql.DB, search string, includeArchived bool, limit, offset int) (*GroupedChatsResponse, error) {
	// Build query with optional search filter
	query := `
		SELECT id, title, model, pinned, archived, created_at, updated_at
		FROM chats
		WHERE 1=1`
	args := []interface{}{}

	if !includeArchived {
		query += " AND archived = 0"
	}

	if search != "" {
		query += " AND title LIKE ?"
		args = append(args, "%"+search+"%")
	}

	// Always sort: pinned first, then by updated_at desc
	query += " ORDER BY pinned DESC, updated_at DESC"

	// Apply pagination if specified
	if limit > 0 {
		query += " LIMIT ?"
		args = append(args, limit)
		if offset > 0 {
			query += " OFFSET ?"
			args = append(args, offset)
		}
	}

	rows, err := db.Query(query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to list grouped chats: %w", err)
	}
	defer rows.Close()

	// Collect all chats first
	var chats []GroupedChat
	now := time.Now()

	for rows.Next() {
		var chat GroupedChat
		var createdAt, updatedAt string
		var pinned, archived int

		if err := rows.Scan(&chat.ID, &chat.Title, &chat.Model, &pinned, &archived,
			&createdAt, &updatedAt); err != nil {
			return nil, fmt.Errorf("failed to scan chat: %w", err)
		}

		chat.Pinned = pinned == 1
		chat.Archived = archived == 1
		chat.CreatedAt, _ = time.Parse(time.RFC3339, createdAt)
		chat.UpdatedAt, _ = time.Parse(time.RFC3339, updatedAt)
		chats = append(chats, chat)
	}

	// Group chats by date
	orderedGroups := []DateGroup{
		DateGroupToday,
		DateGroupYesterday,
		DateGroupThisWeek,
		DateGroupLastWeek,
		DateGroupThisMonth,
		DateGroupLastMonth,
		DateGroupOlder,
	}

	groupMap := make(map[DateGroup][]GroupedChat)
	for _, g := range orderedGroups {
		groupMap[g] = []GroupedChat{}
	}

	totalPinned := 0
	for _, chat := range chats {
		if chat.Pinned {
			totalPinned++
		}
		group := getDateGroup(chat.UpdatedAt, now)
		groupMap[group] = append(groupMap[group], chat)
	}

	// Build result with non-empty groups only
	var groups []ChatGroup
	for _, g := range orderedGroups {
		if len(groupMap[g]) > 0 {
			groups = append(groups, ChatGroup{
				Group: string(g),
				Chats: groupMap[g],
			})
		}
	}

	// Get total count for pagination
	countQuery := "SELECT COUNT(*) FROM chats WHERE 1=1"
	countArgs := []interface{}{}
	if !includeArchived {
		countQuery += " AND archived = 0"
	}
	if search != "" {
		countQuery += " AND title LIKE ?"
		countArgs = append(countArgs, "%"+search+"%")
	}

	var total int
	err = db.QueryRow(countQuery, countArgs...).Scan(&total)
	if err != nil {
		return nil, fmt.Errorf("failed to count chats: %w", err)
	}

	return &GroupedChatsResponse{
		Groups:      groups,
		Total:       total,
		TotalPinned: totalPinned,
	}, nil
}

// GetMaxSyncVersion returns the maximum sync version across all tables
func GetMaxSyncVersion(db *sql.DB) (int64, error) {
	var maxVersion int64
	err := db.QueryRow(`
		SELECT MAX(sync_version) FROM (
			SELECT MAX(sync_version) as sync_version FROM chats
			UNION ALL
			SELECT MAX(sync_version) FROM messages
		)`).Scan(&maxVersion)
	if err != nil {
		return 0, fmt.Errorf("failed to get max sync version: %w", err)
	}
	return maxVersion, nil
}
