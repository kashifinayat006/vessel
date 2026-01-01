package database

import (
	"database/sql"
	"fmt"
)

const migrationsSQL = `
-- Chats table
CREATE TABLE IF NOT EXISTS chats (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL DEFAULT 'New Chat',
    model TEXT NOT NULL DEFAULT '',
    pinned INTEGER NOT NULL DEFAULT 0,
    archived INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    sync_version INTEGER NOT NULL DEFAULT 1
);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    chat_id TEXT NOT NULL,
    parent_id TEXT,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    sibling_index INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    sync_version INTEGER NOT NULL DEFAULT 1,
    FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_id) REFERENCES messages(id) ON DELETE SET NULL
);

-- Attachments table
CREATE TABLE IF NOT EXISTS attachments (
    id TEXT PRIMARY KEY,
    message_id TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    data BLOB NOT NULL,
    filename TEXT NOT NULL DEFAULT '',
    FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_messages_parent_id ON messages(parent_id);
CREATE INDEX IF NOT EXISTS idx_attachments_message_id ON attachments(message_id);
CREATE INDEX IF NOT EXISTS idx_chats_updated_at ON chats(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_chats_sync_version ON chats(sync_version);
CREATE INDEX IF NOT EXISTS idx_messages_sync_version ON messages(sync_version);

-- Remote models registry (cached from ollama.com)
CREATE TABLE IF NOT EXISTS remote_models (
    slug TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    model_type TEXT NOT NULL DEFAULT 'community' CHECK (model_type IN ('official', 'community')),

    -- Model architecture details (from ollama show)
    architecture TEXT,
    parameter_size TEXT,
    context_length INTEGER,
    embedding_length INTEGER,
    quantization TEXT,

    -- Capabilities (stored as JSON array)
    capabilities TEXT NOT NULL DEFAULT '[]',

    -- Default parameters (stored as JSON object)
    default_params TEXT NOT NULL DEFAULT '{}',

    -- License info
    license TEXT,

    -- Popularity metrics
    pull_count INTEGER NOT NULL DEFAULT 0,

    -- Available tags/variants (stored as JSON array)
    tags TEXT NOT NULL DEFAULT '[]',

    -- Timestamps
    ollama_updated_at TEXT,
    details_fetched_at TEXT,
    scraped_at TEXT NOT NULL DEFAULT (datetime('now')),

    -- URL to model page
    url TEXT NOT NULL
);

-- Indexes for remote models
CREATE INDEX IF NOT EXISTS idx_remote_models_name ON remote_models(name);
CREATE INDEX IF NOT EXISTS idx_remote_models_model_type ON remote_models(model_type);
CREATE INDEX IF NOT EXISTS idx_remote_models_pull_count ON remote_models(pull_count DESC);
CREATE INDEX IF NOT EXISTS idx_remote_models_scraped_at ON remote_models(scraped_at);
`

// Additional migrations for schema updates (run separately to handle existing tables)
const additionalMigrations = `
-- Add tag_sizes column for storing file sizes per tag variant
-- This column stores a JSON object mapping tag names to file sizes in bytes
-- Example: {"8b": 4700000000, "70b": 40000000000}
`

// RunMigrations executes all database migrations
func RunMigrations(db *sql.DB) error {
	_, err := db.Exec(migrationsSQL)
	if err != nil {
		return fmt.Errorf("failed to run migrations: %w", err)
	}

	// Add tag_sizes column if it doesn't exist
	// SQLite doesn't have IF NOT EXISTS for ALTER TABLE, so we check first
	var count int
	err = db.QueryRow(`SELECT COUNT(*) FROM pragma_table_info('remote_models') WHERE name='tag_sizes'`).Scan(&count)
	if err != nil {
		return fmt.Errorf("failed to check tag_sizes column: %w", err)
	}
	if count == 0 {
		_, err = db.Exec(`ALTER TABLE remote_models ADD COLUMN tag_sizes TEXT NOT NULL DEFAULT '{}'`)
		if err != nil {
			return fmt.Errorf("failed to add tag_sizes column: %w", err)
		}
	}

	return nil
}
