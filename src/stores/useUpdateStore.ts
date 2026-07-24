import { create } from "zustand";
import {
  checkUpdatesAndAnnouncements,
  openBrowser,
  type Announcement,
  type UpdaterInfo
} from "@/lib/tauri";

interface UpdateStore {
  announcement: Announcement | null;
  updater: UpdaterInfo | null;
  currentVersion: string;
  isChecking: boolean;
  isUpdating: boolean;
  updateError: string | null;
  announcementDismissed: boolean;
  
  checkUpdates: () => Promise<void>;
  dismissAnnouncement: () => void;
  installUpdate: () => Promise<void>;
}

export const useUpdateStore = create<UpdateStore>((set, get) => ({
  announcement: null,
  updater: null,
  currentVersion: "0.1.1",
  isChecking: false,
  isUpdating: false,
  updateError: null,
  announcementDismissed: false,

  checkUpdates: async () => {
    set({ isChecking: true, updateError: null });
    try {
      const res = await checkUpdatesAndAnnouncements();
      set({
        announcement: res.announcement,
        updater: res.updater,
        currentVersion: res.current_version,
        isChecking: false
      });
    } catch (err) {
      console.error("Failed to check for updates:", err);
      set({ isChecking: false });
    }
  },

  dismissAnnouncement: () => {
    set({ announcementDismissed: true });
  },

  installUpdate: async () => {
    const { updater } = get();
    if (!updater) return;

    set({ isUpdating: true, updateError: null });
    try {
      await openBrowser(updater.github_releases_url);
      set({ isUpdating: false });
    } catch (err) {
      console.error("Failed to open release page:", err);
      set({
        isUpdating: false,
        updateError: err instanceof Error ? err.message : String(err)
      });
      throw err;
    }
  }
}));
