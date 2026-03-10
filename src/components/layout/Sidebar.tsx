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
      className="flex flex-col w-60 h-full border-r relative overflow-hidden"
      style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}
    >
      {/* Subtle gradient glow at top */}
      <div
        className="absolute top-0 left-0 right-0 h-32 pointer-events-none opacity-40"
        style={{
          background: "radial-gradient(ellipse at 30% -20%, rgba(108, 92, 231, 0.15) 0%, transparent 70%)",
        }}
      />

      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-7 relative z-10">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{
            background: "linear-gradient(135deg, var(--accent), var(--accent-hover))",
            boxShadow: "0 2px 12px rgba(108, 92, 231, 0.3)",
          }}
        >
          <Sparkles size={18} style={{ color: "white" }} />
        </div>
        <span className="text-lg font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
          ClearDeskAI
        </span>
      </div>

      <nav className="flex-1 px-3 py-1 relative z-10">
        {navItems.map((item) => {
          const active = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className="relative flex items-center gap-3 w-full rounded-xl mb-1 text-sm font-medium transition-all duration-200 hover:translate-x-0.5"
              style={{
                background: active ? "var(--bg-tertiary)" : "transparent",
                color: active ? "var(--text-primary)" : "var(--text-secondary)",
                padding: "0.75rem 1.25rem",
                boxShadow: active ? "0 1px 4px rgba(0, 0, 0, 0.08)" : "none",
              }}
            >
              {active && (
                <div
                  className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full nav-indicator"
                  style={{ background: "var(--accent)" }}
                />
              )}
              <item.icon size={18} style={active ? { color: "var(--accent)" } : {}} />
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="px-3 pb-2 relative z-10">
        <button
          onClick={toggleTheme}
          className="flex items-center gap-3 w-full rounded-xl text-sm font-medium transition-colors hover:translate-x-0.5"
          style={{ color: "var(--text-secondary)", padding: "0.75rem 1.25rem" }}
        >
          {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          {theme === "dark" ? "Light Mode" : "Dark Mode"}
        </button>
      </div>

      <div
        className="px-6 py-5 text-xs border-t relative z-10"
        style={{ color: "var(--text-secondary)", borderColor: "var(--border)" }}
      >
        <span>ClearDeskAI v1.0.0</span>
        <span className="ml-2 opacity-50">Ctrl+/ for shortcuts</span>
      </div>
    </aside>
  );
}
