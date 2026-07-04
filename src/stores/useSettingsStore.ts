import { create } from "zustand";
import type { Settings } from "@/types";
import { getSettings as apiGetSettings, updateSettings as apiUpdateSettings } from "@/lib/tauri";

interface SettingsStore {
  settings: Settings;
  isLoading: boolean;
  loadSettings: () => Promise<void>;
  updateSettings: (patch: Partial<Settings>) => Promise<void>;
}

const defaultSettings: Settings = {
  version: 1,
  theme: "dark",
  language: "en",
  espanso_path: null,
  espanso_config_dir: null,
  espanso_auto_detected: false,
  sync_provider: "local",
  sync_interval_minutes: 60,
  auto_sync: true,
  auto_reload: true,
  first_launch_complete: false,
  gsheet_csv_url: null,
  github_repo_url: null,
  github_username: null,
  github_repo_owner: null,
  github_repo_name: null,
  github_token: null,
  github_branch: "main",
  github_path: null,
};

export const useSettingsStore = create<SettingsStore>((set) => ({
  settings: defaultSettings,
  isLoading: false,

  loadSettings: async () => {
    set({ isLoading: true });
    try {
      const settings = await apiGetSettings();
      set({ settings, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  updateSettings: async (patch) => {
    const updated = await apiUpdateSettings(patch);
    set({ settings: updated });
  },
}));
