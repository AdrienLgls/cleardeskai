# Changelog

All notable changes to ClearDeskAI will be documented in this file.

## [1.0.0] — Unreleased

### Features
- **Smart Scan** — AI-powered file classification using Ollama (local LLM)
- **Preview & Approve** — See every proposed change before it happens
- **Smart Rename** — AI suggests descriptive filenames based on content
- **One-Click Undo** — Every operation is fully reversible with complete history
- **Watch Mode** — Monitor folders continuously, auto-organize new files
- **System Tray** — Minimize to tray, keep watch mode running in background
- **Keyboard Shortcuts** — Ctrl+1-4 navigation, Ctrl+Z undo, Ctrl+/ help
- **Category Color Coding** — Distinct colors for each file category
- **Keyboard Navigation** — Arrow keys / j/k to navigate results, Space to toggle
- **CSV Export** — Export scan results for external analysis
- **Native Drag-and-Drop** — Drop folders directly onto the app
- **Recent Folders** — Quick re-scan from dashboard
- **Progress Tracking** — Real-time progress bar during file operations
- **History Search** — Search and filter past operations by status
- **Confidence Threshold** — Auto-reject low-confidence classifications
- **Batch Operations** — Approve/reject entire categories at once
- **Sort Results** — Sort by name, confidence, size, or category
- **Min File Size Filter** — Skip tiny files during scan
- **Dark & Light Theme** — Toggle from sidebar
- **Window State Persistence** — Remembers size and position
- **Error Boundary** — Graceful crash recovery
- **OS-Specific Onboarding** — Tailored install instructions per platform
- **License System** — Free / Pro / Premium tiers
- **Landing Page** — Interactive app preview

### Tech Stack
- Tauri 2.x (Rust backend)
- React 19 + TypeScript + Vite
- Tailwind CSS v4
- Zustand state management
- SQLite (rusqlite, bundled)
- Ollama + configurable model (default qwen3:4b)
