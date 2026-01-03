<p align="center">
  <img src="frontend/static/favicon.svg" alt="Vessel" width="120" height="120">
</p>

<h1 align="center">Vessel</h1>

<p align="center">
  <strong>A modern, feature-rich web interface for Ollama</strong>
</p>

<p align="center">
  <a href="#why-vessel">Why Vessel</a> •
  <a href="#features">Features</a> •
  <a href="#screenshots">Screenshots</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#installation">Installation</a> •
  <a href="#roadmap">Roadmap</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/SvelteKit-5.0-FF3E00?style=flat-square&logo=svelte&logoColor=white" alt="SvelteKit 5">
  <img src="https://img.shields.io/badge/Svelte-5.16-FF3E00?style=flat-square&logo=svelte&logoColor=white" alt="Svelte 5">
  <img src="https://img.shields.io/badge/Go-1.24-00ADD8?style=flat-square&logo=go&logoColor=white" alt="Go 1.24">
  <img src="https://img.shields.io/badge/TypeScript-5.7-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/Tailwind-3.4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white" alt="Tailwind CSS">
  <img src="https://img.shields.io/badge/Docker-Ready-2496ED?style=flat-square&logo=docker&logoColor=white" alt="Docker">
</p>

<p align="center">
  <img src="https://img.shields.io/badge/license-GPL--3.0-blue?style=flat-square" alt="License GPL-3.0">
  <img src="https://img.shields.io/badge/PRs-welcome-brightgreen?style=flat-square" alt="PRs Welcome">
</p>

---

## Why Vessel

Vessel and [open-webui](https://github.com/open-webui/open-webui) solve different problems.

**Vessel** is intentionally focused on:

- A clean, local-first UI for **Ollama**
- Minimal configuration
- Low visual and cognitive overhead
- Doing a small set of things well

It exists for users who want a UI that is fast and uncluttered, makes browsing and managing Ollama models simple, and stays out of the way once set up.

**open-webui** aims to be a feature-rich, extensible frontend supporting many runtimes, integrations, and workflows. That flexibility is powerful — but it comes with more complexity in setup, UI, and maintenance.

### In short

- If you want a **universal, highly configurable platform** → open-webui is a great choice
- If you want a **small, focused UI for local Ollama usage** → Vessel is built for that

Vessel deliberately avoids becoming a platform. Its scope is narrow by design.

---

## Features

### Core Chat Experience
- **Real-time streaming** — Watch responses appear token by token
- **Conversation history** — All chats stored locally in IndexedDB
- **Message editing** — Edit any message and regenerate responses with branching
- **Branch navigation** — Explore different response paths from edited messages
- **Markdown rendering** — Full GFM support with tables, lists, and formatting
- **Syntax highlighting** — Beautiful code blocks powered by Shiki with 100+ languages
- **Dark/Light mode** — Seamless theme switching with system preference detection

### System Prompts
- **Prompt library** — Save and organize reusable system prompts
- **Model-specific prompts** — Assign default prompts to specific models
- **Capability-based defaults** — Auto-select prompts based on model capabilities (vision, tools, thinking, code)
- **Quick selection** — Switch prompts mid-conversation with the prompt selector

### Built-in Tools (Function Calling)
Vessel includes five powerful tools that models can invoke automatically:

| Tool | Description |
|------|-------------|
| **Web Search** | Search the internet for current information, news, weather, prices |
| **Fetch URL** | Read and extract content from any webpage |
| **Calculator** | Safe math expression parser with functions (sqrt, sin, cos, log, etc.) |
| **Get Location** | Detect user location via GPS or IP for local queries |
| **Get Time** | Current date/time with timezone support |

### Custom Tools
Create your own tools that models can invoke:
- **JavaScript tools** — Run in-browser with full access to browser APIs
- **Python tools** — Execute on the backend with any Python libraries
- **HTTP tools** — Call external REST APIs (GET/POST)
- **Built-in templates** — Start from 8 pre-built templates
- **Test before saving** — Interactive testing panel validates your tools

See the [Custom Tools Guide](#custom-tools-guide) for detailed documentation.

### Model Management
- **Model browser** — Browse, search, and pull models from Ollama registry
- **Custom models** — Create models with embedded system prompts
- **Edit custom models** — Update system prompts of existing custom models
- **Live status** — See which models are currently loaded in memory
- **Quick switch** — Change models mid-conversation
- **Model metadata** — View parameters, quantization, and capabilities
- **Update detection** — See which models have newer versions available

### Developer Experience
- **Beautiful code generation** — Syntax-highlighted output for any language
- **Copy code blocks** — One-click copy with visual feedback
- **Scroll to bottom** — Smart auto-scroll with manual override
- **Keyboard shortcuts** — Navigate efficiently with hotkeys

---

## Screenshots

<table>
  <tr>
    <td align="center" width="50%">
      <img src="screenshots/hero-dark.png" alt="Chat Interface - Dark Mode">
      <br>
      <em>Clean, modern chat interface</em>
    </td>
    <td align="center" width="50%">
      <img src="screenshots/code-generation.png" alt="Code Generation">
      <br>
      <em>Syntax-highlighted code output</em>
    </td>
  </tr>
  <tr>
    <td align="center" width="50%">
      <img src="screenshots/web-search.png" alt="Web Search Results">
      <br>
      <em>Integrated web search with styled results</em>
    </td>
    <td align="center" width="50%">
      <img src="screenshots/light-mode.png" alt="Light Mode">
      <br>
      <em>Light theme for daytime use</em>
    </td>
  </tr>
  <tr>
    <td align="center" colspan="2">
      <img src="screenshots/model-browser.png" alt="Model Browser" width="50%">
      <br>
      <em>Browse and manage Ollama models</em>
    </td>
  </tr>
</table>

---

## Quick Start

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and Docker Compose
- [Ollama](https://ollama.com/download) installed and running locally

#### Ollama Configuration

Ollama must listen on all interfaces for Docker containers to connect. Configure it by setting `OLLAMA_HOST=0.0.0.0`:

**Option A: Using systemd (Linux, recommended)**
```bash
sudo systemctl edit ollama
```

Add these lines:
```ini
[Service]
Environment="OLLAMA_HOST=0.0.0.0"
```

Then restart:
```bash
sudo systemctl daemon-reload
sudo systemctl restart ollama
```

**Option B: Manual start**
```bash
OLLAMA_HOST=0.0.0.0 ollama serve
```

### One-Line Install

```bash
curl -fsSL https://somegit.dev/vikingowl/vessel/raw/main/install.sh | bash
```

### Or Clone and Run

```bash
git clone https://somegit.dev/vikingowl/vessel.git
cd vessel
./install.sh
```

The installer will:
- Check for Docker, Docker Compose, and Ollama
- Start the frontend and backend services
- Optionally pull a starter model (llama3.2)

Once running, open **http://localhost:7842** in your browser.

---

## Installation

### Option 1: Install Script (Recommended)

The install script handles everything automatically:

```bash
./install.sh              # Install and start
./install.sh --update     # Update to latest version
./install.sh --uninstall  # Remove installation
```

**Requirements:**
- Ollama must be installed and running locally
- Docker and Docker Compose
- Linux or macOS

### Option 2: Docker Compose (Manual)

```bash
# Make sure Ollama is running first
ollama serve

# Start Vessel
docker compose up -d
```

### Option 3: Manual Setup (Development)

#### Prerequisites
- [Node.js](https://nodejs.org/) 20+
- [Go](https://go.dev/) 1.24+
- [Ollama](https://ollama.com/) running locally

#### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on `http://localhost:5173`

#### Backend

```bash
cd backend
go mod tidy
go run cmd/server/main.go -port 9090
```

Backend API runs on `http://localhost:9090`

---

## Configuration

### Environment Variables

#### Frontend
| Variable | Default | Description |
|----------|---------|-------------|
| `OLLAMA_API_URL` | `http://localhost:11434` | Ollama API endpoint |
| `BACKEND_URL` | `http://localhost:9090` | Vessel backend API |

#### Backend
| Variable | Default | Description |
|----------|---------|-------------|
| `OLLAMA_URL` | `http://localhost:11434` | Ollama API endpoint |
| `PORT` | `8080` | Backend server port |
| `GIN_MODE` | `debug` | Gin mode (`debug`, `release`) |

### Docker Compose Override

Create `docker-compose.override.yml` for local customizations:

```yaml
services:
  frontend:
    environment:
      - CUSTOM_VAR=value
    ports:
      - "3000:3000"  # Different port
```

---

## Architecture

```
vessel/
├── frontend/               # SvelteKit 5 application
│   ├── src/
│   │   ├── lib/
│   │   │   ├── components/ # UI components
│   │   │   ├── stores/     # Svelte 5 runes state
│   │   │   ├── tools/      # Built-in tool definitions
│   │   │   ├── storage/    # IndexedDB (Dexie)
│   │   │   └── api/        # API clients
│   │   └── routes/         # SvelteKit routes
│   └── Dockerfile
│
├── backend/                # Go API server
│   ├── cmd/server/         # Entry point
│   └── internal/
│       ├── api/            # HTTP handlers
│       │   ├── fetcher.go  # URL fetching with wget/curl/chromedp
│       │   ├── search.go   # Web search via DuckDuckGo
│       │   └── routes.go   # Route definitions
│       ├── database/       # SQLite storage
│       └── models/         # Data models
│
├── docker-compose.yml      # Production setup
└── docker-compose.dev.yml  # Development with hot reload
```

---

## Tech Stack

### Frontend
- **[SvelteKit 5](https://kit.svelte.dev/)** — Full-stack framework
- **[Svelte 5](https://svelte.dev/)** — Runes-based reactivity
- **[TypeScript](https://www.typescriptlang.org/)** — Type safety
- **[Tailwind CSS](https://tailwindcss.com/)** — Utility-first styling
- **[Skeleton UI](https://skeleton.dev/)** — Component library
- **[Shiki](https://shiki.matsu.io/)** — Syntax highlighting
- **[Dexie](https://dexie.org/)** — IndexedDB wrapper
- **[Marked](https://marked.js.org/)** — Markdown parser
- **[DOMPurify](https://github.com/cure53/DOMPurify)** — XSS sanitization

### Backend
- **[Go 1.24](https://go.dev/)** — Fast, compiled backend
- **[Gin](https://gin-gonic.com/)** — HTTP framework
- **[SQLite](https://sqlite.org/)** — Embedded database
- **[chromedp](https://github.com/chromedp/chromedp)** — Headless browser

---

## Development

### Running Tests

```bash
# Frontend unit tests
cd frontend
npm run test

# With coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

### Type Checking

```bash
cd frontend
npm run check
```

### Development Mode

Use the dev compose file for hot reloading:

```bash
docker compose -f docker-compose.dev.yml up
```

---

## API Reference

### Backend Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/proxy/search` | Web search via DuckDuckGo |
| `POST` | `/api/v1/proxy/fetch` | Fetch URL content |
| `GET` | `/api/v1/location` | Get user location from IP |
| `POST` | `/api/v1/tools/execute` | Execute Python/JS tools |
| `GET` | `/api/v1/models/local` | List local models with filtering |
| `GET` | `/api/v1/models/local/updates` | Check for model updates |
| `GET` | `/api/v1/models/remote` | Browse Ollama model registry |
| `POST` | `/api/v1/models/remote/sync` | Sync registry from ollama.com |
| `POST` | `/api/v1/chats` | Create new chat |
| `GET` | `/api/v1/chats/grouped` | List chats grouped by date |
| `POST` | `/api/v1/sync/push` | Push local changes to backend |
| `GET` | `/api/v1/sync/pull` | Pull changes from backend |

### Ollama API Proxy

All Ollama API endpoints are proxied through `/api/v1/ollama/*`:

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/ollama/api/tags` | List installed models |
| `POST` | `/api/v1/ollama/api/show` | Get model details |
| `POST` | `/api/v1/ollama/api/pull` | Pull a model (streaming) |
| `POST` | `/api/v1/ollama/api/create` | Create custom model (streaming) |
| `DELETE` | `/api/v1/ollama/api/delete` | Delete a model |
| `POST` | `/api/v1/ollama/api/chat` | Chat completion (streaming) |
| `POST` | `/api/v1/ollama/api/embed` | Generate embeddings |

---

## Custom Tools Guide

Vessel allows you to create custom tools that LLMs can invoke during conversations. Tools extend the model's capabilities beyond text generation.

### Creating a Tool

1. Navigate to **Tools** in the sidebar
2. Click **Create Custom Tool**
3. Fill in the tool details:
   - **Name** — Unique identifier (alphanumeric + underscores)
   - **Description** — Explains to the model when to use this tool
   - **Parameters** — Define inputs the model should provide
   - **Implementation** — Choose JavaScript, Python, or HTTP
   - **Code/Endpoint** — Your tool's logic

### Tool Types

#### JavaScript Tools

JavaScript tools run directly in the browser. They have access to browser APIs and execute instantly.

```javascript
// Example: Format a date
// Parameters: { date: string, format: string }

const d = new Date(args.date);
const formats = {
  'short': d.toLocaleDateString(),
  'long': d.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  }),
  'iso': d.toISOString()
};
return formats[args.format] || formats.short;
```

**Key points:**
- Access parameters via the `args` object
- Return any JSON-serializable value
- Use `await` for async operations
- Full access to browser APIs (fetch, localStorage, etc.)

#### Python Tools

Python tools execute on the backend server. They can use any Python libraries installed on the server.

```python
# Example: Calculate statistics
# Parameters: { numbers: array }

import json
import sys
import statistics

# Read args from stdin
args = json.loads(sys.stdin.read())
numbers = args['numbers']

result = {
    'mean': statistics.mean(numbers),
    'median': statistics.median(numbers),
    'stdev': statistics.stdev(numbers) if len(numbers) > 1 else 0
}

# Output JSON result
print(json.dumps(result))
```

**Key points:**
- Read arguments from `stdin` as JSON
- Print JSON result to `stdout`
- 30-second timeout (configurable up to 60s)
- Use any installed Python packages
- Stderr is captured for debugging

#### HTTP Tools

HTTP tools call external REST APIs. Configure the endpoint and Vessel handles the request.

**Configuration:**
- **Endpoint** — Full URL (e.g., `https://api.example.com/data`)
- **Method** — GET or POST
- **Parameters** — Sent as query params (GET) or JSON body (POST)

The tool returns the JSON response from the API.

### Defining Parameters

Parameters tell the model what inputs your tool expects:

| Field | Description |
|-------|-------------|
| **Name** | Parameter identifier (e.g., `query`, `count`) |
| **Type** | `string`, `number`, `integer`, `boolean`, `array`, `object` |
| **Description** | Explains what this parameter is for |
| **Required** | Whether the model must provide this parameter |
| **Enum** | Optional list of allowed values |

### Built-in Templates

Vessel provides 8 starter templates to help you get started:

**JavaScript:**
- API Request — Fetch data from REST APIs
- JSON Transform — Filter and reshape JSON data
- String Utilities — Text manipulation functions
- Date Utilities — Date formatting and timezone conversion

**Python:**
- API Request — HTTP requests with urllib
- Data Analysis — Statistical calculations
- Text Analysis — Word frequency and sentiment
- Hash & Encode — MD5, SHA256, Base64 operations

### Testing Tools

Before saving, use the **Test** panel:

1. Enter sample parameter values
2. Click **Run Test**
3. View the result or error message
4. Iterate until the tool works correctly

### Enabling/Disabling Tools

- **Global toggle** — Enable/disable all tools at once
- **Per-tool toggle** — Enable/disable individual tools
- Disabled tools won't be sent to the model

### Security Considerations

- **JavaScript** runs in the browser with your session's permissions
- **Python** runs on the backend with server permissions
- **HTTP** tools can call any URL — be careful with sensitive endpoints
- Tools are stored locally in your browser (IndexedDB)

### Programmatic Tool Creation

Tools are stored in localStorage. You can manage them programmatically:

```typescript
// Tool definition structure
interface CustomTool {
  id: string;
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, {
      type: 'string' | 'number' | 'boolean' | 'array' | 'object';
      description: string;
      enum?: string[];
    }>;
    required: string[];
  };
  implementation: 'javascript' | 'python' | 'http';
  code?: string;        // For JS/Python
  endpoint?: string;    // For HTTP
  httpMethod?: 'GET' | 'POST';
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
}

// Access via localStorage
const tools = JSON.parse(localStorage.getItem('customTools') || '[]');
```

### Example: Weather Tool

Here's a complete example of a JavaScript tool that fetches weather:

**Name:** `get_weather`

**Description:** Get current weather for a city. Use this when the user asks about weather conditions.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| city | string | Yes | City name (e.g., "London", "New York") |
| units | string | No | Temperature units: "celsius" or "fahrenheit" |

**Code (JavaScript):**
```javascript
const city = encodeURIComponent(args.city);
const units = args.units === 'fahrenheit' ? 'imperial' : 'metric';

const response = await fetch(
  `https://api.openweathermap.org/data/2.5/weather?q=${city}&units=${units}&appid=YOUR_API_KEY`
);

if (!response.ok) {
  throw new Error(`Weather API error: ${response.status}`);
}

const data = await response.json();
return {
  city: data.name,
  temperature: data.main.temp,
  description: data.weather[0].description,
  humidity: data.main.humidity
};
```

---

## Roadmap

Vessel is intentionally focused on being a **clean, local-first UI for Ollama**.
The roadmap prioritizes **usability, clarity, and low friction** over feature breadth.

### Core UX Improvements (Near-term)

These improve the existing experience without expanding scope.

- [x] Improve model browser & search
  - better filtering (size, tags, quantization, capabilities)
  - clearer metadata presentation
  - update detection for installed models
- [x] Custom tools system
  - JavaScript, Python, and HTTP tool creation
  - built-in templates and testing panel
- [x] System prompt management
  - prompt library with model-specific defaults
  - capability-based auto-selection
- [x] Custom model creation
  - embed system prompts into Ollama models
  - edit existing custom models
- [ ] Keyboard-first workflows
  - model switching
  - prompt navigation
- [ ] UX polish & stability
  - error handling
  - loading / offline states
  - small performance improvements

### Local Ecosystem Quality-of-Life (Opt-in)

Still local-first, still focused — but easing onboarding and workflows.

- [ ] Docker-based Ollama support
  *(for systems without native Ollama installs)*
- [ ] Optional voice input/output
  *(accessibility & convenience, not a core requirement)*
- [ ] Presets for common workflows
  *(model + tool combinations, kept simple)*

### Experimental / Explicitly Optional

These are **explorations**, not promises. They are intentionally separated to avoid scope creep.

- [ ] Image generation support
  *(only if it can be cleanly isolated from the core UI)*
- [ ] Hugging Face integration
  *(evaluated carefully to avoid bloating the local-first experience)*

### Non-Goals (By Design)

Vessel intentionally avoids becoming a platform.

- Multi-user / account-based systems
- Cloud sync or hosted services
- Large plugin ecosystems
- "Universal" support for every LLM runtime

If a feature meaningfully compromises simplicity, it likely doesn't belong in core Vessel.

### Philosophy

> Do one thing well.
> Keep the UI out of the way.
> Prefer clarity over configurability.

---

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

> Issues and feature requests are tracked on GitHub:
> https://github.com/VikingOwl91/vessel/issues

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## License

Copyright (C) 2026 VikingOwl

This project is licensed under the GNU General Public License v3.0 - see the [LICENSE](LICENSE) file for details.

---

<p align="center">
  Made with <a href="https://ollama.com">Ollama</a> and <a href="https://svelte.dev">Svelte</a>
</p>
