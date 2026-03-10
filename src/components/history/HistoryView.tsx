import { RotateCcw, Clock, FileText, Loader2, ChevronDown, ArrowRight, Trash2, ExternalLink, Search, X } from "lucide-react";
import { useState, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useAppStore } from "../../stores/appStore";
import { useToast } from "../toast/ToastProvider";

export function HistoryView() {
  const { history, markUndone, loadHistory } = useAppStore();
  const { toast } = useToast();
  const [undoing, setUndoing] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "undone">("all");

  const filtered = useMemo(() => {
    let ops = history;
    if (search) {
      const q = search.toLowerCase();
      ops = ops.filter((op) =>
        op.description.toLowerCase().includes(q) ||
        op.changes.some((c) =>
          c.source.toLowerCase().includes(q) || c.destination.toLowerCase().includes(q)
        )
      );
    }
    if (statusFilter === "active") ops = ops.filter((op) => !op.undone);
    if (statusFilter === "undone") ops = ops.filter((op) => op.undone);
    return ops;
  }, [history, search, statusFilter]);

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
    setShowClearConfirm(false);
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

  function openFolder(path: string) {
    // Extract directory from file path
    const dir = path.substring(0, path.lastIndexOf("/")) || path.substring(0, path.lastIndexOf("\\"));
    if (dir) {
      import("@tauri-apps/plugin-shell").then(({ open }) => open(dir));
    }
  }

  return (
    <div className="p-8 max-w-full page-bg">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold gradient-text">
          History
        </h1>
        {history.length > 0 && (
          <button
            onClick={() => setShowClearConfirm(true)}
            disabled={clearing}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-medium btn-press"
            style={{ background: "var(--bg-tertiary)", color: "var(--danger)" }}
          >
            {clearing ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
            Clear History
          </button>
        )}
      </div>

      {history.length > 0 && (
        <div className="flex gap-3 mb-6">
          <div
            className="flex items-center gap-2 flex-1 px-4 py-2.5 rounded-xl border"
            style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}
          >
            <Search size={14} style={{ color: "var(--text-secondary)" }} />
            <input
              type="text"
              placeholder="Search operations or filenames..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-transparent outline-none text-sm flex-1 input-focus"
              style={{ color: "var(--text-primary)" }}
            />
            {search && (
              <button onClick={() => setSearch("")}>
                <X size={14} style={{ color: "var(--text-secondary)" }} />
              </button>
            )}
          </div>
          <div className="flex rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)" }}>
            {(["all", "active", "undone"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className="px-4 py-2.5 text-xs font-medium capitalize transition-colors"
                style={{
                  background: statusFilter === s ? "var(--accent)" : "var(--bg-secondary)",
                  color: statusFilter === s ? "white" : "var(--text-secondary)",
                }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {history.length === 0 ? (
        <div
          className="rounded-xl p-16 border text-center animate-fade-in"
          style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}
        >
          <div className="relative inline-block mb-6">
            <div
              className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto"
              style={{ background: "var(--bg-tertiary)" }}
            >
              <Clock size={36} style={{ color: "var(--text-secondary)", opacity: 0.5 }} />
            </div>
            <div
              className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full flex items-center justify-center"
              style={{ background: "var(--accent)", boxShadow: "0 2px 8px rgba(108, 92, 231, 0.3)" }}
            >
              <FileText size={12} style={{ color: "white" }} />
            </div>
          </div>
          <h3 className="text-lg font-semibold mb-2" style={{ color: "var(--text-primary)" }}>No operations yet</h3>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Scan and organize a folder to see your history here.
          </p>
        </div>
      ) : (
        <div className="space-y-3 stagger-in">
          {filtered.length === 0 && (
            <div
              className="rounded-xl p-8 border text-center"
              style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}
            >
              <Search size={32} className="mx-auto mb-3" style={{ color: "var(--text-secondary)", opacity: 0.5 }} />
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                No matching operations found
              </p>
            </div>
          )}
          {filtered.map((op) => (
            <div
              key={op.id}
              className="rounded-xl border transition-all overflow-hidden hover-lift"
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
                        className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-medium transition-colors btn-press"
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
                          <span className="truncate" style={{ maxWidth: "35%" }}>{srcName}</span>
                          <ArrowRight size={10} style={{ flexShrink: 0 }} />
                          <span className="truncate flex-1" style={{ color: "var(--text-primary)" }}>{destName}</span>
                          <button
                            onClick={() => openFolder(c.destination)}
                            className="flex-shrink-0 p-1 rounded hover:bg-[var(--bg-tertiary)] transition-colors"
                            title="Open in file manager"
                          >
                            <ExternalLink size={10} style={{ color: "var(--accent)" }} />
                          </button>
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
      {showClearConfirm && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50 modal-backdrop"
          onClick={() => setShowClearConfirm(false)}
        >
          <div
            className="rounded-xl p-6 border max-w-sm w-full mx-4 modal-content"
            style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold mb-2" style={{ color: "var(--text-primary)" }}>
              Clear History
            </h3>
            <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>
              This will permanently delete all {history.length} operation records. Your files won't be moved back.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="px-4 py-2.5 rounded-xl text-sm font-medium btn-press"
                style={{ background: "var(--bg-tertiary)", color: "var(--text-secondary)" }}
              >
                Cancel
              </button>
              <button
                onClick={handleClearHistory}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium btn-press"
                style={{ background: "var(--danger)", color: "white" }}
              >
                <Trash2 size={14} />
                Clear All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
