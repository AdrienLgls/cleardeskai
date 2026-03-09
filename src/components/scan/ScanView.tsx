import { useState, useEffect } from "react";
import { FolderOpen, Play, Check, X, ChevronRight, Loader2, ArrowRight, ChevronDown, Tag, Pencil, AlertTriangle, Download, Bot, Search, FileImage, FileVideo, FileAudio, FileCode, FileSpreadsheet, FileArchive, FileText, File, FileDown, Clock, RotateCcw, ArrowUpDown } from "lucide-react";

type SortKey = "name" | "confidence" | "size" | "category";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { open } from "@tauri-apps/plugin-dialog";
import { useAppStore } from "../../stores/appStore";
import { useToast } from "../toast/ToastProvider";

const fileIconMap: Record<string, typeof File> = {
  // Images
  jpg: FileImage, jpeg: FileImage, png: FileImage, gif: FileImage, svg: FileImage, webp: FileImage, bmp: FileImage, ico: FileImage,
  // Video
  mp4: FileVideo, mkv: FileVideo, avi: FileVideo, mov: FileVideo, wmv: FileVideo, webm: FileVideo,
  // Audio
  mp3: FileAudio, wav: FileAudio, flac: FileAudio, ogg: FileAudio, aac: FileAudio, m4a: FileAudio,
  // Code
  js: FileCode, ts: FileCode, tsx: FileCode, jsx: FileCode, py: FileCode, rs: FileCode, go: FileCode, java: FileCode, cpp: FileCode, c: FileCode, h: FileCode, css: FileCode, html: FileCode, json: FileCode, xml: FileCode, yaml: FileCode, yml: FileCode, sh: FileCode, toml: FileCode,
  // Documents
  pdf: FileText, doc: FileText, docx: FileText, txt: FileText, md: FileText, rtf: FileText, odt: FileText,
  // Spreadsheets
  xls: FileSpreadsheet, xlsx: FileSpreadsheet, csv: FileSpreadsheet, ods: FileSpreadsheet,
  // Archives
  zip: FileArchive, tar: FileArchive, gz: FileArchive, rar: FileArchive, "7z": FileArchive, bz2: FileArchive,
};

function getFileIcon(extension: string) {
  const Icon = fileIconMap[extension.toLowerCase()] || File;
  return <Icon size={14} />;
}

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
    approveCategory,
    rejectCategory,
    addOperation,
    updateResult,
    resetScan,
    markUndone,
  } = useAppStore();
  const { toast } = useToast();
  const { ollamaStatus, setOllamaStatus } = useAppStore();
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [pullingModel, setPullingModel] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [scanPhase, setScanPhase] = useState<string>("");
  const [searchFilter, setSearchFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [currentModel, setCurrentModel] = useState("qwen3:4b");
  const [appliedSummary, setAppliedSummary] = useState<{ category: string; count: number; size: number }[]>([]);
  const [applyProgress, setApplyProgress] = useState<{ processed: number; total: number; currentFile: string } | null>(null);
  const [lastOperationId, setLastOperationId] = useState<string | null>(null);
  const [undoing, setUndoing] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("confidence");
  const [recentFolders, setRecentFolders] = useState<[string, string, number][]>([]);

  useEffect(() => {
    invoke<{ status: string }>("check_ollama_status").then((s) => {
      setOllamaStatus(s.status as "running" | "not_installed" | "no_model");
    }).catch(() => {});
    invoke<string>("get_current_model").then(setCurrentModel).catch(() => {});
    invoke<[string, string, number][]>("get_recent_folders").then(setRecentFolders).catch(() => {});

    // Tauri native drag-and-drop — gives real filesystem paths
    const unlistenPromise = getCurrentWebview().onDragDropEvent((event) => {
      if (event.payload.type === "over") {
        setDragOver(true);
      } else if (event.payload.type === "drop") {
        setDragOver(false);
        const paths = event.payload.paths;
        if (paths.length > 0) {
          setScanFolder(paths[0]);
        }
      } else if (event.payload.type === "leave") {
        setDragOver(false);
      }
    });

    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, [setOllamaStatus, setScanFolder]);

  async function handlePullModel() {
    setPullingModel(true);
    try {
      await invoke("setup_ollama");
      setOllamaStatus("running");
      toast("success", "AI model downloaded and ready");
    } catch (err) {
      toast("error", `Failed to download model: ${err}`);
    }
    setPullingModel(false);
  }

  async function handleSelectFolder() {
    const selected = await open({ directory: true, multiple: false });
    if (selected) setScanFolder(selected as string);
  }

  async function handleScan() {
    if (!scan.selectedFolder) return;
    startScan();
    setScanPhase("Scanning files...");

    // Listen for progress events from backend
    const unlisten = await listen<{ phase: string; processed: number; total: number }>(
      "scan-progress",
      (event) => {
        const { phase, processed, total } = event.payload;
        setScanProgress(processed, total);
        if (phase === "collecting") {
          setScanPhase(`Found ${total} files, starting AI classification...`);
        } else if (phase === "classifying") {
          setScanPhase(`Classifying... ${processed}/${total} files`);
        }
      }
    );

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
      const errStr = String(err);
      if (errStr.includes("timed out")) {
        toast("error", "AI classification timed out. Try scanning fewer files or check Ollama.");
      } else if (errStr.includes("Ollama") || errStr.includes("Connection refused")) {
        toast("error", "Ollama is not running. Start it and try again.");
      } else {
        toast("error", `Scan failed: ${errStr}`);
      }
    }
    setScanPhase("");
    unlisten();
  }

  function handleApplyClick() {
    const approved = scan.results.filter((r) => r.approved);
    if (approved.length === 0) return;
    setShowConfirm(true);
  }

  async function handleApply() {
    setShowConfirm(false);
    const approved = scan.results.filter((r) => r.approved);
    if (approved.length === 0) return;
    setApplying(true);
    setApplyProgress({ processed: 0, total: approved.length, currentFile: "" });

    const unlisten = await listen<{ processed: number; total: number; currentFile: string }>(
      "apply-progress",
      (event) => setApplyProgress(event.payload)
    );

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
      // Build category summary for success screen
      const catMap = new Map<string, { count: number; size: number }>();
      for (const r of approved) {
        const existing = catMap.get(r.category) || { count: 0, size: 0 };
        catMap.set(r.category, { count: existing.count + 1, size: existing.size + r.file.size });
      }
      setAppliedSummary(
        Array.from(catMap.entries())
          .map(([category, { count, size }]) => ({ category, count, size }))
          .sort((a, b) => b.count - a.count)
      );
      setLastOperationId(result.operationId);
      setApplied(approved.length);
      toast("success", `${approved.length} files organized successfully`);
    } catch (err) {
      toast("error", `Failed to apply changes: ${err}`);
    }
    unlisten();
    setApplying(false);
    setApplyProgress(null);
  }

  function exportCSV() {
    const header = "File,Extension,Size (bytes),Category,Confidence,Destination,Approved\n";
    const rows = scan.results.map((r) =>
      [
        `"${r.file.name}"`,
        r.file.extension,
        r.file.size,
        r.category,
        Math.round(r.confidence * 100) + "%",
        `"${r.proposedFolder}/${r.proposedName || r.file.name}"`,
        r.approved ? "Yes" : "No",
      ].join(",")
    ).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cleardeskai-scan-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast("success", "Scan results exported as CSV");
  }

  const approvedCount = scan.results.filter((r) => r.approved).length;

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-6" style={{ color: "var(--text-primary)" }}>
        Scan & Organize
      </h1>

      {/* Ollama Status Banner */}
      {ollamaStatus === "not_installed" && (
        <div
          className="rounded-xl p-5 border mb-6 animate-fade-in"
          style={{ background: "var(--bg-secondary)", borderColor: "var(--danger)" }}
        >
          <div className="flex items-start gap-3">
            <AlertTriangle size={20} style={{ color: "var(--danger)", flexShrink: 0, marginTop: 2 }} />
            <div>
              <h3 className="font-semibold text-sm mb-1" style={{ color: "var(--text-primary)" }}>
                Ollama Not Detected
              </h3>
              <p className="text-xs mb-3" style={{ color: "var(--text-secondary)" }}>
                ClearDeskAI uses Ollama to run AI locally on your machine. Install it to start organizing files.
              </p>
              <button
                onClick={() => {
                  import("@tauri-apps/plugin-shell").then(({ open }) => open("https://ollama.com/download"));
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
                style={{ background: "var(--accent)", color: "white" }}
              >
                <Download size={12} />
                Download Ollama
              </button>
            </div>
          </div>
        </div>
      )}

      {ollamaStatus === "no_model" && (
        <div
          className="rounded-xl p-5 border mb-6 animate-fade-in"
          style={{ background: "var(--bg-secondary)", borderColor: "var(--warning)" }}
        >
          <div className="flex items-start gap-3">
            <Bot size={20} style={{ color: "var(--warning)", flexShrink: 0, marginTop: 2 }} />
            <div className="flex-1">
              <h3 className="font-semibold text-sm mb-1" style={{ color: "var(--text-primary)" }}>
                AI Model Required
              </h3>
              <p className="text-xs mb-3" style={{ color: "var(--text-secondary)" }}>
                Ollama is running but the AI model ({currentModel}) needs to be downloaded. This is a one-time download.
              </p>
              <button
                onClick={handlePullModel}
                disabled={pullingModel}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
                style={{ background: "var(--accent)", color: "white", opacity: pullingModel ? 0.7 : 1 }}
              >
                {pullingModel ? (
                  <>
                    <Loader2 size={12} className="animate-spin" />
                    Downloading...
                  </>
                ) : (
                  <>
                    <Download size={12} />
                    Download Model
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Folder Selection */}
      <div
        className={`rounded-xl p-6 border mb-6 drop-zone ${dragOver ? "drag-over" : ""}`}
        style={{ background: "var(--bg-secondary)", borderColor: dragOver ? "var(--accent)" : "var(--border)", borderStyle: scan.selectedFolder ? "solid" : "dashed" }}
      >
        <div className="flex items-center gap-4">
          <button
            onClick={handleSelectFolder}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm btn"
            style={{ background: "var(--accent)", color: "white" }}
          >
            <FolderOpen size={16} />
            Select Folder
          </button>
          {scan.selectedFolder ? (
            <span className="text-sm font-mono" style={{ color: "var(--text-secondary)" }}>
              {scan.selectedFolder}
            </span>
          ) : (
            <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
              or drag & drop a folder here
            </span>
          )}
        </div>

        {scan.selectedFolder && !scan.scanning && scan.results.length === 0 && (
          <button
            onClick={handleScan}
            className="flex items-center gap-2 mt-4 px-4 py-2.5 rounded-lg font-medium text-sm btn animate-pulse-glow"
            style={{ background: "var(--success)", color: "white" }}
          >
            <Play size={16} />
            Scan & Classify
          </button>
        )}
      </div>

      {/* Recent Folders */}
      {!scan.selectedFolder && !scan.scanning && scan.results.length === 0 && recentFolders.length > 0 && (
        <div className="mb-6 animate-fade-in">
          <h3 className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: "var(--text-secondary)" }}>
            Recent Folders
          </h3>
          <div className="space-y-1">
            {recentFolders.map(([path, _lastUsed, scanCount]) => {
              const folderName = path.split(/[/\\]/).pop() || path;
              return (
                <button
                  key={path}
                  onClick={() => setScanFolder(path)}
                  className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-left text-sm transition-colors"
                  style={{ color: "var(--text-secondary)" }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-tertiary)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                >
                  <Clock size={14} style={{ flexShrink: 0, opacity: 0.5 }} />
                  <span className="font-medium truncate" style={{ color: "var(--text-primary)" }}>{folderName}</span>
                  <span className="text-xs truncate opacity-60">{path}</span>
                  <span className="text-xs ml-auto whitespace-nowrap opacity-50">{scanCount}x</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Scanning Progress */}
      {scan.scanning && (
        <div
          className="rounded-xl p-6 border mb-6"
          style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}
        >
          <div className="flex items-center gap-3 mb-3">
            <Loader2 size={18} className="animate-spin" style={{ color: "var(--accent)" }} />
            <span style={{ color: "var(--text-primary)" }}>
              {scanPhase || `Scanning... ${scan.scannedFiles} / ${scan.totalFiles} files`}
            </span>
          </div>
          <div
            className="w-full h-2 rounded-full overflow-hidden"
            style={{ background: "var(--bg-tertiary)" }}
          >
            <div
              className="h-full rounded-full transition-all duration-300 progress-shimmer"
              style={{ width: `${scan.progress}%` }}
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
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce-in" style={{ background: "var(--success)", opacity: 0.15 }}>
            <Check size={32} style={{ color: "var(--success)" }} />
          </div>
          <h2 className="text-xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>
            {applied} files organized!
          </h2>
          <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>
            All changes have been applied successfully.
          </p>
          {appliedSummary.length > 0 && (
            <div className="flex flex-wrap justify-center gap-3 mb-6">
              {appliedSummary.map((s) => (
                <div
                  key={s.category}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs"
                  style={{ background: "var(--bg-tertiary)" }}
                >
                  <span className="font-medium" style={{ color: "var(--text-primary)" }}>{s.category}</span>
                  <span style={{ color: "var(--text-secondary)" }}>
                    {s.count} file{s.count !== 1 ? "s" : ""} · {s.size >= 1048576 ? `${(s.size / 1048576).toFixed(1)} MB` : `${(s.size / 1024).toFixed(0)} KB`}
                  </span>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => { resetScan(); setApplied(null); setAppliedSummary([]); setLastOperationId(null); }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium text-sm"
              style={{ background: "var(--accent)", color: "white" }}
            >
              <FolderOpen size={16} />
              Scan Another Folder
            </button>
            {lastOperationId && (
              <button
                onClick={async () => {
                  setUndoing(true);
                  try {
                    await invoke("undo_operation", { operationId: lastOperationId });
                    markUndone(lastOperationId);
                    toast("success", "Changes undone — files restored");
                    setLastOperationId(null);
                  } catch (err) {
                    toast("error", `Undo failed: ${err}`);
                  }
                  setUndoing(false);
                }}
                disabled={undoing}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm"
                style={{ background: "var(--bg-tertiary)", color: "var(--warning)" }}
              >
                {undoing ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
                Undo
              </button>
            )}
          </div>
        </div>
      )}

      {/* Results */}
      {applied === null && scan.results.length > 0 && !scan.scanning && (
        <>
          {/* Category Summary */}
          {(() => {
            const cats = scan.results.reduce<Record<string, number>>((acc, r) => {
              acc[r.category] = (acc[r.category] || 0) + 1;
              return acc;
            }, {});
            const total = scan.results.length;
            const catColors: Record<string, string> = {
              Documents: "#6C5CE7", Images: "#00B894", Videos: "#E17055",
              Music: "#FDCB6E", Code: "#0984E3", Archives: "#636E72",
              PDFs: "#D63031", Invoices: "#00CEC9", Screenshots: "#A29BFE",
              Spreadsheets: "#55EFC4", Other: "#B2BEC3",
            };
            return (
              <div className="rounded-xl p-4 border mb-4 animate-fade-in" style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
                <div className="flex h-2 rounded-full overflow-hidden mb-3" style={{ background: "var(--bg-tertiary)" }}>
                  {Object.entries(cats).map(([cat, count]) => (
                    <div key={cat} style={{ width: `${(count / total) * 100}%`, background: catColors[cat] || "#B2BEC3" }} />
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(cats).sort((a, b) => b[1] - a[1]).map(([cat, count]) => (
                    <button
                      key={cat}
                      onClick={() => setCategoryFilter(categoryFilter === cat ? null : cat)}
                      className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg transition-all"
                      style={{
                        background: categoryFilter === cat ? (catColors[cat] || "#B2BEC3") + "22" : "transparent",
                        border: categoryFilter === cat ? `1px solid ${catColors[cat] || "#B2BEC3"}` : "1px solid transparent",
                      }}
                    >
                      <div className="w-2 h-2 rounded-full" style={{ background: catColors[cat] || "#B2BEC3" }} />
                      <span style={{ color: categoryFilter === cat ? "var(--text-primary)" : "var(--text-secondary)" }}>{cat}</span>
                      <span className="font-medium" style={{ color: "var(--text-primary)" }}>{count}</span>
                    </button>
                  ))}
                  {categoryFilter && (
                    <>
                      <span className="text-xs text-txt-secondary mx-1" style={{ color: "var(--border)" }}>|</span>
                      <button
                        onClick={() => approveCategory(categoryFilter)}
                        className="text-xs px-2 py-1 rounded-lg"
                        style={{ color: "var(--success)" }}
                      >
                        Approve {categoryFilter}
                      </button>
                      <button
                        onClick={() => rejectCategory(categoryFilter)}
                        className="text-xs px-2 py-1 rounded-lg"
                        style={{ color: "var(--danger)" }}
                      >
                        Reject {categoryFilter}
                      </button>
                      <button
                        onClick={() => setCategoryFilter(null)}
                        className="text-xs px-2 py-1 rounded-lg"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        Clear filter
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Search + Actions */}
          <div className="flex items-center gap-3 mb-4">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-secondary)" }} />
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Filter files..."
                className="w-full pl-8 pr-3 py-2 rounded-lg text-sm border outline-none"
                style={{ background: "var(--bg-tertiary)", borderColor: "var(--border)", color: "var(--text-primary)" }}
              />
            </div>
            <div className="flex items-center gap-1.5">
              <ArrowUpDown size={12} style={{ color: "var(--text-secondary)" }} />
              <select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as SortKey)}
                className="text-xs py-1.5 px-2 rounded-lg border outline-none"
                style={{ background: "var(--bg-tertiary)", borderColor: "var(--border)", color: "var(--text-primary)" }}
              >
                <option value="confidence">Confidence</option>
                <option value="name">Name</option>
                <option value="size">Size</option>
                <option value="category">Category</option>
              </select>
            </div>
            <h2 className="text-sm font-medium whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>
              {approvedCount}/{scan.results.length}
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
              <button
                onClick={exportCSV}
                className="px-3 py-1.5 rounded-lg text-xs font-medium"
                style={{ background: "var(--bg-tertiary)", color: "var(--text-secondary)" }}
                title="Export results as CSV"
              >
                <FileDown size={14} />
              </button>
            </div>
          </div>

          <div className="space-y-2 mb-6 stagger-in">
            {scan.results.map((r, i) => ({ r, i })).filter(({ r }) => {
              if (categoryFilter && r.category !== categoryFilter) return false;
              if (searchFilter) {
                const q = searchFilter.toLowerCase();
                return r.file.name.toLowerCase().includes(q) || r.category.toLowerCase().includes(q) || r.proposedFolder.toLowerCase().includes(q);
              }
              return true;
            }).sort((a, b) => {
              switch (sortKey) {
                case "confidence": return b.r.confidence - a.r.confidence;
                case "name": return a.r.file.name.localeCompare(b.r.file.name);
                case "size": return b.r.file.size - a.r.file.size;
                case "category": return a.r.category.localeCompare(b.r.category);
                default: return 0;
              }
            }).map(({ r, i }) => (
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
                  <span className="flex items-center gap-1.5 text-sm font-mono truncate flex-1" style={{ color: "var(--text-secondary)" }}>
                    <span className="flex-shrink-0" style={{ color: "var(--text-secondary)", opacity: 0.6 }}>{getFileIcon(r.file.extension)}</span>
                    <span className="truncate">{r.file.name}</span>
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
                        {r.file.size >= 1048576 ? `${(r.file.size / 1048576).toFixed(1)} MB` : `${(r.file.size / 1024).toFixed(0)} KB`}
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

          {/* Apply progress bar */}
          {applying && applyProgress && (
            <div
              className="rounded-xl p-4 border mb-4 animate-fade-in"
              style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}
            >
              <div className="flex items-center gap-3 mb-2">
                <Loader2 size={14} className="animate-spin" style={{ color: "var(--accent)" }} />
                <span className="text-sm" style={{ color: "var(--text-primary)" }}>
                  Moving files... {applyProgress.processed}/{applyProgress.total}
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: "var(--bg-tertiary)" }}>
                <div
                  className="h-full rounded-full transition-all duration-200 progress-shimmer"
                  style={{ width: `${applyProgress.total > 0 ? (applyProgress.processed / applyProgress.total) * 100 : 0}%` }}
                />
              </div>
              {applyProgress.currentFile && (
                <p className="text-xs mt-1.5 font-mono truncate" style={{ color: "var(--text-secondary)" }}>
                  {applyProgress.currentFile}
                </p>
              )}
            </div>
          )}

          <div className="flex gap-3">
            {approvedCount > 0 && (
              <button
                onClick={handleApplyClick}
                disabled={applying}
                className="flex items-center gap-2 px-6 py-3 rounded-lg font-semibold btn"
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
              disabled={applying}
              className="flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-colors"
              style={{ background: "var(--bg-tertiary)", color: "var(--text-secondary)" }}
            >
              <FolderOpen size={16} />
              New Scan
            </button>
          </div>
        </>
      )}
      {/* Confirmation Dialog */}
      {showConfirm && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50"
          style={{ background: "rgba(0,0,0,0.5)" }}
          onClick={() => setShowConfirm(false)}
        >
          <div
            className="rounded-xl p-6 border max-w-md w-full mx-4 animate-fade-in"
            style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold mb-2" style={{ color: "var(--text-primary)" }}>
              Confirm File Organization
            </h3>
            <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>
              This will move <strong>{approvedCount} file{approvedCount !== 1 ? "s" : ""}</strong> to their proposed destinations. You can undo this from the History page.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowConfirm(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium"
                style={{ background: "var(--bg-tertiary)", color: "var(--text-secondary)" }}
              >
                Cancel
              </button>
              <button
                onClick={handleApply}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
                style={{ background: "var(--accent)", color: "white" }}
              >
                <ChevronRight size={14} />
                Move Files
              </button>
            </div>
          </div>
        </div>
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
