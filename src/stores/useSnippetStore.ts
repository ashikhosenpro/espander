import { create } from "zustand";
import type { Snippet, CreateSnippetInput, UpdateSnippetInput } from "@/types";
import { getSnippets as apiGetSnippets, createSnippet as apiCreateSnippet, updateSnippet as apiUpdateSnippet, deleteSnippet as apiDeleteSnippet, duplicateSnippet as apiDuplicateSnippet, toggleFavorite as apiToggleFavorite, bulkDeleteSnippets as apiBulkDelete, bulkMoveSnippets as apiBulkMove } from "@/lib/tauri";

interface SnippetStore {
  snippets: Snippet[];
  selectedIds: Set<string>;
  searchQuery: string;
  filterCategory: string | null;
  filterSource: string | null;
  filterFavorite: boolean;
  sortBy: "trigger" | "updated_at" | "category";
  sortOrder: "asc" | "desc";
  isLoading: boolean;

  fetchSnippets: () => Promise<void>;
  createSnippet: (input: CreateSnippetInput) => Promise<Snippet>;
  updateSnippet: (id: string, input: UpdateSnippetInput) => Promise<void>;
  deleteSnippet: (id: string) => Promise<void>;
  duplicateSnippet: (id: string) => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;
  bulkDelete: (ids: string[]) => Promise<void>;
  bulkMove: (ids: string[], categoryId: string) => Promise<void>;

  setSearch: (query: string) => void;
  setFilter: (category: string | null) => void;
  setFilterSource: (source: string | null) => void;
  setFilterFavorite: (val: boolean) => void;
  setSort: (by: "trigger" | "updated_at" | "category", order: "asc" | "desc") => void;
  toggleSelect: (id: string) => void;
  selectAll: (ids: string[]) => void;
  clearSelection: () => void;

  getFilteredSnippets: () => Snippet[];
}

export const useSnippetStore = create<SnippetStore>((set, get) => ({
  snippets: [],
  selectedIds: new Set(),
  searchQuery: "",
  filterCategory: null,
  filterSource: null,
  filterFavorite: false,
  sortBy: "updated_at",
  sortOrder: "desc",
  isLoading: false,

  fetchSnippets: async () => {
    set({ isLoading: true });
    try {
      const snippets = await apiGetSnippets();
      set({ snippets, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  createSnippet: async (input) => {
    const snippet = await apiCreateSnippet(input);
    set((state) => ({ snippets: [snippet, ...state.snippets] }));
    return snippet;
  },

  updateSnippet: async (id, input) => {
    const updated = await apiUpdateSnippet(id, input);
    set((state) => ({
      snippets: state.snippets.map((s) => (s.id === id ? updated : s)),
    }));
  },

  deleteSnippet: async (id) => {
    await apiDeleteSnippet(id);
    set((state) => ({
      snippets: state.snippets.filter((s) => s.id !== id),
      selectedIds: new Set([...state.selectedIds].filter((sid) => sid !== id)),
    }));
  },

  duplicateSnippet: async (id) => {
    const dup = await apiDuplicateSnippet(id);
    set((state) => ({ snippets: [dup, ...state.snippets] }));
  },

  toggleFavorite: async (id) => {
    const updated = await apiToggleFavorite(id);
    set((state) => ({
      snippets: state.snippets.map((s) => (s.id === id ? updated : s)),
    }));
  },

  bulkDelete: async (ids) => {
    await apiBulkDelete(ids);
    set((state) => ({
      snippets: state.snippets.filter((s) => !ids.includes(s.id)),
      selectedIds: new Set(),
    }));
  },

  bulkMove: async (ids, categoryId) => {
    await apiBulkMove(ids, categoryId);
    set((state) => ({
      snippets: state.snippets.map((s) =>
        ids.includes(s.id)
          ? {
              ...s,
              category_id: categoryId,
              sync_status: s.sync_status === "Synced" ? "Modified" : s.sync_status,
              updated_at: new Date().toISOString(),
            }
          : s
      ),
      selectedIds: new Set(),
    }));
  },

  setSearch: (query) => set({ searchQuery: query }),
  setFilter: (category) => set({ filterCategory: category }),
  setFilterSource: (source) => set({ filterSource: source }),
  setFilterFavorite: (val) => set({ filterFavorite: val }),
  setSort: (by, order) => set({ sortBy: by, sortOrder: order }),
  toggleSelect: (id) =>
    set((state) => {
      const next = new Set(state.selectedIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { selectedIds: next };
    }),
  selectAll: (ids) => set({ selectedIds: new Set(ids) }),
  clearSelection: () => set({ selectedIds: new Set() }),

  getFilteredSnippets: () => {
    const state = get();
    let result = [...state.snippets];

    if (state.searchQuery) {
      const q = state.searchQuery.toLowerCase();
      result = result.filter(
        (s) =>
          s.trigger.toLowerCase().includes(q) ||
          s.replace.toLowerCase().includes(q) ||
          s.category_id.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q)
      );
    }

    if (state.filterCategory) {
      result = result.filter((s) => s.category_id === state.filterCategory);
    }

    if (state.filterSource) {
      result = result.filter((s) => s.source === state.filterSource);
    }

    if (state.filterFavorite) {
      result = result.filter((s) => s.is_favorite);
    }

    result.sort((a, b) => {
      const dir = state.sortOrder === "asc" ? 1 : -1;
      if (state.sortBy === "trigger") return a.trigger.localeCompare(b.trigger) * dir;
      if (state.sortBy === "category") return a.category_id.localeCompare(b.category_id) * dir;
      return (new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime()) * dir;
    });

    return result;
  },
}));
