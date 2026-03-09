import { useState, useEffect } from "react";
import { Bot, Key, Eye, EyeOff, Save, Shield, Loader2, Trash2 } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { useAppStore } from "../../stores/appStore";
import { useToast } from "../toast/ToastProvider";
import { WatchPanel } from "../watch/WatchPanel";

interface LicenseInfo {
  tier: string;
  valid: boolean;
  scanLimit: number | null;
  folderLimit: number | null;
}

export function SettingsView() {
  const { ollamaStatus, setOllamaStatus } = useAppStore();
  const { toast } = useToast();
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [savedKey, setSavedKey] = useState("");
  const [licenseKey, setLicenseKey] = useState("");
  const [license, setLicense] = useState<LicenseInfo | null>(null);
  const [activating, setActivating] = useState(false);

  useEffect(() => {
    // Load API key
    invoke<string | null>("load_setting", { key: "cloud_api_key" }).then((val) => {
      if (val) { setApiKey(val); setSavedKey(val); }
    }).catch(() => {});

    // Load license info
    invoke<LicenseInfo>("get_license_info").then(setLicense).catch(() => {});

    // Check Ollama status
    invoke<{ status: string }>("check_ollama_status").then((s) => {
      setOllamaStatus(s.status as "running" | "not_installed" | "no_model");
    }).catch(() => {});
  }, [setOllamaStatus]);

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

  async function handleActivateLicense() {
    if (!licenseKey.trim()) return;
    setActivating(true);
    try {
      const info = await invoke<LicenseInfo>("activate_license", { key: licenseKey.trim() });
      setLicense(info);
      setLicenseKey("");
      toast("success", `License activated — ${info.tier} tier`);
    } catch (err) {
      toast("error", `${err}`);
    }
    setActivating(false);
  }

  async function handleDeactivateLicense() {
    try {
      await invoke("deactivate_license");
      setLicense({ tier: "free", valid: true, scanLimit: 50, folderLimit: 1 });
      toast("info", "License deactivated");
    } catch (err) {
      toast("error", `Failed to deactivate: ${err}`);
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

  const tierColors: Record<string, string> = {
    free: "var(--text-secondary)",
    pro: "var(--success)",
    premium: "var(--accent)",
  };

  const keyChanged = apiKey !== savedKey;

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-6" style={{ color: "var(--text-primary)" }}>
        Settings
      </h1>

      {/* License */}
      <section
        className="rounded-xl p-6 border mb-6"
        style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}
      >
        <div className="flex items-center gap-2 mb-4">
          <Shield size={18} style={{ color: "var(--accent)" }} />
          <h2 className="font-semibold" style={{ color: "var(--text-primary)" }}>
            License
          </h2>
          {license && (
            <span
              className="text-xs font-medium px-2 py-0.5 rounded-full uppercase"
              style={{ color: tierColors[license.tier] || "var(--text-secondary)" }}
            >
              {license.tier}
            </span>
          )}
        </div>

        {license && license.tier !== "free" ? (
          <div className="space-y-3">
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              Unlimited files and folders. All features unlocked.
            </p>
            <button
              onClick={handleDeactivateLicense}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
              style={{ background: "var(--bg-tertiary)", color: "var(--danger)" }}
            >
              <Trash2 size={12} />
              Deactivate License
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              Free tier: 50 files per scan, 1 folder. Upgrade to unlock unlimited.
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={licenseKey}
                onChange={(e) => setLicenseKey(e.target.value.toUpperCase())}
                placeholder="CDAI-PRO-XXXX-XXXX-XXXX"
                className="flex-1 px-3 py-2 rounded-lg text-sm border outline-none font-mono"
                style={{
                  background: "var(--bg-tertiary)",
                  borderColor: "var(--border)",
                  color: "var(--text-primary)",
                }}
              />
              <button
                onClick={handleActivateLicense}
                disabled={activating || !licenseKey.trim()}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium"
                style={{
                  background: "var(--accent)",
                  color: "white",
                  opacity: activating || !licenseKey.trim() ? 0.5 : 1,
                }}
              >
                {activating ? <Loader2 size={14} className="animate-spin" /> : <Key size={14} />}
                Activate
              </button>
            </div>
          </div>
        )}
      </section>

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
