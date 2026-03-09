import { useState, useEffect } from "react";
import { Bot, Key, Eye, EyeOff, Save, Shield, Loader2, Trash2, ChevronDown, ScanSearch, RotateCcw, Info } from "lucide-react";
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
  const [models, setModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState("");
  const [loadingModels, setLoadingModels] = useState(false);
  const [scanDepth, setScanDepth] = useState("5");
  const [scanExcludes, setScanExcludes] = useState("");
  const [scanMinSize, setScanMinSize] = useState("1");
  const [confidenceThreshold, setConfidenceThreshold] = useState("0");
  const [savedScanDepth, setSavedScanDepth] = useState("5");
  const [savedScanExcludes, setSavedScanExcludes] = useState("");

  useEffect(() => {
    // Load API key
    invoke<string | null>("load_setting", { key: "cloud_api_key" }).then((val) => {
      if (val) { setApiKey(val); setSavedKey(val); }
    }).catch(() => {});

    // Load license info
    invoke<LicenseInfo>("get_license_info").then(setLicense).catch(() => {});

    // Load saved model preference
    invoke<string | null>("load_setting", { key: "ai_model" }).then((val) => {
      if (val) setSelectedModel(val);
      else setSelectedModel("qwen3:4b");
    }).catch(() => setSelectedModel("qwen3:4b"));

    // Load scan settings
    invoke<string | null>("load_setting", { key: "scan_depth" }).then((val) => {
      if (val) { setScanDepth(val); setSavedScanDepth(val); }
    }).catch(() => {});
    invoke<string | null>("load_setting", { key: "scan_excludes" }).then((val) => {
      if (val) { setScanExcludes(val); setSavedScanExcludes(val); }
    }).catch(() => {});
    invoke<string | null>("load_setting", { key: "scan_min_size" }).then((val) => {
      if (val) setScanMinSize(val);
    }).catch(() => {});
    invoke<string | null>("load_setting", { key: "confidence_threshold" }).then((val) => {
      if (val) setConfidenceThreshold(val);
    }).catch(() => {});

    // Check Ollama status and load models
    invoke<{ status: string }>("check_ollama_status").then((s) => {
      setOllamaStatus(s.status as "running" | "not_installed" | "no_model");
      if (s.status === "running" || s.status === "no_model") {
        loadModels();
      }
    }).catch(() => {});
  }, [setOllamaStatus]);

  async function loadModels() {
    setLoadingModels(true);
    try {
      const list = await invoke<string[]>("list_ollama_models");
      setModels(list);
    } catch {
      setModels([]);
    }
    setLoadingModels(false);
  }

  async function handleModelChange(model: string) {
    setSelectedModel(model);
    try {
      await invoke("save_setting", { key: "ai_model", value: model });
      toast("success", `Model set to ${model}`);
    } catch (err) {
      toast("error", `Failed to save model: ${err}`);
    }
  }

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
            {loadingModels ? (
              <Loader2 size={14} className="animate-spin" style={{ color: "var(--text-secondary)" }} />
            ) : models.length > 0 ? (
              <div className="relative">
                <select
                  value={selectedModel}
                  onChange={(e) => handleModelChange(e.target.value)}
                  className="appearance-none text-sm font-mono pr-6 pl-2 py-1 rounded-lg border outline-none cursor-pointer"
                  style={{
                    background: "var(--bg-tertiary)",
                    borderColor: "var(--border)",
                    color: "var(--text-primary)",
                  }}
                >
                  {models.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
                <ChevronDown
                  size={12}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none"
                  style={{ color: "var(--text-secondary)" }}
                />
              </div>
            ) : (
              <span className="text-sm font-mono" style={{ color: "var(--text-primary)" }}>
                {selectedModel || "qwen3:4b"}
              </span>
            )}
          </div>
        </div>
      </section>

      {/* Scan Settings */}
      <section
        className="rounded-xl p-6 border mb-6"
        style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}
      >
        <div className="flex items-center gap-2 mb-4">
          <ScanSearch size={18} style={{ color: "var(--accent)" }} />
          <h2 className="font-semibold" style={{ color: "var(--text-primary)" }}>
            Scan Settings
          </h2>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-sm mb-1.5 block" style={{ color: "var(--text-secondary)" }}>
              Scan Depth (how many folder levels deep)
            </label>
            <select
              value={scanDepth}
              onChange={async (e) => {
                setScanDepth(e.target.value);
                await invoke("save_setting", { key: "scan_depth", value: e.target.value }).catch(() => {});
                setSavedScanDepth(e.target.value);
                toast("success", `Scan depth set to ${e.target.value}`);
              }}
              className="px-3 py-2 rounded-lg text-sm border outline-none"
              style={{ background: "var(--bg-tertiary)", borderColor: "var(--border)", color: "var(--text-primary)" }}
            >
              <option value="1">1 level</option>
              <option value="2">2 levels</option>
              <option value="3">3 levels</option>
              <option value="5">5 levels (default)</option>
              <option value="10">10 levels</option>
              <option value="999">Unlimited</option>
            </select>
          </div>

          <div>
            <label className="text-sm mb-1.5 block" style={{ color: "var(--text-secondary)" }}>
              Min File Size (skip small/temp files)
            </label>
            <select
              value={scanMinSize}
              onChange={async (e) => {
                setScanMinSize(e.target.value);
                await invoke("save_setting", { key: "scan_min_size", value: e.target.value }).catch(() => {});
                toast("success", "Min file size updated");
              }}
              className="px-3 py-2 rounded-lg text-sm border outline-none"
              style={{ background: "var(--bg-tertiary)", borderColor: "var(--border)", color: "var(--text-primary)" }}
            >
              <option value="1">No minimum (skip empty only)</option>
              <option value="100">100 bytes</option>
              <option value="1024">1 KB</option>
              <option value="10240">10 KB</option>
              <option value="102400">100 KB</option>
            </select>
          </div>

          <div>
            <label className="text-sm mb-1.5 block" style={{ color: "var(--text-secondary)" }}>
              Auto-reject Confidence Threshold
            </label>
            <select
              value={confidenceThreshold}
              onChange={async (e) => {
                setConfidenceThreshold(e.target.value);
                await invoke("save_setting", { key: "confidence_threshold", value: e.target.value }).catch(() => {});
                toast("success", "Confidence threshold updated");
              }}
              className="px-3 py-2 rounded-lg text-sm border outline-none"
              style={{ background: "var(--bg-tertiary)", borderColor: "var(--border)", color: "var(--text-primary)" }}
            >
              <option value="0">Disabled (approve all)</option>
              <option value="0.3">Below 30%</option>
              <option value="0.5">Below 50%</option>
              <option value="0.7">Below 70%</option>
              <option value="0.8">Below 80%</option>
            </select>
            <p className="text-xs mt-1.5" style={{ color: "var(--text-secondary)", opacity: 0.7 }}>
              Files below this confidence will be auto-rejected in scan results.
            </p>
          </div>

          <div>
            <label className="text-sm mb-1.5 block" style={{ color: "var(--text-secondary)" }}>
              Exclude Folders (comma-separated)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={scanExcludes}
                onChange={(e) => setScanExcludes(e.target.value)}
                placeholder="e.g. backups, old_files, temp"
                className="flex-1 px-3 py-2 rounded-lg text-sm border outline-none"
                style={{ background: "var(--bg-tertiary)", borderColor: "var(--border)", color: "var(--text-primary)" }}
              />
              <button
                onClick={async () => {
                  await invoke("save_setting", { key: "scan_excludes", value: scanExcludes.trim() }).catch(() => {});
                  setSavedScanExcludes(scanExcludes.trim());
                  toast("success", "Exclude patterns saved");
                }}
                disabled={scanExcludes === savedScanExcludes}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-opacity"
                style={{ background: "var(--accent)", color: "white", opacity: scanExcludes !== savedScanExcludes ? 1 : 0.5 }}
              >
                <Save size={14} />
                Save
              </button>
            </div>
            <p className="text-xs mt-1.5" style={{ color: "var(--text-secondary)", opacity: 0.7 }}>
              Hidden folders, node_modules, __pycache__, .git, target, dist, and build are always excluded.
            </p>
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

      {/* About & Data */}
      <section
        className="rounded-xl p-6 border mb-6"
        style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}
      >
        <div className="flex items-center gap-2 mb-4">
          <Info size={18} style={{ color: "var(--accent)" }} />
          <h2 className="font-semibold" style={{ color: "var(--text-primary)" }}>
            About & Data
          </h2>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm" style={{ color: "var(--text-secondary)" }}>Version</span>
            <span className="text-sm font-mono" style={{ color: "var(--text-primary)" }}>1.0.0</span>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm" style={{ color: "var(--text-secondary)" }}>Re-run Onboarding</span>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)", opacity: 0.7 }}>
                Show the welcome wizard again on next launch
              </p>
            </div>
            <button
              onClick={() => {
                localStorage.removeItem("cleardeskai_onboarded");
                toast("info", "Onboarding will show on next launch");
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
              style={{ background: "var(--bg-tertiary)", color: "var(--text-primary)" }}
            >
              <RotateCcw size={12} />
              Reset
            </button>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm" style={{ color: "var(--text-secondary)" }}>Open Source</span>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)", opacity: 0.7 }}>
                View source code on GitHub
              </p>
            </div>
            <button
              onClick={() => {
                import("@tauri-apps/plugin-shell").then(({ open }) => open("https://github.com/AdrienLgls/cleardeskai"));
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
              style={{ background: "var(--bg-tertiary)", color: "var(--accent)" }}
            >
              GitHub
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
