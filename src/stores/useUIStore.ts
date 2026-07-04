import { create } from "zustand";
import type { ViewMode } from "@/types";

interface UIStore {
  theme: "dark" | "light" | "system";
  sidebarOpen: boolean;
  activeView: "snippets" | "favorites" | "notifications" | "settings" | "sync";
  viewMode: ViewMode;
  editorOpen: boolean;
  editorMode: "create" | "edit";
  editorSnippetId: string | null;
  selectedNotificationId: string | null;

  setTheme: (theme: "dark" | "light" | "system") => void;
  toggleSidebar: () => void;
  setActiveView: (view: UIStore["activeView"]) => void;
  setViewMode: (mode: ViewMode) => void;
  openNotification: (id: string) => void;
  clearSelectedNotification: () => void;
  openEditor: (mode?: "create" | "edit", snippetId?: string | null) => void;
  closeEditor: () => void;
}

export const useUIStore = create<UIStore>((set) => ({
  theme: "dark",
  sidebarOpen: true,
  activeView: "snippets",
  viewMode: "list",
  editorOpen: false,
  editorMode: "create",
  editorSnippetId: null,
  selectedNotificationId: null,

  setTheme: (theme) => set({ theme }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setActiveView: (activeView) => set({ activeView }),
  setViewMode: (viewMode) => set({ viewMode }),
  openNotification: (id) => set({ activeView: "notifications", selectedNotificationId: id }),
  clearSelectedNotification: () => set({ selectedNotificationId: null }),
  openEditor: (mode = "create", snippetId = null) =>
    set({ editorOpen: true, editorMode: mode, editorSnippetId: snippetId }),
  closeEditor: () =>
    set({ editorOpen: false, editorMode: "create", editorSnippetId: null }),
}));
