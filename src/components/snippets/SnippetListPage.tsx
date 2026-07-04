import { useState, useEffect } from "react";
import { useSnippetStore } from "@/stores/useSnippetStore";
import { useUIStore } from "@/stores/useUIStore";
import { useCategoryStore } from "@/stores/useCategoryStore";
import { SnippetRow } from "./SnippetRow";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Trash2,
  ArrowUpDown,
  Search,
  Inbox,
  FolderOpen,
} from "lucide-react";

export function SnippetListPage() {
  const {
    fetchSnippets,
    getFilteredSnippets,
    selectedIds,
    selectAll,
    clearSelection,
    searchQuery,
    filterFavorite,
    filterSource,
    setFilterSource,
    bulkDelete,
    bulkMove,
    isLoading,
    sortBy,
    sortOrder,
    setSort,
  } = useSnippetStore();

  const { viewMode, openEditor } = useUIStore();
  const { categories, fetchCategories } = useCategoryStore();

  const [isMoveDialogOpen, setIsMoveDialogOpen] = useState(false);
  const [targetCategoryId, setTargetCategoryId] = useState("");

  useEffect(() => {
    fetchSnippets();
  }, [fetchSnippets]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const snippets = getFilteredSnippets();
  const allIds = snippets.map((s) => s.id);

  const toggleSort = (by: "trigger" | "updated_at" | "category") => {
    if (sortBy === by) {
      setSort(by, sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSort(by, "asc");
    }
  };

  const SortHeader = ({
    label,
    field,
  }: {
    label: string;
    field: "trigger" | "updated_at" | "category";
  }) => (
    <button
      onClick={() => toggleSort(field)}
      className="sort-header flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
    >
      {label}
      <ArrowUpDown className="h-3 w-3" />
    </button>
  );

  if (isLoading) {
    return (
      <div className="snippets-page flex items-center justify-center h-full">
        <div className="loading-state flex flex-col items-center gap-3 text-muted-foreground">
          <div className="h-8 w-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
          <p className="text-sm">Loading snippets...</p>
        </div>
      </div>
    );
  }

  if (snippets.length === 0) {
    const icon = searchQuery || filterFavorite ? Search : Inbox;
    const Icon = icon;
    return (
      <div className="snippets-page all-snippets-page flex items-center justify-center h-full">
        <div className="empty-state flex flex-col items-center gap-4 text-muted-foreground max-w-xs text-center">
          <div className="rounded-full bg-muted p-4">
            <Icon className="h-8 w-8" />
          </div>
          <div className="space-y-1.5">
            <p className="text-sm font-medium text-foreground">
              {searchQuery
                ? "No snippets found"
                : filterFavorite
                  ? "No favorite snippets"
                  : "No snippets yet"}
            </p>
            <p className="text-xs text-muted-foreground/80">
              {searchQuery
                ? "Try a different search term"
                : filterFavorite
                  ? "Mark snippets as favorites to see them here"
                  : "Create your first snippet to get started"}
            </p>
          </div>
          {!searchQuery && !filterFavorite && (
            <Button
              variant="accent"
              size="sm"
              className="mt-1"
              onClick={() => openEditor("create")}
            >
              Create Snippet
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="snippets-page all-snippets-page p-4 space-y-4">
      {selectedIds.size > 0 && (
        <div className="selection-bar flex items-center gap-3 px-3 py-2.5 rounded-lg bg-muted/50 text-sm">
          <span className="text-muted-foreground text-xs">
            {selectedIds.size} selected
          </span>
          <div className="flex items-center gap-2 ml-auto">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={clearSelection}
            >
              Clear
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10"
              onClick={() => {
                if (categories.length > 0) {
                  setTargetCategoryId(categories[0].id);
                }
                setIsMoveDialogOpen(true);
              }}
            >
              <FolderOpen className="h-3.5 w-3.5 mr-1" />
              Move
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10"
              onClick={async () => {
                await bulkDelete(Array.from(selectedIds));
              }}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              Delete
            </Button>
          </div>
        </div>
      )}

      <div className="toolbar flex items-center gap-2">
        <div className="source-filter">
          <Select
            value={filterSource || "all"}
            onValueChange={(val) => setFilterSource(val === "all" ? null : val)}
          >
            <SelectTrigger className="w-[130px] h-8 text-xs">
              <SelectValue placeholder="All sources" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sources</SelectItem>
              <SelectItem value="local">Local</SelectItem>
              <SelectItem value="google_sheets">Google Sheets</SelectItem>
              <SelectItem value="github">GitHub</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {viewMode === "list" ? (
        <div className="snippet-table rounded-xl border border-border overflow-hidden">
          <div className="snippet-table-header grid grid-cols-[32px_0.8fr_1.2fr_110px_90px_110px_72px] gap-3 px-4 py-3 bg-muted/30 border-b border-border items-center">
            <Checkbox
              checked={selectedIds.size === snippets.length}
              onCheckedChange={(checked) => {
                if (checked) selectAll(allIds);
                else clearSelection();
              }}
            />
            <SortHeader label="Trigger" field="trigger" />
            <div className="text-xs font-medium text-muted-foreground">
              Replacement
            </div>
            <SortHeader label="Category" field="category" />
            <div className="text-xs font-medium text-muted-foreground">
              Source
            </div>
            <SortHeader label="Updated" field="updated_at" />
            <div className="w-[72px]" />
          </div>
          <div className="snippet-table-body divide-y divide-border">
            {snippets.map((snippet) => (
              <SnippetRow
                key={snippet.id}
                snippet={snippet}
                selected={selectedIds.has(snippet.id)}
                onSelect={() => useSnippetStore.getState().toggleSelect(snippet.id)}
                onEdit={() => openEditor("edit", snippet.id)}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="snippet-card-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {snippets.map((snippet) => (
            <SnippetRow
              key={snippet.id}
              snippet={snippet}
              selected={selectedIds.has(snippet.id)}
              onSelect={() => useSnippetStore.getState().toggleSelect(snippet.id)}
              onEdit={() => openEditor("edit", snippet.id)}
              grid
            />
          ))}
        </div>
      )}

      <Dialog open={isMoveDialogOpen} onOpenChange={setIsMoveDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Move Snippets</DialogTitle>
            <DialogDescription>
              Move {selectedIds.size} selected snippets to another category.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="move-category">Destination Category</Label>
              <Select value={targetCategoryId} onValueChange={setTargetCategoryId}>
                <SelectTrigger id="move-category">
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setIsMoveDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={async () => {
                if (targetCategoryId) {
                  await bulkMove(Array.from(selectedIds), targetCategoryId);
                  setIsMoveDialogOpen(false);
                }
              }}
            >
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
