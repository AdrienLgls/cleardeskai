import { create } from "zustand";

export interface FileInfo {
  path: string;
  name: string;
  extension: string;
  size: number;
  modified: string;
  mimeType: string;
  contentPreview?: string;
}

export interface Classification {
  file: FileInfo;
  proposedFolder: string;
  proposedName?: string;
  confidence: number;
  category: string;
  reasoning: string;
  approved: boolean;
}

export interface FileChange {
  source: string;
  destination: string;
  newName?: string;
  changeType: "move" | "rename" | "move_and_rename";
}

export interface Operation {
  id: string;
  timestamp: string;
  description: string;
  changes: FileChange[];
  undone: boolean;
}

interface Stats {
  filesOrganized: number;
  timeSavedMinutes: number;
  totalOperations: number;
}

interface ScanState {
  scanning: boolean;
  progress: number;
  totalFiles: number;
  scannedFiles: number;
  results: Classification[];
  selectedFolder: string | null;
}

interface AppState {
  stats: Stats;
  scan: ScanState;
  history: Operation[];
  ollamaStatus: "unknown" | "checking" | "running" | "not_installed" | "no_model";

  // Actions
  setScanFolder: (path: string) => void;
  startScan: () => void;
  setScanProgress: (scanned: number, total: number) => void;
  setScanResults: (results: Classification[]) => void;
  finishScan: () => void;
  toggleApproval: (index: number) => void;
  approveAll: () => void;
  rejectAll: () => void;
  addOperation: (op: Operation) => void;
  markUndone: (operationId: string) => void;
  loadHistory: (operations: Operation[]) => void;
  updateResult: (index: number, updates: Partial<Classification>) => void;
  resetScan: () => void;
  setOllamaStatus: (s: AppState["ollamaStatus"]) => void;
}

function computeStats(history: Operation[]): Stats {
  const active = history.filter((op) => !op.undone);
  const filesOrganized = active.reduce((sum, op) => sum + op.changes.length, 0);
  return {
    filesOrganized,
    totalOperations: active.length,
    timeSavedMinutes: Math.ceil(filesOrganized * 0.5),
  };
}

export const useAppStore = create<AppState>((set) => ({
  stats: { filesOrganized: 0, timeSavedMinutes: 0, totalOperations: 0 },
  scan: {
    scanning: false,
    progress: 0,
    totalFiles: 0,
    scannedFiles: 0,
    results: [],
    selectedFolder: null,
  },
  history: [],
  ollamaStatus: "unknown",

  setScanFolder: (path) =>
    set((s) => ({ scan: { ...s.scan, selectedFolder: path } })),

  startScan: () =>
    set((s) => ({
      scan: { ...s.scan, scanning: true, progress: 0, scannedFiles: 0, results: [] },
    })),

  setScanProgress: (scanned, total) =>
    set((s) => ({
      scan: {
        ...s.scan,
        scannedFiles: scanned,
        totalFiles: total,
        progress: total > 0 ? (scanned / total) * 100 : 0,
      },
    })),

  setScanResults: (results) =>
    set((s) => ({ scan: { ...s.scan, results } })),

  finishScan: () =>
    set((s) => ({ scan: { ...s.scan, scanning: false, progress: 100 } })),

  toggleApproval: (index) =>
    set((s) => {
      const results = [...s.scan.results];
      results[index] = { ...results[index], approved: !results[index].approved };
      return { scan: { ...s.scan, results } };
    }),

  approveAll: () =>
    set((s) => ({
      scan: {
        ...s.scan,
        results: s.scan.results.map((r) => ({ ...r, approved: true })),
      },
    })),

  rejectAll: () =>
    set((s) => ({
      scan: {
        ...s.scan,
        results: s.scan.results.map((r) => ({ ...r, approved: false })),
      },
    })),

  addOperation: (op) =>
    set((s) => {
      const history = [op, ...s.history];
      return { history, stats: computeStats(history) };
    }),

  markUndone: (operationId) =>
    set((s) => {
      const history = s.history.map((op) =>
        op.id === operationId ? { ...op, undone: true } : op
      );
      return { history, stats: computeStats(history) };
    }),

  loadHistory: (operations) =>
    set(() => ({
      history: operations,
      stats: computeStats(operations),
    })),

  updateResult: (index, updates) =>
    set((s) => {
      const results = [...s.scan.results];
      results[index] = { ...results[index], ...updates };
      return { scan: { ...s.scan, results } };
    }),

  resetScan: () =>
    set(() => ({
      scan: {
        scanning: false,
        progress: 0,
        totalFiles: 0,
        scannedFiles: 0,
        results: [],
        selectedFolder: null,
      },
    })),

  setOllamaStatus: (ollamaStatus) => set({ ollamaStatus }),
}));
