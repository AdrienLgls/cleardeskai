<div align="center">

# ClearDeskAI

**AI-powered file organizer — 100% local, 100% private.**

Scan, classify, and organize your files with on-device AI. Nothing leaves your computer.

[![Build](https://github.com/AdrienLgls/cleardeskai/actions/workflows/build.yml/badge.svg)](https://github.com/AdrienLgls/cleardeskai/actions)
[![License](https://img.shields.io/badge/license-proprietary-blue.svg)]()

</div>

---

## Features

- **Smart Scan** — Select any folder, AI analyzes filenames, metadata, and content to propose a logical folder structure
- **Preview Before Moving** — See every proposed change before it happens. Approve, reject, or edit individually
- **Smart Rename** — AI suggests descriptive filenames based on content (e.g., `IMG_20260308.jpg` → `vacation-beach-sunset.jpg`)
- **One-Click Undo** — Every operation is fully reversible. Complete history with restore-to-any-point
- **Watch Mode** — Monitor folders continuously. Auto-organize new files as they appear
- **Local AI** — Powered by Ollama + Qwen3 4B. Runs entirely on your machine, no cloud, no data sent anywhere
- **BYOK Cloud AI** — Optionally plug in your own OpenAI or Claude API key for more powerful classification
- **Cross-Platform** — Windows, macOS, and Linux

## Screenshots

> Coming soon — the app is in active development.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Desktop Framework** | [Tauri 2.x](https://tauri.app) (Rust) |
| **Frontend** | React + TypeScript + Vite |
| **Styling** | Tailwind CSS |
| **State** | Zustand |
| **Database** | SQLite (via rusqlite) |
| **AI Engine** | [Ollama](https://ollama.com) + Qwen3 4B |
| **Icons** | Lucide React |

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org) 22+
- [Rust](https://rustup.rs) 1.70+
- [Ollama](https://ollama.com) (for local AI)
- System dependencies for Tauri:
  - **Ubuntu/Debian:** `sudo apt install libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev`
  - **macOS:** Xcode Command Line Tools
  - **Windows:** [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)

### Install & Run

```bash
# Clone
git clone https://github.com/AdrienLgls/cleardeskai.git
cd cleardeskai

# Install frontend dependencies
npm install

# Run in development mode
npm run tauri dev

# Build for production
npm run tauri build
```

### Install AI Model

```bash
# Install Ollama (if not already installed)
curl -fsSL https://ollama.com/install.sh | sh

# Pull the default model
ollama pull qwen3:4b
```

## Project Structure

```
cleardeskai/
├── src/                    # React frontend
│   ├── components/         # UI components
│   │   ├── dashboard/      # Home dashboard
│   │   ├── scan/           # Scan & organize view
│   │   ├── history/        # Operation history
│   │   ├── settings/       # App settings
│   │   ├── onboarding/     # First-launch setup
│   │   ├── watch/          # Watch mode panel
│   │   ├── toast/          # Toast notifications
│   │   └── layout/         # Sidebar, navigation
│   ├── stores/             # Zustand state
│   └── styles/             # Global CSS
├── src-tauri/              # Rust backend
│   ├── src/
│   │   ├── commands/       # Tauri IPC commands
│   │   ├── models/         # Data types
│   │   ├── db/             # SQLite operations
│   │   └── ai/             # Ollama integration
│   └── tauri.conf.json     # Tauri config
├── .github/workflows/      # CI/CD
└── package.json
```

## How It Works

1. **Scan** — ClearDeskAI walks through your selected folder, collecting file metadata and content previews
2. **Classify** — Files are sent to the local AI model (Ollama) for intelligent categorization
3. **Preview** — You see every proposed move/rename with confidence scores before anything happens
4. **Organize** — Approved changes are executed. A full snapshot is saved for undo
5. **Watch** — Optionally monitor folders for new files and auto-organize them

## Pricing

| Tier | Price | Features |
|------|-------|----------|
| **Free** | $0 | 1 folder, 50 files/scan |
| **Pro** | $49 one-time | Unlimited, watch mode, smart rename |
| **Premium** | $79 one-time | Everything + BYOK cloud AI, priority updates |

## Roadmap

- [x] Core scan & organize engine
- [x] Ollama integration with configurable model
- [x] Preview & approve workflow with search/filter
- [x] Undo system with file manager integration
- [x] Watch mode with auto-resume
- [x] Onboarding flow
- [x] System tray with minimize-to-tray
- [x] Dark/light theme
- [x] Keyboard shortcuts (Ctrl+1-4, Ctrl+Z, Ctrl+/)
- [x] Real-time scan progress
- [x] License system (Free/Pro/Premium)
- [x] Error boundary for crash recovery
- [x] CSV export for scan results
- [x] Native drag-and-drop (Tauri API)
- [x] Recent folders for quick re-scan
- [x] Apply progress bar with per-file tracking
- [x] Undo from success screen
- [x] OS-specific onboarding (Windows/macOS/Linux)
- [x] Configurable min file size filter
- [x] Landing page with interactive app preview
- [ ] Near-duplicate detection
- [ ] Semantic search
- [ ] Custom organization rules/templates
- [ ] Cloud drive integration (Google Drive, Dropbox)
- [ ] User preference learning

## Contributing

ClearDeskAI is currently in early development. Contributions welcome — open an issue first to discuss.

## License

Proprietary. See [LICENSE](LICENSE) for details.

---

<div align="center">
Built with Tauri, React, and local AI.
</div>
