import { useState } from "react";
import { FolderOpen, Play, Check, X, ChevronRight, Loader2, ArrowRight } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { useAppStore } from "../../stores/appStore";

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
  } = useAppStore();
  const [applying, setApplying] = useState(false);

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
    } catch (err) {
      console.error("Scan failed:", err);
      finishScan();
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
    } catch (err) {
      console.error("Apply failed:", err);
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

      {/* Results */}
      {scan.results.length > 0 && !scan.scanning && (
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
                className="flex items-center gap-3 rounded-lg px-4 py-3 border transition-colors"
                style={{
                  background: r.approved ? "var(--bg-secondary)" : "var(--bg-primary)",
                  borderColor: r.approved ? "var(--border)" : "transparent",
                  opacity: r.approved ? 1 : 0.5,
                }}
              >
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
              </div>
            ))}
          </div>

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
