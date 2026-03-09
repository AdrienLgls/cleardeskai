import { useState } from "react";
import { Sparkles, Download, CheckCircle, XCircle, Loader2, ArrowRight, FolderOpen } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { useAppStore } from "../../stores/appStore";

type Step = "welcome" | "check_ollama" | "download_model" | "select_folder" | "ready";

interface OnboardingProps {
  onComplete: () => void;
}

export function OnboardingView({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState<Step>("welcome");
  const { ollamaStatus, setOllamaStatus } = useAppStore();
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

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

  return (
    <div className="flex items-center justify-center h-screen w-screen" style={{ background: "var(--bg-primary)" }}>
      <div className="max-w-lg w-full px-8">

        {step === "welcome" && (
          <div className="text-center">
            <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6" style={{ background: "var(--bg-tertiary)" }}>
              <Sparkles size={40} style={{ color: "var(--accent)" }} />
            </div>
            <h1 className="text-3xl font-bold mb-3" style={{ color: "var(--text-primary)" }}>Welcome to ClearDeskAI</h1>
            <p className="text-lg mb-8" style={{ color: "var(--text-secondary)" }}>Your files, organized by AI — 100% private, 100% local.</p>
            <p className="mb-8 text-sm" style={{ color: "var(--text-secondary)" }}>ClearDeskAI uses a local AI model to intelligently sort your files. Nothing leaves your computer — ever.</p>
            <button onClick={checkOllama} className="flex items-center gap-2 mx-auto px-6 py-3 rounded-xl font-semibold text-white transition-all hover:scale-105" style={{ background: "var(--accent)" }}>
              Get Started <ArrowRight size={18} />
            </button>
          </div>
        )}

        {step === "check_ollama" && (
          <div className="text-center">
            {ollamaStatus === "checking" && (
              <>
                <Loader2 size={48} className="animate-spin mx-auto mb-6" style={{ color: "var(--accent)" }} />
                <h2 className="text-xl font-semibold mb-2" style={{ color: "var(--text-primary)" }}>Checking AI Engine...</h2>
                <p style={{ color: "var(--text-secondary)" }}>Looking for Ollama on your system.</p>
              </>
            )}
            {ollamaStatus === "not_installed" && (
              <>
                <XCircle size={48} className="mx-auto mb-6" style={{ color: "var(--danger)" }} />
                <h2 className="text-xl font-semibold mb-2" style={{ color: "var(--text-primary)" }}>Ollama Not Found</h2>
                <p className="mb-6" style={{ color: "var(--text-secondary)" }}>ClearDeskAI needs Ollama to run AI locally. Install it first, then come back.</p>
                <div className="rounded-xl p-4 mb-6 text-left" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
                  <p className="text-sm font-mono mb-2" style={{ color: "var(--text-primary)" }}># Install Ollama:</p>
                  <p className="text-sm font-mono" style={{ color: "var(--accent)" }}>curl -fsSL https://ollama.com/install.sh | sh</p>
                  <p className="text-xs mt-2" style={{ color: "var(--text-secondary)" }}>Or visit ollama.com for Windows/Mac installers</p>
                </div>
                <button onClick={checkOllama} className="px-6 py-3 rounded-xl font-semibold text-white" style={{ background: "var(--accent)" }}>Check Again</button>
              </>
            )}
          </div>
        )}

        {step === "download_model" && (
          <div className="text-center">
            <Download size={48} className="mx-auto mb-6" style={{ color: "var(--warning)" }} />
            <h2 className="text-xl font-semibold mb-2" style={{ color: "var(--text-primary)" }}>Download AI Model</h2>
            <p className="mb-6" style={{ color: "var(--text-secondary)" }}>Ollama is installed but the AI model (Qwen3 4B, ~2.5GB) needs to be downloaded. This is a one-time setup.</p>
            {downloadError && <div className="rounded-lg p-3 mb-4 text-sm" style={{ background: "var(--danger)", color: "white" }}>{downloadError}</div>}
            <button onClick={downloadModel} disabled={downloading} className="flex items-center gap-2 mx-auto px-6 py-3 rounded-xl font-semibold text-white" style={{ background: downloading ? "var(--text-secondary)" : "var(--success)" }}>
              {downloading ? (<><Loader2 size={18} className="animate-spin" /> Downloading...</>) : (<><Download size={18} /> Download Model</>)}
            </button>
          </div>
        )}

        {step === "select_folder" && (
          <div className="text-center">
            <CheckCircle size={48} className="mx-auto mb-6" style={{ color: "var(--success)" }} />
            <h2 className="text-xl font-semibold mb-2" style={{ color: "var(--text-primary)" }}>AI Engine Ready!</h2>
            <p className="mb-8" style={{ color: "var(--text-secondary)" }}>You're all set. ClearDeskAI is ready to organize your files.</p>
            <button onClick={() => setStep("ready")} className="flex items-center gap-2 mx-auto px-6 py-3 rounded-xl font-semibold text-white transition-all hover:scale-105" style={{ background: "var(--accent)" }}>
              Let's Go <ArrowRight size={18} />
            </button>
          </div>
        )}

        {step === "ready" && (
          <div className="text-center">
            <Sparkles size={48} className="mx-auto mb-6" style={{ color: "var(--accent)" }} />
            <h2 className="text-2xl font-bold mb-4" style={{ color: "var(--text-primary)" }}>You're Ready!</h2>
            <p className="mb-8" style={{ color: "var(--text-secondary)" }}>Head to Scan & Organize to sort your first folder.</p>
            <button onClick={onComplete} className="flex items-center gap-2 mx-auto px-8 py-3 rounded-xl font-semibold text-white transition-all hover:scale-105" style={{ background: "var(--accent)" }}>
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
