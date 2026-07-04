import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUIStore } from "@/stores/useUIStore";
import { useSnippetStore } from "@/stores/useSnippetStore";
import { useCategoryStore } from "@/stores/useCategoryStore";
import type { CreateSnippetInput, UpdateSnippetInput } from "@/types";

export function SnippetEditorDialog() {
  const { editorOpen, editorMode, editorSnippetId, closeEditor } = useUIStore();
  const { snippets, createSnippet, updateSnippet } = useSnippetStore();
  const { categories } = useCategoryStore();

  const [trigger, setTrigger] = useState("");
  const [replace, setReplace] = useState("");
  const [categoryId, setCategoryId] = useState("personal");
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const editingSnippet = editorMode === "edit" && editorSnippetId
    ? snippets.find((s) => s.id === editorSnippetId)
    : null;

  const { filterCategory } = useSnippetStore();

  useEffect(() => {
    setErrorMsg(null);
    if (editorMode === "edit" && editingSnippet) {
      setTrigger(editingSnippet.trigger);
      setReplace(editingSnippet.replace);
      setCategoryId(editingSnippet.category_id);
    } else {
      setTrigger("");
      setReplace("");
      setCategoryId(filterCategory && categories.some((c) => c.id === filterCategory)
        ? filterCategory
        : categories[0]?.id || "personal");
    }
  }, [editorMode, editingSnippet, editorOpen]);

  const handleSave = async () => {
    setErrorMsg(null);
    if (!trigger.trim() || !replace.trim()) return;

    setSaving(true);
    try {
      if (editorMode === "create") {
        const input: CreateSnippetInput = {
          trigger: trigger.trim(),
          replace,
          category_id: categoryId,
        };
        await createSnippet(input);
      } else if (editorSnippetId) {
        const input: UpdateSnippetInput = {
          trigger: trigger.trim(),
          replace,
          category_id: categoryId,
        };
        await updateSnippet(editorSnippetId, input);
      }
      closeEditor();
    } catch (err) {
      console.error("Failed to save snippet:", err);
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={editorOpen} onOpenChange={(open) => !open && closeEditor()}>
      <DialogContent className="sm:max-w-[540px]">
        <DialogHeader>
          <DialogTitle>
            {editorMode === "create" ? "New Snippet" : "Edit Snippet"}
          </DialogTitle>
          <DialogDescription>
            {editorMode === "create"
              ? "Create a new text expansion snippet"
              : "Edit your text expansion snippet"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {errorMsg && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400 font-medium">
              {errorMsg}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="trigger">Trigger</Label>
            <Input
              id="trigger"
              placeholder=":mytrigger"
              value={trigger}
              onChange={(e) => setTrigger(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="replace">Replacement</Label>
            <textarea
              id="replace"
              className="flex min-h-[120px] w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm font-mono shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y"
              placeholder="What should the trigger expand to?"
              value={replace}
              onChange={(e) => setReplace(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger id="category">
                <SelectValue />
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

          {replace && (
            <div className="space-y-2">
              <Label>Preview</Label>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <p className="text-sm whitespace-pre-wrap">{replace}</p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={closeEditor}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!trigger.trim() || !replace.trim() || saving}>
            {saving ? (
              <>
                <div className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin mr-2" />
                Saving...
              </>
            ) : (
              "Save Snippet"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
