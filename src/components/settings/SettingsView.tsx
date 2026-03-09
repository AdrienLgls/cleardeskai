import { useState, useEffect } from "react";
import { Bot, Key, Eye, EyeOff, Save } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { useAppStore } from "../../stores/appStore";
import { useToast } from "../toast/ToastProvider";
import { WatchPanel } from "../watch/WatchPanel";

export function SettingsView() {
  const { ollamaStatus } = useAppStore();
  const { toast } = useToast();
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [savedKey, setSavedKey] = useState("");

  useEffect(() => {
    invoke<string | null>("load_setting", { key: "cloud_api_key" }).then((val) => {
      if (val) {
        setApiKey(val);
        setSavedKey(val);
      }
    }).catch(() => {});
  }, []);

  async function handleSaveKey() {
    try {
      if (apiKey.trim()) {
        await invoke("save_setting", { key: "cloud_api_key", value: apiKey.trim() });
        setSavedKey(apiKey.trim());
        toast("success", "API key saved");
      } else {
        await invoke("remove_setting", { key: "cloud_api_key" });
        setSavedKey("");
        toast("info", "API key removed");
      }
    } catch (err) {
      toast("error", `Failed to save API key: ${err}`);
    }
  }

  const statusColors: Record<string, string> = {
    running: "var(--success)",
    not_installed: "var(--danger)",
    no_model: "var(--warning)",
    checking: "var(--text-secondary)",
    unknown: "var(--text-secondary)",
  };

  const statusLabels: Record<string, string> = {
    running: "Running",
    not_installed: "Not Installed",
    no_model: "No Model Downloaded",
    checking: "Checking...",
    unknown: "Unknown",
  };

  const keyChanged = apiKey !== savedKey;

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-6" style={{ color: "var(--text-primary)" }}>
        Settings
      </h1>

      {/* AI Engine */}
      <section
        className="rounded-xl p-6 border mb-6"
        style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}
      >
        <div className="flex items-center gap-2 mb-4">
          <Bot size={18} style={{ color: "var(--accent)" }} />
          <h2 className="font-semibold" style={{ color: "var(--text-primary)" }}>
            AI Engine
          </h2>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
              Ollama Status
            </span>
            <span
              className="text-sm font-medium px-2 py-0.5 rounded-full"
              style={{ color: statusColors[ollamaStatus] }}
            >
              {statusLabels[ollamaStatus]}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
              Model
            </span>
            <span className="text-sm font-mono" style={{ color: "var(--text-primary)" }}>
              qwen3:4b
            </span>
          </div>
        </div>
      </section>

      {/* Watch Mode */}
      <div className="mb-6">
        <WatchPanel />
      </div>

      {/* BYOK */}
      <section
        className="rounded-xl p-6 border mb-6"
        style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}
      >
        <div className="flex items-center gap-2 mb-4">
          <Key size={18} style={{ color: "var(--accent)" }} />
          <h2 className="font-semibold" style={{ color: "var(--text-primary)" }}>
            Cloud AI (Optional)
          </h2>
        </div>
        <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>
          Optionally use OpenAI or Claude for more powerful classification. Your API key stays local.
        </p>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-... or sk-ant-..."
              className="w-full px-3 py-2 rounded-lg text-sm border outline-none"
              style={{
                background: "var(--bg-tertiary)",
                borderColor: "var(--border)",
                color: "var(--text-primary)",
              }}
            />
            <button
              onClick={() => setShowKey(!showKey)}
              className="absolute right-2 top-1/2 -translate-y-1/2"
              style={{ color: "var(--text-secondary)" }}
            >
              {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
          <button
            onClick={handleSaveKey}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-opacity"
            style={{ background: "var(--accent)", color: "white", opacity: keyChanged ? 1 : 0.5 }}
            disabled={!keyChanged}
          >
            <Save size={14} />
            Save
          </button>
        </div>
      </section>
    </div>
  );
}
