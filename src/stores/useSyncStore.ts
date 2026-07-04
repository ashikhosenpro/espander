import { create } from "zustand";
import type { SyncStatus, SyncMeta } from "@/types";
import { syncNow as apiSyncNow, getSyncStatus as apiGetSyncStatus } from "@/lib/tauri";

interface SyncDetails {
  imported: number;
  updated: number;
  deleted: number;
  source: string;
}

interface SyncStore {
  syncStatus: SyncStatus;
  syncProgress: number;
  lastSyncAt: string | null;
  isConnected: boolean;
  syncHistory: SyncMeta["sync_history"];
  isLoading: boolean;
  lastResult: SyncDetails | null;
  errorMessage: string | null;

  syncNow: () => Promise<void>;
  loadStatus: () => Promise<void>;
  setSyncStatus: (status: SyncStatus) => void;
}

export const useSyncStore = create<SyncStore>((set) => ({
  syncStatus: "idle",
  syncProgress: 0,
  lastSyncAt: null,
  isConnected: false,
  syncHistory: [],
  isLoading: false,
  lastResult: null,
  errorMessage: null,

  syncNow: async () => {
    set({ syncStatus: "syncing", syncProgress: 10, errorMessage: null });
    try {
      set({ syncProgress: 35 });
      const result = await apiSyncNow();
      set({ syncProgress: 75 });
      set({
        syncStatus: result.success ? "success" : "error",
        syncProgress: result.success ? 90 : 0,
        lastSyncAt: new Date().toISOString(),
        errorMessage: result.success ? null : result.message,
        lastResult: {
          imported: result.snippets_pulled,
          updated: result.snippets_pushed,
          deleted: result.conflicts,
          source: result.message.includes("Local") ? "Local" : result.message.includes("Sheets") ? "Google Sheets" : "GitHub",
        },
      });
      // Reload local stores because GitHub YAML files can introduce new categories.
      const { useSnippetStore } = await import("@/stores/useSnippetStore");
      const { useCategoryStore } = await import("@/stores/useCategoryStore");
      await Promise.all([
        useCategoryStore.getState().fetchCategories(),
        useSnippetStore.getState().fetchSnippets(),
      ]);
      set({ syncProgress: result.success ? 100 : 0 });
    } catch (err) {
      set({
        syncStatus: "error",
        syncProgress: 0,
        errorMessage: err instanceof Error ? err.message : String(err),
      });
    }
  },

  loadStatus: async () => {
    set({ isLoading: true });
    try {
      const meta = await apiGetSyncStatus();
      set({
        syncStatus: meta.last_sync_status === "success" ? "success" : "idle",
        lastSyncAt: meta.last_sync_at,
        syncHistory: meta.sync_history,
        isConnected: meta.last_sync_status !== "error",
        isLoading: false,
      });
    } catch {
      set({ isLoading: false, syncStatus: "error", isConnected: false });
    }
  },

  setSyncStatus: (status) => set({ syncStatus: status }),
}));
