import { create } from "zustand";
import { fetchHubTools, type HubTool } from "@/lib/tauri";

interface ToolsStore {
  tools: HubTool[];
  isFetching: boolean;
  fetchTools: () => Promise<void>;
}

export const useToolsStore = create<ToolsStore>((set) => ({
  tools: (() => {
    try {
      const cached = localStorage.getItem("espander_tools_cache");
      const parsed = cached ? JSON.parse(cached) : [];
      return Array.isArray(parsed) ? parsed.filter((tool) => tool.active) : [];
    } catch {
      return [];
    }
  })(),
  isFetching: false,

  fetchTools: async () => {
    set({ isFetching: true });
    try {
      const res = await fetchHubTools();
      localStorage.setItem("espander_tools_cache", JSON.stringify(res.tools));
      set({
        tools: res.tools.filter((tool) => tool.active),
        isFetching: false,
      });
    } catch (error) {
      console.error("Failed to fetch hub tools:", error);
      set({ isFetching: false });
    }
  },
}));
