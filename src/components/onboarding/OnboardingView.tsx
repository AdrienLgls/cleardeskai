import { useState } from "react";
import { Sparkles, Download, CheckCircle, Loader2, ArrowRight, FolderOpen } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { platform } from "@tauri-apps/plugin-os";
import { useAppStore } from "../../stores/appStore";

type Step = "welcome" | "check_ollama" | "download_model" | "select_folder" | "ready";
type Platform = "windows" | "macos" | "linux";

interface OnboardingProps {
  onComplete: () => void;
}

export function OnboardingView({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState<Step>("welcome");
  const { ollamaStatus, setOllamaStatus } = useAppStore();
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [installingOllama, setInstallingOllama] = useState(false);
  const [installPhase, setInstallPhase] = useState("");
  const [os] = useState<Platform>(() => {
    try {
      const p = platform();
      if (p === "windows") return "windows";
      if (p === "macos") return "macos";
      return "linux";
    } catch {
      return "linux";
    }
  });

  async function checkOllama() {
    setStep("check_ollama");
    setOllamaStatus("checking");
    try {
      const status = await invoke<{ status: string; model: string | null; version: string | null }>("check_ollama_status");
      setOllamaStatus(status.status as "running" | "not_installed" | "no_model");
      if (status.status === "running") {
        setStep("select_folder");
      } else if (status.status === "no_model") {
        setStep("download_model");
      }
    } catch {
      setOllamaStatus("not_installed");
    }
  }

  async function downloadModel() {
    setDownloading(true);
    setDownloadError(null);
    try {
      await invoke("setup_ollama");
      setOllamaStatus("running");
      setStep("select_folder");
    } catch (err) {
      setDownloadError(String(err));
    }
    setDownloading(false);
  }

  async function handleInstallOllama() {
    setInstallingOllama(true);
    setInstallPhase("Downloading Ollama...");
    setDownloadError(null);

    const unlisten = await listen<{ phase: string; message: string }>(
      "ollama-install-progress",
      (event) => setInstallPhase(event.payload.message)
    );

    try {
      await invoke("install_ollama");
      setOllamaStatus("running");
      setStep("select_folder");
    } catch (err) {
      setDownloadError(String(err));
    }
    unlisten();
    setInstallingOllama(false);
    setInstallPhase("");
  }

  return (
    <div className="flex items-center justify-center h-screen w-screen relative overflow-hidden" style={{ background: "var(--bg-primary)" }}>
      {/* Background glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] opacity-30 pointer-events-none" style={{ background: "radial-gradient(ellipse at center, rgba(108, 92, 231, 0.2) 0%, transparent 70%)" }} />
      <div className="max-w-lg w-full px-8 relative z-10">

        {step === "welcome" && (
          <div className="text-center animate-fade-in">
            <div
              className="w-24 h-24 rounded-3xl flex items-center justify-center mx-auto mb-8 animate-bounce-in"
              style={{ background: "linear-gradient(135deg, var(--accent), var(--accent-hover))", boxShadow: "0 8px 32px rgba(108, 92, 231, 0.4)" }}
            >
              <Sparkles size={44} style={{ color: "white" }} />
            </div>
            <h1 className="text-4xl font-extrabold mb-3" style={{ color: "var(--text-primary)" }}>Welcome to ClearDeskAI</h1>
            <p className="text-lg mb-4" style={{ color: "var(--text-secondary)" }}>Your files, organized by AI — 100% private, 100% local.</p>
            <p className="mb-10 text-sm max-w-sm mx-auto" style={{ color: "var(--text-secondary)" }}>ClearDeskAI uses a local AI model to intelligently sort your files. Nothing leaves your computer — ever.</p>
            <button onClick={checkOllama} className="flex items-center gap-2 mx-auto px-8 py-3.5 rounded-xl font-semibold text-white btn-press" style={{ background: "linear-gradient(135deg, var(--accent), var(--accent-hover))", boxShadow: "0 4px 16px rgba(108, 92, 231, 0.3)" }}>
              Get Started <ArrowRight size={18} />
            </button>
          </div>
        )}

        {step === "check_ollama" && (
          <div className="text-center animate-fade-in">
            {ollamaStatus === "checking" && (
              <>
                <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6" style={{ background: "var(--bg-tertiary)" }}>
                  <Loader2 size={36} className="animate-spin" style={{ color: "var(--accent)" }} />
                </div>
                <h2 className="text-xl font-semibold mb-2" style={{ color: "var(--text-primary)" }}>Checking AI Engine...</h2>
                <p style={{ color: "var(--text-secondary)" }}>Looking for Ollama on your system.</p>
              </>
            )}
            {ollamaStatus === "not_installed" && (
              <>
                <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6" style={{ background: installingOllama ? "rgba(108, 92, 231, 0.1)" : "rgba(255, 169, 77, 0.1)" }}>
                  {installingOllama ? (
                    <Loader2 size={36} className="animate-spin" style={{ color: "var(--accent)" }} />
                  ) : (
                    <Download size={36} style={{ color: "var(--warning)" }} />
                  )}
                </div>
                <h2 className="text-xl font-semibold mb-2" style={{ color: "var(--text-primary)" }}>
                  {installingOllama ? "Installing Ollama..." : "Install AI Engine"}
                </h2>
                <p className="mb-6 text-sm max-w-sm mx-auto" style={{ color: "var(--text-secondary)" }}>
                  {installingOllama
                    ? installPhase
                    : "ClearDeskAI can classify most files instantly by rules. Install Ollama for AI-powered classification of ambiguous files."}
                </p>
                {downloadError && (
                  <div className="rounded-xl p-3 mb-4 text-sm max-w-sm mx-auto" style={{ background: "rgba(255, 107, 107, 0.1)", color: "var(--danger)", border: "1px solid rgba(255, 107, 107, 0.2)" }}>
                    {downloadError}
                  </div>
                )}
                {!installingOllama && (
                  <div className="flex flex-col items-center gap-3">
                    <button
                      onClick={handleInstallOllama}
                      className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-white btn-press"
                      style={{ background: "linear-gradient(135deg, var(--accent), var(--accent-hover))", boxShadow: "0 4px 16px rgba(108, 92, 231, 0.3)" }}
                    >
                      <Download size={18} />
                      Install Ollama Automatically
                    </button>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => {
                          const url = os === "windows" ? "https://ollama.com/download/windows" : os === "macos" ? "https://ollama.com/download/mac" : "https://ollama.com/download/linux";
                          import("@tauri-apps/plugin-shell").then(({ open }) => open(url));
                        }}
                        className="text-xs font-medium btn-press"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        Manual Install
                      </button>
                      <span style={{ color: "var(--border)" }}>·</span>
                      <button
                        onClick={() => { setStep("select_folder"); }}
                        className="text-xs font-medium btn-press"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        Skip (use rules only)
                      </button>
                      <span style={{ color: "var(--border)" }}>·</span>
                      <button onClick={checkOllama} className="text-xs font-medium btn-press" style={{ color: "var(--text-secondary)" }}>
                        Check Again
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {step === "download_model" && (
          <div className="text-center animate-fade-in">
            <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6" style={{ background: "rgba(255, 169, 77, 0.1)" }}>
              <Download size={36} style={{ color: "var(--warning)" }} />
            </div>
            <h2 className="text-xl font-semibold mb-2" style={{ color: "var(--text-primary)" }}>Download AI Model</h2>
            <p className="mb-6 text-sm max-w-sm mx-auto" style={{ color: "var(--text-secondary)" }}>Ollama is installed but the AI model (Qwen3 4B, ~2.5GB) needs to be downloaded. This is a one-time setup.</p>
            {downloading && (
              <div className="w-full h-2 rounded-full overflow-hidden mb-4" style={{ background: "var(--bg-tertiary)" }}>
                <div className="h-full rounded-full progress-shimmer" style={{ width: "60%" }} />
              </div>
            )}
            {downloadError && <div className="rounded-xl p-3 mb-4 text-sm" style={{ background: "rgba(255, 107, 107, 0.1)", color: "var(--danger)", border: "1px solid rgba(255, 107, 107, 0.2)" }}>{downloadError}</div>}
            <button onClick={downloadModel} disabled={downloading} className="flex items-center gap-2 mx-auto px-6 py-3 rounded-xl font-semibold text-white btn-press" style={{ background: downloading ? "var(--text-secondary)" : "linear-gradient(135deg, var(--success), #00b894)", boxShadow: downloading ? "none" : "0 4px 16px rgba(0, 210, 160, 0.3)" }}>
              {downloading ? (<><Loader2 size={18} className="animate-spin" /> Downloading...</>) : (<><Download size={18} /> Download Model</>)}
            </button>
          </div>
        )}

        {step === "select_folder" && (
          <div className="text-center animate-fade-in">
            <div
              className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 animate-bounce-in"
              style={{ background: "linear-gradient(135deg, var(--success), #00b894)", boxShadow: "0 8px 32px rgba(0, 210, 160, 0.3)" }}
            >
              <CheckCircle size={36} style={{ color: "white" }} />
            </div>
            <h2 className="text-xl font-semibold mb-2" style={{ color: "var(--text-primary)" }}>AI Engine Ready!</h2>
            <p className="mb-8" style={{ color: "var(--text-secondary)" }}>You're all set. ClearDeskAI is ready to organize your files.</p>
            <button onClick={() => setStep("ready")} className="flex items-center gap-2 mx-auto px-8 py-3.5 rounded-xl font-semibold text-white btn-press" style={{ background: "linear-gradient(135deg, var(--accent), var(--accent-hover))", boxShadow: "0 4px 16px rgba(108, 92, 231, 0.3)" }}>
              Let's Go <ArrowRight size={18} />
            </button>
          </div>
        )}

        {step === "ready" && (
          <div className="text-center animate-fade-in">
            <div
              className="w-24 h-24 rounded-3xl flex items-center justify-center mx-auto mb-8 animate-bounce-in"
              style={{ background: "linear-gradient(135deg, var(--accent), var(--accent-hover))", boxShadow: "0 8px 32px rgba(108, 92, 231, 0.4)" }}
            >
              <Sparkles size={44} style={{ color: "white" }} />
            </div>
            <h2 className="text-2xl font-bold mb-4" style={{ color: "var(--text-primary)" }}>You're Ready!</h2>
            <p className="mb-8" style={{ color: "var(--text-secondary)" }}>Head to Scan & Organize to sort your first folder.</p>
            <button onClick={onComplete} className="flex items-center gap-2 mx-auto px-8 py-3.5 rounded-xl font-semibold text-white btn-press" style={{ background: "linear-gradient(135deg, var(--accent), var(--accent-hover))", boxShadow: "0 4px 16px rgba(108, 92, 231, 0.3)" }}>
              <FolderOpen size={18} /> Start Organizing
            </button>
          </div>
        )}

        <div className="flex justify-center gap-2 mt-12">
          {(["welcome", "check_ollama", "download_model", "select_folder", "ready"] as Step[]).map((s) => (
            <div key={s} className="h-2 rounded-full transition-all" style={{ background: step === s ? "var(--accent)" : "var(--border)", width: step === s ? 24 : 8 }} />
          ))}
        </div>
      </div>
    </div>
  );
}
