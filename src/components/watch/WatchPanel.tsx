import { useState, useEffect } from "react";
import { Eye, EyeOff, FolderPlus, Loader2, Trash2 } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import { useToast } from "../toast/ToastProvider";

export function WatchPanel() {
  const [running, setRunning] = useState(false);
  const [folders, setFolders] = useState<string[]>([]);
  const [interval, setIntervalVal] = useState(60);
  const [loading, setLoading] = useState(false);
  const [detectedCount, setDetectedCount] = useState(0);
  const { toast } = useToast();

  useEffect(() => {
    checkStatus();
    // Load saved watched folders
    invoke<string[]>("get_saved_watched_folders").then((saved) => {
      if (saved.length > 0) setFolders(saved);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const unlisten = listen<string[]>("watch-new-files", (event) => {
      const files = event.payload;
      setDetectedCount((prev) => prev + files.length);
      if (files.length === 1) {
        const name = files[0].split(/[/\\]/).pop() || files[0];
        toast("info", `New file detected: ${name}`);
      } else {
        toast("info", `${files.length} new files detected in watched folders`);
      }
    });
    return () => { unlisten.then((fn) => fn()); };
  }, [toast]);

  async function checkStatus() {
    try {
      const [isRunning, watchedFolders] = await invoke<[boolean, string[]]>("get_watch_status");
      setRunning(isRunning);
      setFolders(watchedFolders);
    } catch { /* not connected */ }
  }

  async function addFolder() {
    const selected = await open({ directory: true, multiple: false });
    if (selected && !folders.includes(selected as string)) {
      setFolders([...folders, selected as string]);
    }
  }

  function removeFolder(index: number) {
    const folder = folders[index];
    invoke("remove_watched_folder", { path: folder }).catch(() => {});
    setFolders(folders.filter((_, i) => i !== index));
  }

  async function toggleWatch() {
    setLoading(true);
    try {
      if (running) {
        await invoke("stop_watch");
        setRunning(false);
        setDetectedCount(0);
        toast("success", "Watch mode stopped");
      } else {
        if (folders.length === 0) { setLoading(false); return; }
        await invoke("start_watch", { folders, intervalSecs: interval });
        setRunning(true);
        toast("success", `Watching ${folders.length} folder(s)`);
      }
    } catch (err) {
      toast("error", `Watch mode error: ${err}`);
    }
    setLoading(false);
  }

  return (
    <section className="rounded-xl p-6 border" style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Eye size={18} style={{ color: "var(--accent)" }} />
          <h2 className="font-semibold" style={{ color: "var(--text-primary)" }}>Watch Mode</h2>
          {running && detectedCount > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "var(--accent)", color: "white" }}>
              {detectedCount} detected
            </span>
          )}
        </div>
        <button onClick={toggleWatch} disabled={loading || (!running && folders.length === 0)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: running ? "var(--danger)" : "var(--success)", color: "white", opacity: loading || (!running && folders.length === 0) ? 0.5 : 1 }}>
          {loading ? <Loader2 size={12} className="animate-spin" /> : running ? <EyeOff size={12} /> : <Eye size={12} />}
          {running ? "Stop" : "Start"}
        </button>
      </div>
      <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>
        {running ? `Monitoring ${folders.length} folder(s) every ${interval}s` : "Add folders to monitor for new files automatically."}
      </p>
      <div className="space-y-2 mb-4">
        {folders.map((folder, i) => (
          <div key={i} className="flex items-center justify-between rounded-lg px-3 py-2" style={{ background: "var(--bg-tertiary)" }}>
            <span className="text-sm font-mono truncate" style={{ color: "var(--text-primary)" }}>{folder}</span>
            <button onClick={() => removeFolder(i)} style={{ color: "var(--text-secondary)" }}><Trash2 size={14} /></button>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <button onClick={addFolder} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium" style={{ background: "var(--bg-tertiary)", color: "var(--text-primary)" }}>
          <FolderPlus size={14} /> Add Folder
        </button>
        <select value={interval} onChange={(e) => setIntervalVal(Number(e.target.value))} className="px-3 py-2 rounded-lg text-sm border outline-none" style={{ background: "var(--bg-tertiary)", borderColor: "var(--border)", color: "var(--text-primary)" }}>
          <option value={30}>Every 30s</option>
          <option value={60}>Every 60s</option>
          <option value={300}>Every 5m</option>
          <option value={600}>Every 10m</option>
        </select>
      </div>
    </section>
  );
}
