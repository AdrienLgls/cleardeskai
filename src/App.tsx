import { useState, useEffect } from "react";
import { Sidebar } from "./components/layout/Sidebar";
import { Dashboard } from "./components/dashboard/Dashboard";
import { ScanView } from "./components/scan/ScanView";
import { HistoryView } from "./components/history/HistoryView";
import { SettingsView } from "./components/settings/SettingsView";
import { OnboardingView } from "./components/onboarding/OnboardingView";

type View = "dashboard" | "scan" | "history" | "settings";

function App() {
  const [currentView, setCurrentView] = useState<View>("dashboard");
  const [onboarded, setOnboarded] = useState(() => {
    return localStorage.getItem("cleardeskai_onboarded") === "true";
  });

  function handleOnboardingComplete() {
    localStorage.setItem("cleardeskai_onboarded", "true");
    setOnboarded(true);
    setCurrentView("scan");
  }

  if (!onboarded) {
    return <OnboardingView onComplete={handleOnboardingComplete} />;
  }

  return (
    <div className="flex h-screen w-screen">
      <Sidebar currentView={currentView} onNavigate={setCurrentView} />
      <main className="flex-1 overflow-auto" style={{ background: "var(--bg-primary)" }}>
        {currentView === "dashboard" && <Dashboard onNavigate={setCurrentView} />}
        {currentView === "scan" && <ScanView />}
        {currentView === "history" && <HistoryView />}
        {currentView === "settings" && <SettingsView />}
      </main>
    </div>
  );
}

export default App;
