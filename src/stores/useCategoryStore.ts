import { create } from "zustand";
import type { Category } from "@/types";
import {
  getCategories as apiGetCategories,
  createCategory as apiCreateCategory,
  updateCategory as apiUpdateCategory,
  reorderCategories as apiReorderCategories,
  deleteCategory as apiDeleteCategory,
  moveSnippetsAndDeleteCategory as apiMoveAndDelete,
} from "@/lib/tauri";

interface CategoryStore {
  categories: Category[];
  isLoading: boolean;
  fetchCategories: () => Promise<void>;
  createCategory: (name: string) => Promise<Category>;
  updateCategory: (id: string, name: string) => Promise<Category>;
  reorderCategories: (ids: string[]) => Promise<Category[]>;
  deleteCategory: (id: string, deleteSnippets?: boolean) => Promise<void>;
  moveSnippetsAndDeleteCategory: (fromId: string, toId: string) => Promise<void>;
}

export const useCategoryStore = create<CategoryStore>((set) => ({
  categories: [],
  isLoading: false,

  fetchCategories: async () => {
    set({ isLoading: true });
    try {
      const categories = await apiGetCategories();
      set({ categories, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  createCategory: async (name) => {
    const category = await apiCreateCategory(name);
    set((state) => ({ categories: [...state.categories, category] }));
    return category;
  },

  updateCategory: async (id, name) => {
    const updated = await apiUpdateCategory(id, name);
    set((state) => ({
      categories: state.categories.map((c) =>
        c.id === id ? updated : c
      ),
    }));
    return updated;
  },

  reorderCategories: async (ids) => {
    const reordered = await apiReorderCategories(ids);
    set({ categories: reordered });
    return reordered;
  },

  deleteCategory: async (id, deleteSnippets) => {
    await apiDeleteCategory(id, deleteSnippets);
    set((state) => ({
      categories: state.categories.filter((c) => c.id !== id),
    }));
  },

  moveSnippetsAndDeleteCategory: async (fromId, toId) => {
    await apiMoveAndDelete(fromId, toId);
    set((state) => ({
      categories: state.categories.filter((c) => c.id !== fromId),
    }));
  },
}));
