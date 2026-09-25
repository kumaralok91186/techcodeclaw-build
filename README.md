# 🐾 TechCodeClaw

**techcodeclaw** is an AI-powered coding assistant CLI tool and Telegram bot that lets you ask questions, plan tasks, and have an autonomous agent safely modify your codebase — all with a user approval workflow.

<p align="center">
  <img src="https://img.shields.io/badge/Built%20with-Bun-blue" alt="Bun">
  <img src="https://img.shields.io/badge/Language-TypeScript-informational" alt="TypeScript">
  <img src="https://img.shields.io/badge/AI-OpenRouter-purple" alt="AI">
</p>

---

## ✨ Features

- **🤖 Agent Mode** — Let an AI agent read, create, modify, and delete files in your workspace. All changes are **staged** and require your **approval** before being applied.
- **❓ Ask Mode** — Ask questions about your codebase or any topic. The agent researches using file reading and optional web search, and can save answers to `.md` files.
- **🧭 Plan Mode** — Generate a step-by-step execution plan for a goal, select which steps to run, and execute them with approval.
- **📱 Telegram Bot** — Run the same capabilities from Telegram with `/ask`, `/agent`, and `/plan` commands.
- **🛡️ Safety First** — All mutations are staged until you approve them. Path escaping prevention, exclusion patterns (`.git`, `node_modules`, `.env`, etc.), and user approval workflows ensure full control.

---

## 🚀 Quick Start

### Prerequisites

- [Bun](https://bun.sh) installed
- [Node.js](https://nodejs.org/) (for TypeScript types)
- An [OpenRouter](https://openrouter.ai/) API key

### Setup

```bash
# 1. Clone the repo
git clone <repo-url>
cd techcodeclaw

# 2. Install dependencies
bun install

# 3. Set environment variables
export OPENROUTER_API_KEY="your-openrouter-api-key"
export OPENROUTER_DEFAULT_MODEL="your-model-id"
export TELEGRAM_BOT_TOKEN="your-telegram-bot-token"
export TELEGRAM_OWNER_ID="your-telegram-chat-id"

# 4. Run the CLI
bun run index.ts wakeup
```

---

## 📦 Dependencies

### Production Dependencies

| Package | Version | Description |
|---------|---------|-------------|
| `@clack/core` | ^1.5.1 | Core prompt utilities for CLI interfaces |
| `@clack/prompts` | ^1.8.1 | Beautiful interactive CLI prompts (select, text, confirm, etc.) |
| `@mendable/firecrawl-js` | ^4.41.0 | Web scraping & search engine (used for web tools in Plan/Ask modes) |
| `@openrouter/ai-sdk-provider` | ^3.1.0 | OpenRouter AI provider for the `ai` SDK |
| `ai` | ^7.0.109 | AI SDK core — `ToolLoopAgent`, `stepCountIs`, `generateText`, `tool` |
| `chalk` | ^6.0.0 | Terminal string styling (colors, bold, hex) |
| `commander` | ^15.0.0 | CLI command parsing framework |
| `diff` | ^9.0.0 | Diff generation for showing file changes (unified diffs) |
| `figlet` | ^1.11.4 | ASCII art banner generation for the startup screen |
| `marked` | ^18.0.14 | Markdown parser for rendering AI responses in terminal |
| `marked-terminal` | ^7.3.0 | Terminal-friendly markdown renderer |
| `telegraf` | ^4.16.3 | Telegram Bot framework |
| `@types/node` | ^26.6.2 | TypeScript type definitions for Node.js |

### Dev Dependencies

| Package | Version | Description |
|---------|---------|-------------|
| `@types/bun` | latest | TypeScript type definitions for Bun runtime |

### Peer Dependencies

| Package | Version | Description |
|---------|---------|-------------|
| `typescript` | ^7 | TypeScript compiler |

---

## 🏗️ Project Architecture

```
techcodeclaw/
├── index.ts                        # Entry point (Bun CLI, uses Commander)
├── package.json                    # Dependencies & metadata
├── tsconfig.json                   # TypeScript configuration
├── bun.lock                        # Lockfile
├── modes/
│   ├── cli.ts                      # CLI mode selector (Agent/Ask/Plan)
│   ├── telegram/                   # Telegram bot module
│   │   ├── index.ts                # Bot entry point & launch
│   │   ├── handlers.ts             # Command handlers (/start, /ask, /agent, /plan)
│   │   ├── agent-run.ts            # Ask/Agent/Plan execution for Telegram
│   │   ├── approval_session.ts     # Telegram inline approval flow
│   │   ├── plan-session.ts         # Telegram plan UI session management
│   │   ├── auth.ts                 # Owner verification
│   │   ├── constants.ts            # Bot constants (WELCOME message)
│   │   └── text.ts                 # Text utilities
│   ├── agent/                      # Core Agent Mode system
│   │   ├── orchestrator.ts         # Agent Mode entry point
│   │   ├── tool-executor.ts        # Safe file operation engine
│   │   ├── agent-tools.ts          # Tool definitions for the agent
│   │   ├── types.ts                # Type definitions & default config
│   │   ├── action-tracker.ts       # Action logging & tracking
│   │   ├── approval.ts             # User approval flow (interactive)
│   │   └── diff-view.ts            # Diff formatting for review
│   ├── ask/                        # Ask Mode
│   │   └── orchestrator.ts         # Ask Mode entry point & tools
│   ├── plan/                       # Plan Mode
│   │   ├── orchestrator.ts         # Plan Mode entry point
│   │   ├── planner.ts              # AI-powered plan generation
│   │   ├── selection.ts            # Step selection UI
│   │   ├── types.ts                # Plan type definitions
│   │   └── web-tools.ts            # Web search/crawl/fetch tools
│   └── telegrams/                  # (Legacy, if any)
├── tui/
│   ├── wakeup.ts                   # Startup banner & mode selector
│   └── terminal-md.ts              # Terminal markdown renderer
└── ai/
    ├── index.ts                    # AI module exports
    └── ai.config.ts                # OpenRouter model configuration
```

---

## 🔧 Core Modules Explained

### 1. Agent Mode (`modes/agent/`)

The core system that allows an AI to safely interact with your codebase.

**How it works:**
1. User describes a task via CLI prompt
2. A `ToolLoopAgent` is created with file manipulation tools
3. The agent uses tools (`read_file`, `create_file`, `modify_file`, `delete_file`, etc.) to explore and modify the codebase
4. **All changes are staged** — nothing is written to disk yet
5. The `ActionTracker` logs every operation with type, path, before/after content
6. The user reviews all staged changes in an **approval flow**
7. User can **Approve All**, **Review One-by-One** (with diffs), or **Cancel**
8. Only approved changes are written to the filesystem

**Key Files:**

- **`types.ts`** — Defines `ActionType`, `ActionStatus`, `ActionLog`, `AgentConfig`. Configures exclusions like `node_modules`, `.git`, `.env`, etc.
- **`tool-executor.ts`** — The core engine. All file operations go through here. Implements path safety checks, overlay-based staging (changes are stored in memory, not on disk), and the `applyApprovedFromTracker()` method.
- **`agent-tools.ts`** — Creates the 10 tools available to the agent using the `ai` SDK's `tool()` function.
- **`action-tracker.ts`** — Maintains an immutable log of all actions performed. Tracks pending mutations for the approval flow.
- **`approval.ts`** — Interactive approval prompt using `@clack/prompts`. Groups changes by path, shows diffs, and collects user decisions.
- **`diff-view.ts`** — Generates unified diffs using the `diff` library for visual comparison of before/after.
- **`orchestrator.ts`** — Entry point that wires everything together: config → tracker → executor → agent → approval flow.

**Available Agent Tools:**

| Tool | Description |
|------|-------------|
| `read_file` | Read a text file from the workspace |
| `create_file` | Stage creation of a new file (pending approval) |
| `modify_file` | Stage a full-file replacement (pending approval) |
| `delete_file` | Stage deletion of a file (pending approval) |
| `create_folder` | Stage creation of a directory tree (pending approval) |
| `list_files` | List files and directories under a path |
| `search_files` | Find files matching a glob pattern, optionally filtering by content |
| `analyze_codebase` | Summarize structure: file counts, directories |
| `execute_shell` | Queue a shell command to run after user approval |
| `list_skills` | List SKILL.md files from Cursor/Claude skill directories |
| `read_skill` | Read a SKILL.md file |

---

### 2. Ask Mode (`modes/ask/`)

A read-focused mode where the AI answers questions about your codebase or any topic.

- Uses read-only tools (`read_file`, `list_files`, `search_files`, `analyze_codebase`)
- Optionally adds web search tools via `Firecrawl`
- Can optionally save the answer to a `.md` file (user prompted)
- **Does not modify** existing files

---

### 3. Plan Mode (`modes/plan/`)

Generates a structured plan for achieving a goal.

1. **Research Phase** — AI reads the codebase and optionally searches the web
2. **Plan Generation** — AI outputs 1–15 steps with titles, descriptions, hints, and complexity
3. **Step Selection** — User selects which steps to execute (via multiselect)
4. **Execution** — Each step is executed by a separate agent iteration
5. **Approval** — All changes go through the standard approval flow

**Web Tools** (requires `FIRECRAWL_API_KEY`):
- `web_search` — Search the web
- `web_crawl` — Scrape a URL to markdown
- `fetch_url` — HTTP GET for a URL

---

### 4. Telegram Mode (`modes/telegram/`)

The same capabilities available through a Telegram bot.

**Commands:**
- `/start` — Welcome message with available commands
- `/ask <question>` — Ask a question about the codebase
- `/agent <task>` — Let the agent modify your codebase
- `/plan <goal>` — Generate a step-by-step plan

**Features:**
- Inline buttons for plan step selection (toggle all/none/proceed)
- Inline approval flow (accept/reject with diff preview)
- Owner-only access via `TELEGRAM_OWNER_ID`
- All execution mirrors CLI behavior with `ActionTracker` + `ToolExecutor`

---

## 🎨 CLI Interface

The application starts with a **figlet ASCII banner** and offers two entry points:

```
┌─────────────────────────────────┐
│         techcodeclaw            │
│                                 │
│ Which mode?                     │
│ [CLI]    [Telegram]  [Exit]     │
└─────────────────────────────────┘
```

**CLI Mode** presents a sub-menu:
```
Choose CLI sub-mode:
  [Agent]  — AI agent to modify files
  [Plan]   — Generate and execute a plan
  [Ask]    — Ask questions about codebase
  [Back]   ← Return to mode selector
```

---

## 🔒 Safety & Security

- **Staged Operations**: Nothing touches the filesystem until the user explicitly approves
- **Path Validation**: `resolveSafe()` prevents path traversal attacks (e.g., `../../etc/passwd`)
- **Exclusion Patterns**: `node_modules`, `.git`, `dist`, `build`, `.next`, `*.log`, `.env*` are automatically excluded
- **Configurable Permissions**: `AgentConfig` allows enabling/disabling shell execution, file modification, creation, and folder creation
- **Diff Preview**: Users see exact changes before approving
- **Telegram Owner Lock**: Only the configured owner can interact with the bot

---

## 📝 Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENROUTER_API_KEY` | ✅ Yes | Your OpenRouter API key |
| `OPENROUTER_DEFAULT_MODEL` | ✅ Yes | The AI model to use (e.g., `anthropic/claude-3.5-sonnet`) |
| `TELEGRAM_BOT_TOKEN` | No | Telegram bot token (for Telegram mode) |
| `TELEGRAM_OWNER_ID` | No | Your Telegram chat ID (for owner-only access) |
| `FIRECRAWL_API_KEY` | No | Firecrawl API key (for web search/crawl tools) |
| `SKILLS_DIRS` | No | Semicolon-separated list of additional skill directories |

---

## 🛠️ Running the Project

```bash
# Start the interactive CLI
bun run index.ts wakeup

# Or run directly with Bun
bun index.ts wakeup
```

---

## 📄 License

This project is private and not publicly published.

---

## 🤖 What is OpenClaw?

**OpenClaw** is an open-source AI coding agent framework. TechCodeClaw is inspired by and built as an alternative to OpenClaw-style agent systems. It follows the same principles:

- **Autonomous code exploration** using an LLM with tool-calling capabilities
- **Safe, staged mutations** — no changes are applied without human approval
- **Rich tool ecosystem** — file operations, shell execution, web search
- **Multiple interfaces** — CLI, Telegram, and potentially other channels
- **Configurable and extensible** — tool definitions and approval flows are modular

The project uses the **[Vercel AI SDK](https://sdk.vercel.ai/)** (`ai` package) with **[OpenRouter](https://openrouter.ai/)** as the LLM provider, providing access to models from Anthropic, OpenAI, Google, and others through a unified API.

---

## 🧪 Tech Stack

| Technology | Purpose |
|-----------|---------|
| **Bun** | Runtime & package manager |
| **TypeScript** | Type-safe development |
| **Vercel AI SDK** | AI agent framework with tool calling |
| **OpenRouter** | LLM provider (Claude, GPT, Gemini, etc.) |
| **@clack/prompts** | Interactive CLI prompts |
| **Telegraf** | Telegram bot framework |
| **@mendable/firecrawl-js** | Web search & crawling |
| **diff** | Unified diff generation |
| **marked + marked-terminal** | Terminal markdown rendering |
| **figlet** | ASCII art banners |
| **chalk** | Terminal colors |
| **Commander** | CLI argument parsing |
