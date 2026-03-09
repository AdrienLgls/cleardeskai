import { useState, useEffect, useRef } from "react";
import { FolderOpen, ScanSearch, Clock, Sparkles, Settings, FileText, RotateCcw, Bot, Eye, Zap } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { useAppStore } from "../../stores/appStore";

type View = "dashboard" | "scan" | "history" | "settings";

interface DashboardProps {
  onNavigate: (view: View) => void;
}

export function Dashboard({ onNavigate }: DashboardProps) {
  const { stats, history, ollamaStatus, setOllamaStatus } = useAppStore();
  const [watchRunning, setWatchRunning] = useState(false);
  const [watchFolderCount, setWatchFolderCount] = useState(0);
  const [recentFolders, setRecentFolders] = useState<[string, string, number][]>([]);

  const recentOps = history.slice(0, 5);

  useEffect(() => {
    invoke<{ status: string }>("check_ollama_status").then((s) => {
      setOllamaStatus(s.status as "running" | "not_installed" | "no_model");
    }).catch(() => {});
    invoke<[boolean, string[]]>("get_watch_status").then(([running, folders]) => {
      setWatchRunning(running);
      setWatchFolderCount(folders.length);
    }).catch(() => {});
    invoke<[string, string, number][]>("get_recent_folders").then(setRecentFolders).catch(() => {});
  }, [setOllamaStatus]);

  return (
    <div className="p-8 max-w-full">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>
          Welcome to ClearDeskAI
        </h1>
        <p style={{ color: "var(--text-secondary)" }}>
          Your files, organized by AI — 100% private, 100% local.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8 stagger-in">
        <StatCard
          icon={<FolderOpen size={20} />}
          label="Files Organized"
          value={stats.filesOrganized.toLocaleString()}
        />
        <StatCard
          icon={<Clock size={20} />}
          label="Time Saved"
          value={`${stats.timeSavedMinutes}m`}
        />
        <StatCard
          icon={<Sparkles size={20} />}
          label="Operations"
          value={stats.totalOperations.toString()}
        />
      </div>

      {/* Status Bar */}
      <div className="flex gap-4 mb-8">
        <div
          className="flex items-center gap-3 rounded-xl border flex-1 cursor-pointer hover-lift"
          style={{ background: "var(--bg-secondary)", borderColor: "var(--border)", padding: "1rem 1.25rem" }}
          onClick={() => onNavigate("settings")}
        >
          <Bot size={16} style={{ color: ollamaStatus === "running" ? "var(--success)" : ollamaStatus === "no_model" ? "var(--warning)" : "var(--danger)" }} />
          <span className="text-sm" style={{ color: "var(--text-secondary)" }}>AI Engine</span>
          <span className="text-sm font-medium ml-auto" style={{ color: ollamaStatus === "running" ? "var(--success)" : "var(--danger)" }}>
            {ollamaStatus === "running" ? "Ready" : ollamaStatus === "no_model" ? "No Model" : "Offline"}
          </span>
        </div>
        <div
          className="flex items-center gap-3 rounded-xl border flex-1 cursor-pointer hover-lift"
          style={{ background: "var(--bg-secondary)", borderColor: "var(--border)", padding: "1rem 1.25rem" }}
          onClick={() => onNavigate("settings")}
        >
          <Eye size={16} style={{ color: watchRunning ? "var(--success)" : "var(--text-secondary)" }} />
          <span className="text-sm" style={{ color: "var(--text-secondary)" }}>Watch Mode</span>
          <span className="text-sm font-medium ml-auto" style={{ color: watchRunning ? "var(--success)" : "var(--text-secondary)" }}>
            {watchRunning ? `${watchFolderCount} folder${watchFolderCount !== 1 ? "s" : ""}` : "Off"}
          </span>
        </div>
      </div>

      {/* Quick Actions */}
      <h2 className="text-lg font-semibold mb-4" style={{ color: "var(--text-primary)" }}>
        Quick Actions
      </h2>
      <div className="grid grid-cols-3 gap-4 mb-8 stagger-in">
        <ActionCard
          icon={<ScanSearch size={24} />}
          title="Scan a Folder"
          description="Let AI organize your files"
          onClick={() => onNavigate("scan")}
        />
        <ActionCard
          icon={<Clock size={24} />}
          title="View History"
          description="Past operations & undo"
          onClick={() => onNavigate("history")}
        />
        <ActionCard
          icon={<Settings size={24} />}
          title="Settings"
          description="AI engine, license, watch"
          onClick={() => onNavigate("settings")}
        />
      </div>

      {/* Quick Re-scan */}
      {recentFolders.length > 0 && (
        <>
          <h2 className="text-lg font-semibold mb-4" style={{ color: "var(--text-primary)" }}>
            Quick Re-scan
          </h2>
          <div className="flex flex-wrap gap-2 mb-8">
            {recentFolders.slice(0, 4).map(([path, , scanCount]) => {
              const name = path.split(/[/\\]/).pop() || path;
              return (
                <button
                  key={path}
                  onClick={() => onNavigate("scan")}
                  className="flex items-center gap-2 rounded-lg text-sm border transition-all hover-lift"
                  style={{ background: "var(--bg-secondary)", borderColor: "var(--border)", padding: "0.625rem 1rem" }}
                >
                  <Zap size={12} style={{ color: "var(--accent)" }} />
                  <span className="font-medium" style={{ color: "var(--text-primary)" }}>{name}</span>
                  <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{scanCount}x</span>
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* Recent Activity */}
      <h2 className="text-lg font-semibold mb-4" style={{ color: "var(--text-primary)" }}>
        Recent Activity
      </h2>
      {recentOps.length === 0 ? (
        <div
          className="rounded-xl p-12 border text-center animate-fade-in"
          style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}
        >
          <div className="relative inline-block mb-6">
            <div
              className="w-24 h-24 rounded-2xl flex items-center justify-center mx-auto"
              style={{ background: "linear-gradient(135deg, var(--bg-tertiary), var(--bg-secondary))", border: "1px dashed var(--border)" }}
            >
              <FolderOpen size={40} style={{ color: "var(--text-secondary)", opacity: 0.4 }} />
            </div>
            <div
              className="absolute -top-2 -right-2 w-10 h-10 rounded-xl flex items-center justify-center animate-bounce-in"
              style={{ background: "linear-gradient(135deg, var(--accent), var(--accent-hover))", boxShadow: "0 4px 12px rgba(108, 92, 231, 0.4)" }}
            >
              <Sparkles size={18} style={{ color: "white" }} />
            </div>
          </div>
          <h3 className="text-lg font-semibold mb-2" style={{ color: "var(--text-primary)" }}>
            Ready to organize
          </h3>
          <p className="text-sm mb-6 max-w-xs mx-auto" style={{ color: "var(--text-secondary)" }}>
            Drop a folder or click below to let AI sort your files into a clean structure.
          </p>
          <button
            onClick={() => onNavigate("scan")}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white btn-press"
            style={{ background: "linear-gradient(135deg, var(--accent), var(--accent-hover))", boxShadow: "0 4px 16px rgba(108, 92, 231, 0.3)" }}
          >
            <ScanSearch size={16} />
            Start Scanning
          </button>
        </div>
      ) : (
        <div className="space-y-2 stagger-in">
          {recentOps.map((op) => (
            <div
              key={op.id}
              className="flex items-center justify-between rounded-xl border hover-lift cursor-pointer"
              style={{
                background: "var(--bg-secondary)",
                borderColor: "var(--border)",
                opacity: op.undone ? 0.5 : 1,
                padding: "1rem 1.25rem",
              }}
              onClick={() => onNavigate("history")}
            >
              <div className="flex items-center gap-3">
                {op.undone ? (
                  <RotateCcw size={14} style={{ color: "var(--text-secondary)" }} />
                ) : (
                  <FileText size={14} style={{ color: "var(--accent)" }} />
                )}
                <span className="text-sm" style={{ color: "var(--text-primary)" }}>
                  {op.description}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs" style={{ color: "var(--text-secondary)" }}>
                <span>{op.changes.length} files</span>
                <span>{new Date(op.timestamp).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
          {history.length > 5 && (
            <button
              onClick={() => onNavigate("history")}
              className="text-xs font-medium mt-1"
              style={{ color: "var(--accent)" }}
            >
              View all {history.length} operations →
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function AnimatedNumber({ value }: { value: string }) {
  const num = parseInt(value.replace(/[^0-9]/g, "")) || 0;
  const suffix = value.replace(/[0-9,]/g, "");
  const [display, setDisplay] = useState(0);
  const raf = useRef<number>(0);

  useEffect(() => {
    if (num === 0) { setDisplay(0); return; }
    const duration = 600;
    const start = performance.now();
    const animate = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      setDisplay(Math.round(eased * num));
      if (t < 1) raf.current = requestAnimationFrame(animate);
    };
    raf.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf.current);
  }, [num]);

  return <>{display.toLocaleString()}{suffix}</>;
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div
      className="rounded-xl border hover-lift"
      style={{ background: "var(--bg-secondary)", borderColor: "var(--border)", padding: "1.5rem" }}
    >
      <div className="flex items-center gap-2" style={{ color: "var(--accent)", marginBottom: "0.75rem" }}>
        {icon}
        <span className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
          {label}
        </span>
      </div>
      <div className="text-2xl font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>
        <AnimatedNumber value={value} />
      </div>
    </div>
  );
}

function ActionCard({ icon, title, description, onClick }: { icon: React.ReactNode; title: string; description: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-start gap-4 rounded-xl border text-left hover-glow hover-lift"
      style={{ background: "var(--bg-secondary)", borderColor: "var(--border)", padding: "1.5rem" }}
    >
      <div className="rounded-lg p-2.5" style={{ background: "var(--bg-tertiary)", color: "var(--accent)" }}>
        {icon}
      </div>
      <div>
        <div className="font-semibold mb-1" style={{ color: "var(--text-primary)" }}>{title}</div>
        <div className="text-sm" style={{ color: "var(--text-secondary)" }}>{description}</div>
      </div>
    </button>
  );
}
