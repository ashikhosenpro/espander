import { useState, useEffect, type CSSProperties } from "react";
import { Eye, EyeOff } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [isProtected, setIsProtected] = useState(false);
  const [showProtectedValue, setShowProtectedValue] = useState(false);
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
      setIsProtected(editingSnippet.is_protected);
      setNotes(editingSnippet.notes || "");
    } else {
      setTrigger("");
      setReplace("");
      setCategoryId(filterCategory && categories.some((c) => c.id === filterCategory)
        ? filterCategory
        : categories[0]?.id || "personal");
      setIsProtected(false);
      setNotes("");
    }
    setShowProtectedValue(false);
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
          is_protected: isProtected,
          notes: notes.trim() || undefined,
        };
        await createSnippet(input);
      } else if (editorSnippetId) {
        const input: UpdateSnippetInput = {
          trigger: trigger.trim(),
          replace,
          category_id: categoryId,
          is_protected: isProtected,
          notes: notes.trim(),
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
      <DialogContent
        className="sm:max-w-[680px] max-h-[92vh] flex flex-col gap-0 overflow-hidden border-border/90 bg-card p-0 shadow-2xl"
        onEscapeKeyDown={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
      >
        <DialogHeader className="shrink-0 border-b border-border/70 px-6 py-5 pr-12">
          <div className="flex items-center justify-between gap-4">
            <DialogTitle className="text-xl">
              {editorMode === "create" ? "New Snippet" : "Edit Snippet"}
            </DialogTitle>
            <label htmlFor="mask-replacement" className="flex cursor-pointer items-center gap-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground">
              <EyeOff className="h-3.5 w-3.5 text-indigo-400" />
              <span>Mask replacement</span>
              <Switch
                id="mask-replacement"
                checked={isProtected}
                onCheckedChange={(checked) => {
                  setIsProtected(checked);
                  setShowProtectedValue(false);
                }}
              />
            </label>
          </div>
        </DialogHeader>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5 scrollbar-thin">
          {errorMsg && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400 font-medium">
              {errorMsg}
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(190px,0.65fr)]">
            <div className="space-y-2">
              <Label htmlFor="trigger">Trigger</Label>
              <Input
                id="trigger"
                autoFocus
                placeholder=":mytrigger"
                value={trigger}
                onChange={(e) => setTrigger(e.target.value)}
                className="h-11 border-border/90 bg-background/60 px-3.5 font-mono text-base shadow-inner focus-visible:border-indigo-400/80 focus-visible:ring-indigo-500/30"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger id="category" className="h-11 border-border/90 bg-background/60 px-3.5 shadow-inner focus:ring-indigo-500/30">
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
          </div>

          <div className="space-y-2">
            <Label htmlFor="replace">Replacement</Label>
            <div className="relative">
              <textarea
                id="replace"
                className="flex min-h-[230px] w-full resize-y rounded-xl border border-border/90 bg-background/60 px-4 py-3.5 pr-12 text-[15px] font-mono leading-relaxed shadow-inner placeholder:text-muted-foreground/70 focus-visible:border-indigo-400/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30"
                placeholder="What should the trigger expand to?"
                value={replace}
                onChange={(e) => setReplace(e.target.value)}
                style={isProtected && !showProtectedValue
                  ? ({ WebkitTextSecurity: "disc" } as CSSProperties)
                  : undefined}
              />
              {isProtected && (
                <button
                  type="button"
                  className="absolute right-3 top-3 text-muted-foreground transition-colors hover:text-foreground"
                  onClick={() => setShowProtectedValue((visible) => !visible)}
                  aria-label={showProtectedValue ? "Mask replacement" : "Show masked replacement"}
                >
                  {showProtectedValue ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Line breaks are preserved. Add <code className="font-mono">$|$</code> once to choose where the cursor lands after expansion.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <textarea
              id="notes"
              className="flex min-h-[88px] w-full resize-y rounded-xl border border-border/90 bg-background/60 px-4 py-3 text-sm leading-relaxed shadow-inner placeholder:text-muted-foreground/70 focus-visible:border-indigo-400/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30"
              placeholder="Add optional notes or documentation..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

        </div>

        <DialogFooter className="shrink-0 border-t border-border/70 bg-muted/10 px-6 py-4">
          <Button variant="outline" className="h-10 px-5" onClick={closeEditor}>
            Cancel
          </Button>
          <Button className="h-10 px-6" onClick={handleSave} disabled={!trigger.trim() || !replace.trim() || saving}>
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
