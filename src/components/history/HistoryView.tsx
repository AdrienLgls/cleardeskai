import { RotateCcw, Clock, FileText, Loader2 } from "lucide-react";
import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useAppStore } from "../../stores/appStore";
import { useToast } from "../toast/ToastProvider";

export function HistoryView() {
  const { history, markUndone } = useAppStore();
  const { toast } = useToast();
  const [undoing, setUndoing] = useState<string | null>(null);

  async function handleUndo(operationId: string) {
    setUndoing(operationId);
    try {
      await invoke("undo_operation", { operationId });
      markUndone(operationId);
      toast("success", "Operation undone — files restored");
    } catch (err) {
      toast("error", `Undo failed: ${err}`);
    }
    setUndoing(null);
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
              className="rounded-xl p-5 border transition-opacity"
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
                    disabled={undoing === op.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                    style={{ background: "var(--bg-tertiary)", color: "var(--warning)" }}
                  >
                    {undoing === op.id ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <RotateCcw size={12} />
                    )}
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
