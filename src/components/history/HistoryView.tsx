import { RotateCcw, Clock, FileText, Loader2, ChevronDown, ArrowRight, Trash2 } from "lucide-react";
import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useAppStore } from "../../stores/appStore";
import { useToast } from "../toast/ToastProvider";

export function HistoryView() {
  const { history, markUndone, loadHistory } = useAppStore();
  const { toast } = useToast();
  const [undoing, setUndoing] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);

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

  async function handleClearHistory() {
    if (!confirm("Clear all history? This cannot be undone.")) return;
    setClearing(true);
    try {
      await invoke("clear_history");
      loadHistory([]);
      toast("success", "History cleared");
    } catch (err) {
      toast("error", `Failed to clear history: ${err}`);
    }
    setClearing(false);
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
          History
        </h1>
        {history.length > 0 && (
          <button
            onClick={handleClearHistory}
            disabled={clearing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
            style={{ background: "var(--bg-tertiary)", color: "var(--danger)" }}
          >
            {clearing ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
            Clear History
          </button>
        )}
      </div>

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
              className="rounded-xl border transition-opacity overflow-hidden"
              style={{
                background: "var(--bg-secondary)",
                borderColor: "var(--border)",
                opacity: op.undone ? 0.5 : 1,
              }}
            >
              <div className="p-5">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <FileText size={16} style={{ color: "var(--accent)" }} />
                    <span className="font-medium" style={{ color: "var(--text-primary)" }}>
                      {op.description}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
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
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 text-xs" style={{ color: "var(--text-secondary)" }}>
                    <span>{new Date(op.timestamp).toLocaleString()}</span>
                    <span>{op.changes.length} files</span>
                  </div>
                  <button
                    onClick={() => setExpanded(expanded === op.id ? null : op.id)}
                    className="flex items-center gap-1 text-xs transition-transform"
                    style={{ color: "var(--text-secondary)", transform: expanded === op.id ? "rotate(180deg)" : "rotate(0)" }}
                  >
                    <ChevronDown size={14} />
                  </button>
                </div>
              </div>

              {expanded === op.id && op.changes.length > 0 && (
                <div className="border-t px-5 pb-4 pt-3" style={{ borderColor: "var(--border)" }}>
                  <div className="space-y-1.5">
                    {op.changes.map((c, i) => {
                      const srcName = c.source.split(/[/\\]/).pop() || c.source;
                      const destName = c.destination.split(/[/\\]/).pop() || c.destination;
                      return (
                        <div key={i} className="flex items-center gap-2 text-xs font-mono" style={{ color: "var(--text-secondary)" }}>
                          <span className="truncate" style={{ maxWidth: "40%" }}>{srcName}</span>
                          <ArrowRight size={10} style={{ flexShrink: 0 }} />
                          <span className="truncate" style={{ color: "var(--text-primary)", maxWidth: "55%" }}>{destName}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
