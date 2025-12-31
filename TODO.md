# Ollama Web UI - TODO

Status legend: ✅ Complete | ⚠️ Partial | ❌ Missing

---

## Phase 1: Project Foundation & Basic Chat ✅

All core features implemented:
- [x] SvelteKit + Tailwind + Skeleton UI setup
- [x] Layout shell (Sidenav, TopNav)
- [x] Chat with streaming (NDJSON parsing)
- [x] IndexedDB storage (Dexie.js)
- [x] Model selection
- [x] Svelte 5 runes state management
- [x] Chat branching (message tree)

---

## Phase 2: Advanced Chat Features ⚠️

### Implemented
- [x] Branch navigator UI (`< 1/3 >`)
- [x] Message actions (edit, copy, regenerate, delete)
- [x] Vision model support (image upload/paste)
- [x] Code syntax highlighting (Shiki)
- [x] Export as Markdown/JSON

### Missing
- [ ] **Share link** - requires backend endpoint for public share URLs
- [ ] **Inline edit** - currently creates new branch, no inline edit UI

---

## Phase 3: Backend & Sync ⚠️

### Implemented
- [x] Go backend structure (Gin + SQLite)
- [x] SQLite schema (chats, messages, attachments)
- [x] REST API endpoints (CRUD for chats)
- [x] Sync endpoints (`/api/v1/sync/push`, `/api/v1/sync/pull`)
- [x] Frontend sync manager (`sync-manager.svelte.ts`)
- [x] `markForSync()` calls in storage layer
- [x] **Automatic sync trigger** - `syncManager.initialize()` in `+layout.svelte`

### Missing
- [ ] **Conflict resolution UI** - for sync conflicts between devices
- [ ] **Offline indicator** - show when backend unreachable
- [ ] **Messages sync in pull** - `PullChangesHandler` returns chats but not messages

---

## Phase 4: Tool System ✅

### Implemented
- [x] Tool calling support (functiongemma middleware)
- [x] Built-in tools: `get_current_time`, `calculate`, `fetch_url`
- [x] Tool management UI (view, enable/disable)
- [x] URL proxy in backend (CORS bypass)
- [x] **ToolEditor component** - create/edit custom tools with JS/HTTP implementation
- [x] **Custom tool execution** - `executeJavaScriptTool()` and `executeHttpTool()` in executor.ts
- [x] **Tool call display component** - `ToolCallDisplay.svelte` shows tool calls in messages
- [x] **System prompt management**
  - [x] `/prompts` route with full CRUD
  - [x] `promptsState` store with IndexedDB persistence
  - [x] Default prompt selection
  - [x] Active prompt for session
  - [ ] Prompt templates with variables (not implemented)
  - [ ] Per-conversation system prompt override (not implemented)
  - [ ] Quick-switch in TopNav (not implemented)

---

## Phase 5: Memory System ⚠️

### Implemented
- [x] Token estimation (`tokenizer.ts`)
- [x] Model context limits (`model-limits.ts`)
- [x] Context usage bar (`ContextUsageBar.svelte`) - displayed in ChatWindow
- [x] Summarizer utility (`summarizer.ts`)
- [x] Summary banner component (`SummaryBanner.svelte`)
- [x] Knowledge base UI (`/knowledge` route)
- [x] Document chunking (`chunker.ts`)
- [x] Embeddings via Ollama (`embeddings.ts`)
- [x] Vector store with similarity search (`vector-store.ts`)
- [x] **RAG integration in chat** - auto-injects relevant chunks as system message
  - Wired in both `ChatWindow.svelte` and `+page.svelte`
  - Combines with user system prompts when both are active

### Missing
- [ ] **Auto-truncate old messages** - when approaching context limit
- [ ] **Manual "summarize and continue"** - button to trigger summarization
- [ ] **PDF support** - currently only text files (pdf.js integration)
- [ ] **Summary storage** - persist summaries to IndexedDB

---

## Phase 6: Code Execution & Preview ⚠️

### Implemented
- [x] JavaScript executor (browser `Function`)
- [x] Python executor (Pyodide)
- [x] CodeBlock with run button
- [x] HTML preview (`HtmlPreview.svelte`)
- [x] Execution output display

### Missing
- [ ] **WebContainer integration** - full Node.js runtime in browser
  - [ ] `webcontainer.ts` wrapper
  - [ ] npm package installation
  - [ ] Filesystem operations
- [ ] **Terminal component** - xterm.js for output streaming
  - `Terminal.svelte`
- [ ] **FileTree component** - virtual filesystem viewer
  - `FileTree.svelte`
- [ ] **React/JSX preview** - live render with Vite bundling
  - `ReactPreview.svelte`
- [ ] **TypeScript execution** - transpilation before running
- [ ] **Matplotlib inline display** - capture matplotlib figures in Python
- [ ] **Line numbers toggle** in CodeBlock

---

## Phase 7: Polish & UI ✅

### Implemented
- [x] Dark theme (default)
- [x] Keyboard shortcuts (Cmd/Ctrl+K, N, B)
- [x] Loading skeletons
- [x] Error boundaries
- [x] Toast notifications
- [x] **Light/dark theme toggle** - in Settings modal
- [x] **Theme persistence** - saves to localStorage, prevents flash on load

### Missing
- [ ] **Mobile responsive polish** - sidenav drawer, touch gestures
- [ ] **Keyboard shortcuts help** - modal showing all shortcuts (partial in settings)

---

## Future Roadmap (Not Started)

From the original plan, these are stretch goals:

- [ ] Monaco IDE integration - full code editor
- [ ] Multi-file project support - workspace with Vite bundling
- [ ] Collaboration / real-time sync - WebSocket-based
- [ ] Plugin system - custom integrations
- [ ] Voice input/output - speech-to-text, TTS
- [ ] Image generation - if Ollama adds support

---

## Priority Order

### High Priority (Core Functionality) ✅ DONE
1. ~~RAG integration in chat~~ ✅
2. ~~Automatic sync trigger~~ ✅
3. ~~Custom tool creation (ToolEditor)~~ ✅

### Medium Priority (User Experience)
4. ~~System prompt management~~ ✅
5. ~~Light/dark theme toggle~~ ✅
6. WebContainer integration
7. Terminal component

### Lower Priority (Nice to Have)
8. Share link generation
9. PDF document support
10. Conflict resolution UI
11. Monaco editor integration

---

## Quick Wins ✅ DONE

Small tasks that were completed:

- [x] Wire `syncManager.initialize()` in `+layout.svelte`
- [x] Add theme toggle button to settings
- [x] Show context usage bar in ChatWindow
- [x] Add tool call display in message content

Still pending:
- [ ] Add `pdf.js` for PDF uploads in knowledge base
