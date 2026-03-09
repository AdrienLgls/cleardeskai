import { FolderOpen, ScanSearch, Clock, Sparkles, Settings, FileText, RotateCcw } from "lucide-react";
import { useAppStore } from "../../stores/appStore";

type View = "dashboard" | "scan" | "history" | "settings";

interface DashboardProps {
  onNavigate: (view: View) => void;
}

export function Dashboard({ onNavigate }: DashboardProps) {
  const { stats, history } = useAppStore();

  const recentOps = history.slice(0, 5);

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>
          Welcome to ClearDeskAI
        </h1>
        <p style={{ color: "var(--text-secondary)" }}>
          Your files, organized by AI — 100% private, 100% local.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
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

      {/* Quick Actions */}
      <h2 className="text-lg font-semibold mb-4" style={{ color: "var(--text-primary)" }}>
        Quick Actions
      </h2>
      <div className="grid grid-cols-3 gap-4 mb-8">
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

      {/* Recent Activity */}
      <h2 className="text-lg font-semibold mb-4" style={{ color: "var(--text-primary)" }}>
        Recent Activity
      </h2>
      {recentOps.length === 0 ? (
        <div
          className="rounded-xl p-8 border text-center"
          style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}
        >
          <FileText size={32} className="mx-auto mb-3" style={{ color: "var(--text-secondary)" }} />
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            No activity yet. Scan a folder to get started.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {recentOps.map((op) => (
            <div
              key={op.id}
              className="flex items-center justify-between rounded-xl px-5 py-3 border"
              style={{
                background: "var(--bg-secondary)",
                borderColor: "var(--border)",
                opacity: op.undone ? 0.5 : 1,
              }}
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

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div
      className="rounded-xl p-5 border hover-lift"
      style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}
    >
      <div className="flex items-center gap-2 mb-3" style={{ color: "var(--accent)" }}>
        {icon}
        <span className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
          {label}
        </span>
      </div>
      <div className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
        {value}
      </div>
    </div>
  );
}

function ActionCard({ icon, title, description, onClick }: { icon: React.ReactNode; title: string; description: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-start gap-4 rounded-xl p-5 border text-left transition-all duration-200 hover-glow hover-lift"
      style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}
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
