import { useState } from "react";
import { FolderOpen, Play, Check, X, ChevronRight, Loader2, ArrowRight, ChevronDown, Tag, Pencil } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { useAppStore } from "../../stores/appStore";
import { useToast } from "../toast/ToastProvider";

export function ScanView() {
  const {
    scan,
    setScanFolder,
    startScan,
    setScanProgress,
    setScanResults,
    finishScan,
    toggleApproval,
    approveAll,
    rejectAll,
    addOperation,
    updateResult,
    resetScan,
  } = useAppStore();
  const { toast } = useToast();
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);

  async function handleSelectFolder() {
    const selected = await open({ directory: true, multiple: false });
    if (selected) setScanFolder(selected as string);
  }

  async function handleScan() {
    if (!scan.selectedFolder) return;
    startScan();
    try {
      const result = await invoke<{ files: number; classifications: Classification[] }>(
        "scan_folder",
        { path: scan.selectedFolder }
      );
      setScanProgress(result.files, result.files);
      setScanResults(
        result.classifications.map((c: Classification) => ({ ...c, approved: true }))
      );
      finishScan();
      toast("success", `Found ${result.classifications.length} files to organize`);
    } catch (err) {
      finishScan();
      toast("error", `Scan failed: ${err}`);
    }
  }

  async function handleApply() {
    const approved = scan.results.filter((r) => r.approved);
    if (approved.length === 0) return;
    setApplying(true);
    try {
      const changes = approved.map((r) => ({
        source: r.file.path,
        destination: `${r.proposedFolder}/${r.proposedName || r.file.name}`,
        newName: r.proposedName || null,
        changeType: r.proposedName ? "move_and_rename" : "move",
      }));
      const result = await invoke<{ operationId: string }>("apply_changes", { changes });
      addOperation({
        id: result.operationId,
        timestamp: new Date().toISOString(),
        description: `Organized ${approved.length} files from ${scan.selectedFolder}`,
        changes: changes.map((c) => ({ ...c, newName: c.newName ?? undefined, changeType: c.changeType as "move" | "rename" | "move_and_rename" })),
        undone: false,
      });
      setApplied(approved.length);
      toast("success", `${approved.length} files organized successfully`);
    } catch (err) {
      toast("error", `Failed to apply changes: ${err}`);
    }
    setApplying(false);
  }

  const approvedCount = scan.results.filter((r) => r.approved).length;

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-6" style={{ color: "var(--text-primary)" }}>
        Scan & Organize
      </h1>

      {/* Folder Selection */}
      <div
        className="rounded-xl p-6 border mb-6"
        style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}
      >
        <div className="flex items-center gap-4">
          <button
            onClick={handleSelectFolder}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-colors"
            style={{ background: "var(--accent)", color: "white" }}
          >
            <FolderOpen size={16} />
            Select Folder
          </button>
          {scan.selectedFolder && (
            <span className="text-sm font-mono" style={{ color: "var(--text-secondary)" }}>
              {scan.selectedFolder}
            </span>
          )}
        </div>

        {scan.selectedFolder && !scan.scanning && scan.results.length === 0 && (
          <button
            onClick={handleScan}
            className="flex items-center gap-2 mt-4 px-4 py-2.5 rounded-lg font-medium text-sm transition-colors"
            style={{ background: "var(--success)", color: "white" }}
          >
            <Play size={16} />
            Scan & Classify
          </button>
        )}
      </div>

      {/* Scanning Progress */}
      {scan.scanning && (
        <div
          className="rounded-xl p-6 border mb-6"
          style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}
        >
          <div className="flex items-center gap-3 mb-3">
            <Loader2 size={18} className="animate-spin" style={{ color: "var(--accent)" }} />
            <span style={{ color: "var(--text-primary)" }}>
              Scanning... {scan.scannedFiles} / {scan.totalFiles} files
            </span>
          </div>
          <div
            className="w-full h-2 rounded-full overflow-hidden"
            style={{ background: "var(--bg-tertiary)" }}
          >
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: `${scan.progress}%`, background: "var(--accent)" }}
            />
          </div>
        </div>
      )}

      {/* Success State */}
      {applied !== null && (
        <div
          className="rounded-xl p-10 border text-center mb-6 animate-fade-in"
          style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}
        >
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: "var(--success)", opacity: 0.15 }}>
            <Check size={32} style={{ color: "var(--success)" }} />
          </div>
          <h2 className="text-xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>
            {applied} files organized!
          </h2>
          <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
            All changes have been applied. You can undo this from the History page.
          </p>
          <button
            onClick={() => { resetScan(); setApplied(null); }}
            className="flex items-center gap-2 mx-auto px-5 py-2.5 rounded-lg font-medium text-sm"
            style={{ background: "var(--accent)", color: "white" }}
          >
            <FolderOpen size={16} />
            Scan Another Folder
          </button>
        </div>
      )}

      {/* Results */}
      {applied === null && scan.results.length > 0 && !scan.scanning && (
        <>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
              Proposed Changes ({approvedCount}/{scan.results.length} approved)
            </h2>
            <div className="flex gap-2">
              <button
                onClick={approveAll}
                className="px-3 py-1.5 rounded-lg text-xs font-medium"
                style={{ background: "var(--success)", color: "white" }}
              >
                Approve All
              </button>
              <button
                onClick={rejectAll}
                className="px-3 py-1.5 rounded-lg text-xs font-medium"
                style={{ background: "var(--danger)", color: "white" }}
              >
                Reject All
              </button>
            </div>
          </div>

          <div className="space-y-2 mb-6">
            {scan.results.map((r, i) => (
              <div
                key={i}
                className="rounded-lg border transition-colors overflow-hidden"
                style={{
                  background: r.approved ? "var(--bg-secondary)" : "var(--bg-primary)",
                  borderColor: r.approved ? "var(--border)" : "transparent",
                  opacity: r.approved ? 1 : 0.5,
                }}
              >
                <div className="flex items-center gap-3 px-4 py-3">
                  <button onClick={() => toggleApproval(i)}>
                    {r.approved ? (
                      <Check size={18} style={{ color: "var(--success)" }} />
                    ) : (
                      <X size={18} style={{ color: "var(--danger)" }} />
                    )}
                  </button>
                  <span className="text-sm font-mono truncate flex-1" style={{ color: "var(--text-secondary)" }}>
                    {r.file.name}
                  </span>
                  <ArrowRight size={14} style={{ color: "var(--text-secondary)" }} />
                  <span className="text-sm font-mono truncate flex-1" style={{ color: "var(--text-primary)" }}>
                    {r.proposedFolder}/{r.proposedName || r.file.name}
                  </span>
                  <span
                    className="text-xs px-2 py-0.5 rounded-full"
                    style={{
                      background: r.confidence > 0.8 ? "var(--success)" : r.confidence > 0.5 ? "var(--warning)" : "var(--danger)",
                      color: "white",
                      opacity: 0.9,
                    }}
                  >
                    {Math.round(r.confidence * 100)}%
                  </span>
                  <button
                    onClick={() => setExpanded(expanded === i ? null : i)}
                    className="transition-transform"
                    style={{ color: "var(--text-secondary)", transform: expanded === i ? "rotate(180deg)" : "rotate(0)" }}
                  >
                    <ChevronDown size={14} />
                  </button>
                </div>
                {expanded === i && (
                  <div className="px-4 pb-3 pt-0 border-t" style={{ borderColor: "var(--border)" }}>
                    <div className="flex items-center gap-4 mt-2">
                      <div className="flex items-center gap-1.5">
                        <Tag size={12} style={{ color: "var(--accent)" }} />
                        <span className="text-xs font-medium" style={{ color: "var(--accent)" }}>{r.category}</span>
                      </div>
                      <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                        {(r.file.size / 1024).toFixed(0)} KB
                      </span>
                    </div>
                    <p className="text-xs mt-1.5 mb-3" style={{ color: "var(--text-secondary)" }}>
                      {r.reasoning}
                    </p>
                    <div className="flex items-center gap-2">
                      <Pencil size={12} style={{ color: "var(--text-secondary)" }} />
                      <div className="flex gap-2 flex-1">
                        <input
                          type="text"
                          value={r.proposedFolder}
                          onChange={(e) => updateResult(i, { proposedFolder: e.target.value })}
                          className="flex-1 px-2 py-1 rounded text-xs font-mono border outline-none"
                          style={{ background: "var(--bg-tertiary)", borderColor: "var(--border)", color: "var(--text-primary)" }}
                          placeholder="Destination folder"
                        />
                        <input
                          type="text"
                          value={r.proposedName || r.file.name}
                          onChange={(e) => updateResult(i, { proposedName: e.target.value === r.file.name ? undefined : e.target.value })}
                          className="flex-1 px-2 py-1 rounded text-xs font-mono border outline-none"
                          style={{ background: "var(--bg-tertiary)", borderColor: "var(--border)", color: "var(--text-primary)" }}
                          placeholder="Filename"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            {approvedCount > 0 && (
              <button
                onClick={handleApply}
                disabled={applying}
                className="flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-colors"
                style={{ background: "var(--accent)", color: "white" }}
              >
                {applying ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <ChevronRight size={18} />
                )}
                Apply {approvedCount} Changes
              </button>
            )}
            <button
              onClick={resetScan}
              className="flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-colors"
              style={{ background: "var(--bg-tertiary)", color: "var(--text-secondary)" }}
            >
              <FolderOpen size={16} />
              New Scan
            </button>
          </div>
        </>
      )}
    </div>
  );
}

interface Classification {
  file: { path: string; name: string; extension: string; size: number; modified: string; mimeType: string };
  proposedFolder: string;
  proposedName?: string;
  confidence: number;
  category: string;
  reasoning: string;
  approved: boolean;
}
