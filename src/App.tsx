import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Sidebar } from "./components/layout/Sidebar";
import { Dashboard } from "./components/dashboard/Dashboard";
import { ScanView } from "./components/scan/ScanView";
import { HistoryView } from "./components/history/HistoryView";
import { SettingsView } from "./components/settings/SettingsView";
import { OnboardingView } from "./components/onboarding/OnboardingView";
import { ToastProvider } from "./components/toast/ToastProvider";
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
  }, [history, markUndone]);

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
          <div key={currentView} className="animate-fade-in">
            {currentView === "dashboard" && <Dashboard onNavigate={setCurrentView} />}
            {currentView === "scan" && <ScanView />}
            {currentView === "history" && <HistoryView />}
            {currentView === "settings" && <SettingsView />}
          </div>
        </main>
      </div>
    </ToastProvider>
  );
}

export default App;
