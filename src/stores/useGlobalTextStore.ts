import { create } from "zustand";
import { fetchGlobalTexts, type GlobalTexts } from "@/lib/tauri";

export const defaultGlobalTexts: GlobalTexts = {
  more_tools_title: "More Tools",
  more_tools_subtitle: "Useful tools and products from Espander.",
  notifications_title: "Notifications",
  notifications_subtitle: "Messages and announcements from Espander.",
};

interface GlobalTextStore {
  texts: GlobalTexts;
  isFetching: boolean;
  fetchTexts: () => Promise<void>;
}

export const useGlobalTextStore = create<GlobalTextStore>((set) => ({
  texts: (() => {
    try {
      const cached = localStorage.getItem("espander_global_texts_cache");
      return cached ? { ...defaultGlobalTexts, ...JSON.parse(cached) } : defaultGlobalTexts;
    } catch {
      return defaultGlobalTexts;
    }
  })(),
  isFetching: false,

  fetchTexts: async () => {
    set({ isFetching: true });
    try {
      const texts = await fetchGlobalTexts();
      localStorage.setItem("espander_global_texts_cache", JSON.stringify(texts));
      set({ texts: { ...defaultGlobalTexts, ...texts }, isFetching: false });
    } catch (error) {
      console.error("Failed to fetch global texts:", error);
      set({ isFetching: false });
    }
  },
}));
