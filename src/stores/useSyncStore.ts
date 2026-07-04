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
  lastSyncAt: null,
  isConnected: false,
  syncHistory: [],
  isLoading: false,
  lastResult: null,
  errorMessage: null,

  syncNow: async () => {
    set({ syncStatus: "syncing", errorMessage: null });
    try {
      const result = await apiSyncNow();
      set({
        syncStatus: result.success ? "success" : "error",
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
    } catch (err) {
      set({
        syncStatus: "error",
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
