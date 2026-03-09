import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Sidebar } from "./components/layout/Sidebar";
import { Dashboard } from "./components/dashboard/Dashboard";
import { ScanView } from "./components/scan/ScanView";
import { HistoryView } from "./components/history/HistoryView";
import { SettingsView } from "./components/settings/SettingsView";
import { OnboardingView } from "./components/onboarding/OnboardingView";
import { ToastProvider } from "./components/toast/ToastProvider";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { useAppStore } from "./stores/appStore";

type View = "dashboard" | "scan" | "history" | "settings";
const views: View[] = ["dashboard", "scan", "history", "settings"];

interface BackendOperation {
  id: string;
  timestamp: string;
  description: string;
  changes: { source: string; destination: string; newName?: string; changeType: string }[];
  undone: boolean;
}

function App() {
  const [currentView, setCurrentView] = useState<View>("dashboard");
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [onboarded, setOnboarded] = useState(() => {
    return localStorage.getItem("cleardeskai_onboarded") === "true";
  });
  const loadHistory = useAppStore((s) => s.loadHistory);
  const history = useAppStore((s) => s.history);
  const markUndone = useAppStore((s) => s.markUndone);

  useEffect(() => {
    invoke<BackendOperation[]>("get_history")
      .then((ops) => {
        loadHistory(
          ops.map((op) => ({
            ...op,
            changes: op.changes.map((c) => ({
              source: c.source,
              destination: c.destination,
              newName: c.newName,
              changeType: c.changeType as "move" | "rename" | "move_and_rename",
            })),
          }))
        );
      })
      .catch(() => {});

    // Auto-resume watch mode if enabled
    invoke<boolean>("auto_resume_watch").catch(() => {});
  }, [loadHistory]);

  // Keyboard shortcuts
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Don't trigger shortcuts when typing in inputs
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key === "z") {
      e.preventDefault();
      const lastOp = history.find((op) => !op.undone);
      if (lastOp) {
        invoke("undo_operation", { operationId: lastOp.id })
          .then(() => markUndone(lastOp.id))
          .catch(() => {});
      }
    }
    // Ctrl+1-4 for navigation
    if (mod && e.key >= "1" && e.key <= "4") {
      e.preventDefault();
      setCurrentView(views[parseInt(e.key) - 1]);
    }
    // Ctrl+? or Ctrl+/ for shortcuts overlay
    if (mod && (e.key === "?" || e.key === "/")) {
      e.preventDefault();
      setShowShortcuts((s) => !s);
    }
    // Escape to close shortcuts
    if (e.key === "Escape" && showShortcuts) {
      setShowShortcuts(false);
    }
  }, [history, markUndone, showShortcuts]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  function handleOnboardingComplete() {
    localStorage.setItem("cleardeskai_onboarded", "true");
    setOnboarded(true);
    setCurrentView("scan");
  }

  if (!onboarded) {
    return (
      <ToastProvider>
        <OnboardingView onComplete={handleOnboardingComplete} />
      </ToastProvider>
    );
  }

  return (
    <ToastProvider>
      <div className="flex h-screen w-screen">
        <Sidebar currentView={currentView} onNavigate={setCurrentView} />
        <main className="flex-1 overflow-auto" style={{ background: "var(--bg-primary)" }}>
          <ErrorBoundary>
            <div key={currentView} className="animate-fade-in">
              {currentView === "dashboard" && <Dashboard onNavigate={setCurrentView} />}
              {currentView === "scan" && <ScanView />}
              {currentView === "history" && <HistoryView />}
              {currentView === "settings" && <SettingsView />}
            </div>
          </ErrorBoundary>
        </main>
      </div>
      {showShortcuts && <ShortcutsOverlay onClose={() => setShowShortcuts(false)} />}
    </ToastProvider>
  );
}

const shortcuts = [
  { keys: "Ctrl+1", desc: "Dashboard" },
  { keys: "Ctrl+2", desc: "Scan & Organize" },
  { keys: "Ctrl+3", desc: "History" },
  { keys: "Ctrl+4", desc: "Settings" },
  { keys: "Ctrl+Z", desc: "Undo last operation" },
  { keys: "Ctrl+/", desc: "Toggle this overlay" },
];

function ShortcutsOverlay({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50 modal-backdrop"
      onClick={onClose}
    >
      <div
        className="rounded-xl p-6 border max-w-sm w-full mx-4 modal-content"
        style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold mb-4" style={{ color: "var(--text-primary)" }}>
          Keyboard Shortcuts
        </h3>
        <div className="space-y-3">
          {shortcuts.map((s) => (
            <div key={s.keys} className="flex items-center justify-between">
              <span className="text-sm" style={{ color: "var(--text-secondary)" }}>{s.desc}</span>
              <kbd
                className="text-xs font-mono px-2 py-1 rounded"
                style={{ background: "var(--bg-tertiary)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
              >
                {s.keys}
              </kbd>
            </div>
          ))}
        </div>
        <p className="text-xs mt-4" style={{ color: "var(--text-secondary)" }}>
          Press Esc or click outside to close
        </p>
      </div>
    </div>
  );
}

export default App;
