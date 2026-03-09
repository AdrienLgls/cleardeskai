import { useState, useEffect } from "react";
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
  }, [loadHistory]);

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
