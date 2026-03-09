import { RotateCcw, Clock, FileText } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { useAppStore } from "../../stores/appStore";

export function HistoryView() {
  const { history } = useAppStore();

  async function handleUndo(operationId: string) {
    try {
      await invoke("undo_operation", { operationId });
    } catch (err) {
      console.error("Undo failed:", err);
    }
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6" style={{ color: "var(--text-primary)" }}>
        History
      </h1>

      {history.length === 0 ? (
        <div
          className="rounded-xl p-12 border text-center"
          style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}
        >
          <Clock size={48} className="mx-auto mb-4" style={{ color: "var(--text-secondary)" }} />
          <p style={{ color: "var(--text-secondary)" }}>No operations yet. Scan a folder to get started.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {history.map((op) => (
            <div
              key={op.id}
              className="rounded-xl p-5 border"
              style={{
                background: "var(--bg-secondary)",
                borderColor: "var(--border)",
                opacity: op.undone ? 0.5 : 1,
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <FileText size={16} style={{ color: "var(--accent)" }} />
                  <span className="font-medium" style={{ color: "var(--text-primary)" }}>
                    {op.description}
                  </span>
                </div>
                {!op.undone && (
                  <button
                    onClick={() => handleUndo(op.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                    style={{ background: "var(--bg-tertiary)", color: "var(--warning)" }}
                  >
                    <RotateCcw size={12} />
                    Undo
                  </button>
                )}
                {op.undone && (
                  <span className="text-xs px-2 py-1 rounded" style={{ color: "var(--text-secondary)" }}>
                    Undone
                  </span>
                )}
              </div>
              <div className="flex items-center gap-4 text-xs" style={{ color: "var(--text-secondary)" }}>
                <span>{new Date(op.timestamp).toLocaleString()}</span>
                <span>{op.changes.length} files</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
