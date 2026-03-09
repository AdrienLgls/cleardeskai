import { useState, useEffect } from "react";
import { Eye, EyeOff, FolderPlus, Loader2, Trash2 } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";

export function WatchPanel() {
  const [running, setRunning] = useState(false);
  const [folders, setFolders] = useState<string[]>([]);
  const [interval, setIntervalVal] = useState(60);
  const [loading, setLoading] = useState(false);

  useEffect(() => { checkStatus(); }, []);

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

  function removeFolder(index: number) { setFolders(folders.filter((_, i) => i !== index)); }

  async function toggleWatch() {
    setLoading(true);
    try {
      if (running) {
        await invoke("stop_watch");
        setRunning(false);
      } else {
        if (folders.length === 0) { setLoading(false); return; }
        await invoke("start_watch", { folders, intervalSecs: interval });
        setRunning(true);
      }
    } catch (err) { console.error("Watch toggle failed:", err); }
    setLoading(false);
  }

  return (
    <section className="rounded-xl p-6 border" style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Eye size={18} style={{ color: "var(--accent)" }} />
          <h2 className="font-semibold" style={{ color: "var(--text-primary)" }}>Watch Mode</h2>
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
