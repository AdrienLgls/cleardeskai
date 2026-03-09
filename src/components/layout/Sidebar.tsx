import { useState, useEffect } from "react";
import { LayoutDashboard, ScanSearch, History, Settings, Sparkles, Moon, Sun } from "lucide-react";

type View = "dashboard" | "scan" | "history" | "settings";

interface SidebarProps {
  currentView: View;
  onNavigate: (view: View) => void;
}

const navItems: { id: View; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "scan", label: "Scan & Organize", icon: ScanSearch },
  { id: "history", label: "History", icon: History },
  { id: "settings", label: "Settings", icon: Settings },
];

export function Sidebar({ currentView, onNavigate }: SidebarProps) {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem("cleardeskai_theme") || "dark";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("cleardeskai_theme", theme);
  }, [theme]);

  function toggleTheme() {
    setTheme((t) => (t === "dark" ? "light" : "dark"));
  }

  return (
    <aside
      className="flex flex-col w-60 h-full border-r"
      style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}
    >
      <div className="flex items-center gap-2 px-5 py-5">
        <Sparkles size={24} style={{ color: "var(--accent)" }} />
        <span className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
          ClearDeskAI
        </span>
      </div>

      <nav className="flex-1 px-3 py-2">
        {navItems.map((item) => {
          const active = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg mb-1 text-sm font-medium transition-all duration-200 hover:translate-x-0.5"
              style={{
                background: active ? "var(--bg-tertiary)" : "transparent",
                color: active ? "var(--text-primary)" : "var(--text-secondary)",
              }}
            >
              <item.icon size={18} />
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="px-3 pb-2">
        <button
          onClick={toggleTheme}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-colors"
          style={{ color: "var(--text-secondary)" }}
        >
          {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          {theme === "dark" ? "Light Mode" : "Dark Mode"}
        </button>
      </div>

      <div className="px-5 py-4 text-xs" style={{ color: "var(--text-secondary)" }}>
        ClearDeskAI v1.0.0
      </div>
    </aside>
  );
}
