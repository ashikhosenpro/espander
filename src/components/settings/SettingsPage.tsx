import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { useCategoryStore } from "@/stores/useCategoryStore";
import { useSnippetStore } from "@/stores/useSnippetStore";
import {
  getPermissionStatus,
  importSnippets,
  exportSnippets,
  readAboutPage,
  readDocsPage,
  openBrowser,
  openPermissionSettings,
  testGithubConnection,
} from "@/lib/tauri";
import type { PermissionCheck } from "@/types";
import { open as openFileDialog, save as saveFileDialog } from "@tauri-apps/plugin-dialog";
import {
  Settings,
  Terminal,
  Cloud,
  Database,
  Download,
  Upload,
  Info,
  Sun,
  Moon,
  Monitor,
  CheckCircle2,
  AlertCircle,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  Folder,
  BookOpen,
  ArrowUpCircle,
  RefreshCw,
  RotateCcw,
  ExternalLink,
  GripVertical,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUpdateStore } from "@/stores/useUpdateStore";

export function SettingsPage() {
  const { settings, updateSettings } = useSettingsStore();
  const { categories, fetchCategories, createCategory, updateCategory, reorderCategories, deleteCategory, moveSnippetsAndDeleteCategory } = useCategoryStore();
  const { fetchSnippets } = useSnippetStore();
  const [localPath, setLocalPath] = useState(settings.espanso_path || "");
  const [pathMessage, setPathMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editingCatName, setEditingCatName] = useState("");
  const [newCatName, setNewCatName] = useState("");
  const [aboutHtml, setAboutHtml] = useState<string | null>(null);
  const [docsHtml, setDocsHtml] = useState<string | null>(null);
  const [showGithubDocs, setShowGithubDocs] = useState(false);
  const [permissions, setPermissions] = useState<PermissionCheck[]>([]);
  const [permissionsLoading, setPermissionsLoading] = useState(false);
  const [draggedCatId, setDraggedCatId] = useState<string | null>(null);
  const [dataMessage, setDataMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const { updater, currentVersion, isChecking, isUpdating, checkUpdates, installUpdate } = useUpdateStore();
  const [localErrorMsg, setLocalErrorMsg] = useState<string | null>(null);
  const [showFallback, setShowFallback] = useState(false);

  const handleInstallUpdate = async () => {
    setLocalErrorMsg(null);
    setShowFallback(false);
    try {
      await installUpdate();
    } catch (err) {
      setLocalErrorMsg(err instanceof Error ? err.message : String(err));
      setShowFallback(true);
    }
  };

  const handleRunOnboarding = async () => {
    await updateSettings({ first_launch_complete: false });
  };

  const [deleteSafetyOpen, setDeleteSafetyOpen] = useState(false);
  const [catToDelete, setCatToDelete] = useState<string | null>(null);
  const [snippetsCountInCat, setSnippetsCountInCat] = useState(0);
  const [moveDestCatId, setMoveDestCatId] = useState("");

  // GitHub Integration Hooks and States (Manual Token Flow)
  const [githubRepoUrl, setGithubRepoUrl] = useState(settings.github_repo_url || "");
  const [githubToken, setGithubToken] = useState(settings.github_token || "");

  const [testResult, setTestResult] = useState<{ success: boolean; message: string; default_branch?: string } | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [isConnectingState, setIsConnectingState] = useState(false);

  const showDataMessage = (type: "success" | "error", text: string) => {
    setDataMessage({ type, text });
    setTimeout(() => setDataMessage(null), 5000);
  };

  useEffect(() => {
    setGithubRepoUrl(settings.github_repo_url || "");
    setGithubToken(settings.github_token || "");
  }, [settings.github_repo_url, settings.github_token]);

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await testGithubConnection(githubRepoUrl, githubToken);
      setTestResult(res);
      return res;
    } catch (err) {
      const errorResult = {
        success: false,
        message: err instanceof Error ? err.message : String(err),
        default_branch: undefined,
      };
      setTestResult(errorResult);
      return errorResult;
    } finally {
      setIsTesting(false);
    }
  };

  const handleConnect = async () => {
    setIsConnectingState(true);
    setTestResult(null);
    try {
      const res = await handleTestConnection();
      if (res && res.success) {
        await updateSettings({
          github_repo_url: githubRepoUrl,
          github_token: githubToken,
          github_branch: res.default_branch || "main",
          sync_provider: "github",
        });
      }
    } catch (err) {
      setTestResult({
        success: false,
        message: `Connection failed: ${err instanceof Error ? err.message : String(err)}`,
      });
    } finally {
      setIsConnectingState(false);
    }
  };

  const handleDisconnect = async () => {
    setTestResult(null);
    await updateSettings({
      github_repo_url: null,
      github_token: null,
      github_branch: "main",
      github_repo_owner: null,
      github_repo_name: null,
      github_username: null,
      sync_provider: "local",
    });
  };

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const refreshPermissions = async () => {
    setPermissionsLoading(true);
    try {
      const result = await getPermissionStatus();
      setPermissions(result);
    } finally {
      setPermissionsLoading(false);
    }
  };

  useEffect(() => {
    refreshPermissions();
  }, [settings.espanso_config_dir]);

  useEffect(() => {
    readAboutPage().then(setAboutHtml);
  }, []);

  useEffect(() => {
    readDocsPage().then(setDocsHtml);
  }, []);

  useEffect(() => {
    setLocalPath(settings.espanso_path || "");
  }, [settings.espanso_path]);

  const handleUpdatePath = async () => {
    try {
      await updateSettings({ espanso_path: localPath || null });
      setPathMessage({ type: "success", text: "Path updated successfully" });
    } catch {
      setPathMessage({ type: "error", text: "Failed to update path" });
    }
    setTimeout(() => setPathMessage(null), 3000);
  };

  const startCatRename = (id: string, name: string) => {
    setEditingCatId(id);
    setEditingCatName(name);
  };

  const confirmCatRename = async () => {
    if (editingCatId && editingCatName.trim()) {
      await updateCategory(editingCatId, editingCatName.trim());
    }
    setEditingCatId(null);
    setEditingCatName("");
  };

  const handleAddCategory = async () => {
    if (newCatName.trim()) {
      await createCategory(newCatName.trim());
      setNewCatName("");
    }
  };

  const moveCategory = async (id: string, direction: -1 | 1) => {
    const currentIndex = categories.findIndex((cat) => cat.id === id);
    const nextIndex = currentIndex + direction;
    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= categories.length) return;

    const next = [...categories];
    const [moved] = next.splice(currentIndex, 1);
    next.splice(nextIndex, 0, moved);
    await reorderCategories(next.map((cat) => cat.id));
  };

  const handleCategoryDrop = async (targetId: string) => {
    if (!draggedCatId || draggedCatId === targetId) {
      setDraggedCatId(null);
      return;
    }

    const next = [...categories];
    const fromIndex = next.findIndex((cat) => cat.id === draggedCatId);
    const toIndex = next.findIndex((cat) => cat.id === targetId);
    if (fromIndex < 0 || toIndex < 0) {
      setDraggedCatId(null);
      return;
    }

    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    await reorderCategories(next.map((cat) => cat.id));
    setDraggedCatId(null);
  };

  const handleExportData = async (format: "csv" | "yaml") => {
    try {
      const extension = format === "csv" ? "csv" : "yml";
      const path = await saveFileDialog({
        defaultPath: `espander-snippets.${extension}`,
        filters: [{ name: format.toUpperCase(), extensions: [extension] }],
      });
      if (!path) return;
      await exportSnippets(path, format);
      showDataMessage("success", `Exported snippets to ${format.toUpperCase()}.`);
    } catch (err) {
      showDataMessage("error", err instanceof Error ? err.message : String(err));
    }
  };

  const handleImportData = async (format: "csv" | "yaml") => {
    try {
      const extensions = format === "csv" ? ["csv"] : ["yml", "yaml"];
      const selected = await openFileDialog({
        multiple: false,
        filters: [{ name: format.toUpperCase(), extensions }],
      });
      if (!selected || Array.isArray(selected)) return;
      const result = await importSnippets(selected, format);
      await Promise.all([fetchCategories(), fetchSnippets()]);
      showDataMessage(
        "success",
        `Imported ${result.imported} snippet(s). ${result.skipped} skipped, ${result.errors.length} error(s).`
      );
    } catch (err) {
      showDataMessage("error", err instanceof Error ? err.message : String(err));
    }
  };

  const handleDeleteCategory = async (id: string) => {
    try {
      await deleteCategory(id, false);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      if (errMsg.includes("CONTAINS_SNIPPETS:")) {
        const countStr = errMsg.substring(errMsg.indexOf("CONTAINS_SNIPPETS:") + 18);
        const count = parseInt(countStr, 10) || 0;
        
        setCatToDelete(id);
        setSnippetsCountInCat(count);
        
        const otherCats = categories.filter((c) => c.id !== id);
        if (otherCats.length > 0) {
          setMoveDestCatId(otherCats[0].id);
        } else {
          setMoveDestCatId("");
        }
        setDeleteSafetyOpen(true);
      } else {
        alert(errMsg);
      }
    }
  };

  return (
    <div className="settings-page max-w-3xl mx-auto p-6 space-y-6">
      <div className="settings-header">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground/80 mt-1">
          Configure Espander to match your workflow
        </p>
      </div>

      <Tabs defaultValue="general" className="space-y-4">
        <TabsList>
          <TabsTrigger value="general" className="gap-2">
            <Settings className="h-4 w-4" /> General
          </TabsTrigger>
          <TabsTrigger value="espanso" className="gap-2">
            <Terminal className="h-4 w-4" /> Espanso
          </TabsTrigger>
          <TabsTrigger value="sync" className="gap-2">
            <Cloud className="h-4 w-4" /> Sync
          </TabsTrigger>
          <TabsTrigger value="import-export" className="gap-2">
            <Database className="h-4 w-4" /> Data
          </TabsTrigger>
          <TabsTrigger value="updates" className="gap-2">
            <ArrowUpCircle className="h-4 w-4" /> Updates
          </TabsTrigger>
          <TabsTrigger value="docs" className="gap-2">
            <BookOpen className="h-4 w-4" /> Docs
          </TabsTrigger>
          <TabsTrigger value="about" className="gap-2">
            <Info className="h-4 w-4" /> About
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4">
          <div className="settings-panel rounded-xl border border-border bg-card p-5 space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-medium">Setup</h3>
                <p className="mt-1 text-xs text-muted-foreground/75">
                  Run the first-time setup again to change sync provider and Espanso connection.
                </p>
              </div>
              <Button variant="outline" size="sm" className="h-8 gap-2 text-xs" onClick={handleRunOnboarding}>
                <RotateCcw className="h-3.5 w-3.5" />
                Onboarding
              </Button>
            </div>
          </div>

          <div className="settings-panel rounded-xl border border-border bg-card p-5 space-y-4">
            <h3 className="text-sm font-medium">Appearance</h3>
            <div className="flex items-center gap-3">
              {(["dark", "light", "system"] as const).map((theme) => (
                <button
                  key={theme}
                  onClick={() => updateSettings({ theme })}
                  className={`flex items-center gap-2 rounded-lg px-4 py-2 border transition-all ${
                    settings.theme === theme
                      ? "border-indigo-500 bg-indigo-500/10 text-indigo-400 shadow-sm"
                      : "border-border hover:border-muted-foreground/30"
                  }`}
                >
                  {theme === "dark" && <Moon className="h-4 w-4" />}
                  {theme === "light" && <Sun className="h-4 w-4" />}
                  {theme === "system" && <Monitor className="h-4 w-4" />}
                  <span className="text-sm capitalize">{theme}</span>
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground/70">
              Changes apply immediately. The app remembers your preference.
            </p>
          </div>

          <div className="settings-panel rounded-xl border border-border bg-card p-5 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-medium">Permissions</h3>
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1 text-xs"
                onClick={refreshPermissions}
                disabled={permissionsLoading}
              >
                <RefreshCw className={cn("h-3 w-3", permissionsLoading && "animate-spin")} />
                Refresh
              </Button>
            </div>

            <div className="space-y-2">
              {permissions.map((permission) => {
                const granted = permission.status === "granted";
                const manual = permission.status === "manual";
                return (
                  <div
                    key={permission.id}
                    className="flex items-center gap-3 rounded-lg border border-border/70 bg-background/30 px-3 py-2"
                  >
                    {granted ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                    ) : manual ? (
                      <Info className="h-4 w-4 text-amber-400 flex-shrink-0" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{permission.title}</span>
                        <span
                          className={cn(
                            "rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wide",
                            granted
                              ? "bg-emerald-500/10 text-emerald-400"
                              : manual
                                ? "bg-amber-500/10 text-amber-400"
                                : "bg-red-500/10 text-red-400"
                          )}
                        >
                          {permission.status}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground/75 mt-0.5">
                        {permission.description}
                      </p>
                    </div>
                    {permission.action_label && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 gap-1 text-xs flex-shrink-0"
                        onClick={async () => {
                          await openPermissionSettings(permission.id);
                        }}
                      >
                        <ExternalLink className="h-3 w-3" />
                        {permission.action_label}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="settings-panel rounded-xl border border-border bg-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">Categories</h3>
              <div className="flex items-center gap-2">
                <Input
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  placeholder="New category name"
                  className="h-7 w-40 text-xs"
                  onKeyDown={(e) => { if (e.key === "Enter") handleAddCategory(); }}
                />
                <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={handleAddCategory} disabled={!newCatName.trim()}>
                  <Plus className="h-3 w-3" /> Add
                </Button>
              </div>
            </div>

            <div className="category-list space-y-1">
              {categories.map((cat, index) => (
                <div
                  key={cat.id}
                  className="relative py-0.5"
                  draggable
                  onDragStart={() => setDraggedCatId(cat.id)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => handleCategoryDrop(cat.id)}
                  onDragEnd={() => setDraggedCatId(null)}
                >
                  <div
                    className={cn(
                      "category-item flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-muted/50 transition-colors group",
                      draggedCatId === cat.id && "opacity-50"
                    )}
                  >
                    <GripVertical className="h-4 w-4 text-muted-foreground/70 flex-shrink-0 cursor-grab" />
                    <Folder className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    {editingCatId === cat.id ? (
                      <>
                        <Input
                          value={editingCatName}
                          onChange={(e) => setEditingCatName(e.target.value)}
                          className="h-7 text-xs flex-1"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") confirmCatRename();
                            if (e.key === "Escape") setEditingCatId(null);
                          }}
                        />
                        <button onClick={confirmCatRename} className="p-1 text-emerald-400 hover:text-emerald-300 transition-colors">
                          <Check className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => setEditingCatId(null)} className="p-1 text-muted-foreground hover:text-foreground transition-colors">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="flex-1 text-sm">{cat.name}</div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => moveCategory(cat.id, -1)}
                            disabled={index === 0}
                            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-30 disabled:pointer-events-none"
                            title="Move up"
                          >
                            <ArrowUp className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => moveCategory(cat.id, 1)}
                            disabled={index === categories.length - 1}
                            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-30 disabled:pointer-events-none"
                            title="Move down"
                          >
                            <ArrowDown className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => startCatRename(cat.id, cat.name)}
                            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                            title="Rename"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteCategory(cat.id)}
                            className="p-1.5 rounded-md text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Safety Category Deletion Dialog */}
            <Dialog open={deleteSafetyOpen} onOpenChange={setDeleteSafetyOpen}>
              <DialogContent className="sm:max-w-[440px]">
                <DialogHeader>
                  <DialogTitle className="text-red-400 flex items-center gap-2">
                    <AlertCircle className="h-5 w-5" />
                    Safe Category Deletion
                  </DialogTitle>
                  <DialogDescription className="space-y-2 pt-2 text-foreground">
                    <p className="font-semibold text-sm">This category still contains {snippetsCountInCat} snippet(s).</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Deleting this category will also delete every snippet inside it. If you want to keep your snippets, move them to another category before deleting this one.
                    </p>
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-3 border-t border-b border-border/50">
                  {categories.filter((c) => c.id !== catToDelete).length > 0 ? (
                    <div className="space-y-2">
                      <Label htmlFor="dest-category" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Option 1 — Move Snippets</Label>
                      <div className="flex gap-2">
                        <Select value={moveDestCatId} onValueChange={setMoveDestCatId}>
                          <SelectTrigger id="dest-category" className="h-8 text-xs flex-1">
                            <SelectValue placeholder="Choose target category" />
                          </SelectTrigger>
                          <SelectContent>
                            {categories
                              .filter((c) => c.id !== catToDelete)
                              .map((cat) => (
                                <SelectItem key={cat.id} value={cat.id}>
                                  {cat.name}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                        <Button
                          size="sm"
                          className="h-8 text-xs"
                          onClick={async () => {
                            if (catToDelete && moveDestCatId) {
                              await moveSnippetsAndDeleteCategory(catToDelete, moveDestCatId);
                              setDeleteSafetyOpen(false);
                              setCatToDelete(null);
                            }
                          }}
                        >
                          Move & Delete
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">No other categories available to move snippets to.</p>
                  )}

                  <div className="space-y-2 pt-2">
                    <Label className="text-xs font-semibold text-red-400 uppercase tracking-wider">Option 2 — Destructive Action</Label>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="w-full text-xs h-9 bg-red-600 hover:bg-red-700 text-white font-medium"
                      onClick={async () => {
                        if (catToDelete) {
                          await deleteCategory(catToDelete, true);
                          setDeleteSafetyOpen(false);
                          setCatToDelete(null);
                        }
                      }}
                    >
                      Delete Category & All Snippets
                    </Button>
                  </div>
                </div>

                <DialogFooter>
                  <Button variant="outline" size="sm" onClick={() => { setDeleteSafetyOpen(false); setCatToDelete(null); }}>
                    Cancel
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </TabsContent>

        <TabsContent value="espanso" className="space-y-4">
          <div className="settings-panel rounded-xl border border-border bg-card p-5 space-y-4">
            <h3 className="text-sm font-medium">Espanso Integration</h3>

            <div className="space-y-2">
              <Label className="text-xs font-medium text-foreground/80">Espanso Path</Label>
              <div className="flex gap-2">
                <Input
                  value={localPath}
                  onChange={(e) => setLocalPath(e.target.value)}
                  placeholder="/opt/homebrew/bin/espanso"
                  className="h-8 text-xs"
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8"
                  onClick={handleUpdatePath}
                >
                  Update
                </Button>
              </div>
              {pathMessage && (
                <div className={`flex items-center gap-1.5 text-xs ${
                  pathMessage.type === "success" ? "text-emerald-400" : "text-red-400"
                }`}>
                  {pathMessage.type === "success" ? (
                    <CheckCircle2 className="h-3 w-3" />
                  ) : (
                    <AlertCircle className="h-3 w-3" />
                  )}
                  {pathMessage.text}
                </div>
              )}
              <p className="text-xs text-muted-foreground/70">
                Path to the espanso binary. On macOS, typically /opt/homebrew/bin/espanso or /usr/local/bin/espanso.
              </p>
            </div>

          </div>
        </TabsContent>

        <TabsContent value="sync" className="space-y-4">
          <div className="settings-panel rounded-xl border border-border bg-card p-5 space-y-4">
            <h3 className="text-sm font-medium">Cloud Synchronization</h3>

            <div className="space-y-2">
              <Label className="text-xs font-medium text-foreground/80">Sync Provider</Label>
              <Select
                value={settings.sync_provider}
                onValueChange={(value: "github" | "gsheet" | "local") =>
                  updateSettings({ sync_provider: value })
                }
              >
                <SelectTrigger className="w-full h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="github">GitHub (Recommended)</SelectItem>
                  <SelectItem value="gsheet">Google Sheets (Import only)</SelectItem>
                  <SelectItem value="local">Local Only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Auto Sync</Label>
                <p className="text-xs text-muted-foreground/70">
                  Automatically sync at the configured interval
                </p>
              </div>
              <Switch
                checked={settings.auto_sync}
                onCheckedChange={(checked) =>
                  updateSettings({ auto_sync: checked })
                }
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium text-foreground/80">Sync Interval (minutes)</Label>
              <Input
                type="number"
                min={1}
                max={1440}
                className="h-8 text-xs max-w-[120px]"
                value={settings.sync_interval_minutes}
                onChange={(e) =>
                  updateSettings({
                    sync_interval_minutes: parseInt(e.target.value) || 60,
                  })
                }
              />
              <p className="text-xs text-muted-foreground/70">
                How often to check for changes (1-1440 minutes)
              </p>
            </div>

            {settings.sync_provider === "gsheet" && (
              <div className="space-y-2 pt-3 border-t border-border">
                <Label className="text-xs font-medium text-foreground/80">Published CSV URL</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="https://docs.google.com/spreadsheets/d/e/.../pub?output=csv"
                    className="h-8 text-xs"
                    value={settings.gsheet_csv_url || ""}
                    onChange={(e) =>
                      updateSettings({ gsheet_csv_url: e.target.value || null })
                    }
                  />
                </div>
                <p className="text-xs text-muted-foreground/70">
                  Paste the published CSV URL of your Google Sheet. Use File &gt; Share &gt; Publish to web.
                </p>
              </div>
            )}

            {settings.sync_provider === "github" && (
              <div className="space-y-4 pt-3 border-t border-border">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">GitHub Connection</Label>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1.5"
                    onClick={() => setShowGithubDocs(true)}
                  >
                    See Documentation
                  </Button>
                </div>

                {/* Connection Status Overview */}
                <div className="p-4 rounded-lg border border-border bg-muted/20 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-xs font-medium text-foreground">
                        Connected to GitHub Repository
                      </span>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="h-7 text-[10px] uppercase font-bold"
                      onClick={handleDisconnect}
                    >
                      Disconnect
                    </Button>
                  </div>
                  <div className="space-y-1.5 text-xs text-muted-foreground">
                    <p>
                      <strong>Repository URL:</strong>{" "}
                      <span className="font-mono text-[11px] text-foreground">{settings.github_repo_url}</span>
                    </p>
                    <p>
                      <strong>Branch:</strong>{" "}
                      <span className="font-mono text-[11px] text-foreground">{settings.github_branch}</span>
                    </p>
                  </div>
                </div>

                {/* GitHub Integration Docs Dialog */}
                <Dialog open={showGithubDocs} onOpenChange={setShowGithubDocs}>
                  <DialogContent className="sm:max-w-[480px]">
                    <DialogHeader>
                      <DialogTitle className="text-indigo-400">Connecting Espander to GitHub</DialogTitle>
                      <DialogDescription className="text-xs text-muted-foreground">
                        Follow these steps to connect your snippets using a secure, Fine-grained Personal Access Token (PAT).
                      </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-3 py-3 text-xs border-t border-b border-border/50 max-h-[350px] overflow-y-auto scrollbar-thin">
                      <div className="bg-indigo-500/5 p-3 rounded-lg border border-indigo-500/10 space-y-1.5">
                        <span className="font-semibold text-foreground flex items-center gap-1.5">
                          Least Privilege Permissions Checklist
                        </span>
                        <div className="space-y-1 text-[11px] text-muted-foreground leading-relaxed">
                          <p>When creating the token, configure these options:</p>
                          <ul className="list-disc pl-4 space-y-0.5">
                            <li><strong>Repository access:</strong> Select <strong>Only select repositories</strong>, then choose the repository that stores the snippets.</li>
                            <li><strong>Repository permissions:</strong>
                              <ul className="list-circle pl-4 mt-0.5 space-y-0.5">
                                <li><strong>Contents &rarr; Read and Write</strong> (needed to sync YAML files)</li>
                                <li><strong>Metadata &rarr; Read-only</strong> (needed for basic repository checks)</li>
                              </ul>
                            </li>
                            <li><strong>No other permissions are required.</strong> Leave all other settings as No Access.</li>
                          </ul>
                        </div>
                      </div>

                      <div className="space-y-1.5 pt-1">
                        <span className="font-semibold text-foreground">Step-by-step Setup Guide:</span>
                        
                        <div className="space-y-1 pl-1">
                          <p className="font-medium text-foreground/90">1. Create a Repository</p>
                          <p className="text-muted-foreground">
                            Create a public or private repository (e.g. <code>espander-snippets</code>) on GitHub to save your snippets.
                          </p>
                        </div>

                        <div className="space-y-1 pl-1 pt-1.5">
                          <p className="font-medium text-foreground/90">2. Generate a Fine-grained Token</p>
                          <p className="text-muted-foreground">
                            Go directly to the <a href="#" onClick={(e) => { e.preventDefault(); openBrowser("https://github.com/settings/personal-access-tokens/new"); }} className="text-indigo-400 hover:underline">GitHub Fine-grained Tokens Creator</a>.<br />
                            Fill in a name (e.g. <code>Espander Sync</code>), and pick your repository. Set permissions using the checklist above.
                          </p>
                        </div>

                        <div className="space-y-1 pl-1 pt-1.5">
                          <p className="font-medium text-foreground/90">3. Connect Espander</p>
                          <p className="text-muted-foreground">
                            Copy the token (begins with <code>github_pat_</code>) and paste it along with the Owner, Name, and Branch in Espander's settings. Click Sync in the sidebar to start synchronization!
                          </p>
                        </div>
                      </div>
                    </div>

                    <DialogFooter>
                      <Button size="sm" onClick={() => setShowGithubDocs(false)}>Close Guide</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            )}

            {settings.sync_provider !== "github" && (
              <div className="space-y-4 pt-3 border-t border-border">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">GitHub Connection</Label>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1.5"
                    onClick={() => setShowGithubDocs(true)}
                  >
                    See Documentation
                  </Button>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="gh-url" className="text-xs font-medium text-foreground/80">Repository URL</Label>
                    <Input
                      id="gh-url"
                      placeholder="https://github.com/owner/repo"
                      className="h-8 text-xs font-mono"
                      value={githubRepoUrl}
                      onChange={(e) => setGithubRepoUrl(e.target.value)}
                    />
                    <p className="text-[10px] text-muted-foreground/75 leading-normal">
                      The full URL of your GitHub repository (e.g. <code>https://github.com/ashikhosen/devsoffice-snippets</code>).
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="gh-token" className="text-xs font-medium text-foreground/80">
                      Fine-grained Personal Access Token
                    </Label>
                    <Input
                      id="gh-token"
                      type="password"
                      placeholder="github_pat_..."
                      className="h-8 text-xs font-mono"
                      value={githubToken}
                      onChange={(e) => setGithubToken(e.target.value)}
                    />
                    <p className="text-[10px] text-muted-foreground/75 leading-normal">
                      Secure authentication token. Must have <strong>Contents (Read/Write)</strong> and <strong>Metadata (Read)</strong> permissions.
                    </p>
                  </div>

                  {/* Actions & Feedback */}
                  <div className="flex gap-2.5 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs font-medium px-4"
                      onClick={handleTestConnection}
                      disabled={isTesting || isConnectingState}
                    >
                      {isTesting ? "Testing..." : "Test Connection"}
                    </Button>
                    <Button
                      size="sm"
                      className="h-8 text-xs font-semibold px-5"
                      onClick={handleConnect}
                      disabled={isTesting || isConnectingState || !githubRepoUrl || !githubToken}
                    >
                      {isConnectingState ? "Connecting..." : "Connect"}
                    </Button>
                  </div>

                  {testResult && (
                    <div className={`p-3 rounded-lg border text-xs leading-normal flex items-start gap-2 ${
                      testResult.success 
                        ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-400" 
                        : "bg-red-500/5 border-red-500/20 text-red-400"
                    }`}>
                      <div className="space-y-1 flex-1">
                        <p className="font-semibold">{testResult.success ? "Success" : "Connection Check Failed"}</p>
                        <p className="opacity-90">{testResult.message}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Docs Dialog (also mapped here just in case) */}
                <Dialog open={showGithubDocs} onOpenChange={setShowGithubDocs}>
                  <DialogContent className="sm:max-w-[480px]">
                    <DialogHeader>
                      <DialogTitle className="text-indigo-400">Connecting Espander to GitHub</DialogTitle>
                      <DialogDescription className="text-xs text-muted-foreground">
                        Follow these steps to connect your snippets using a secure, Fine-grained Personal Access Token (PAT).
                      </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-3 py-3 text-xs border-t border-b border-border/50 max-h-[350px] overflow-y-auto scrollbar-thin">
                      <div className="bg-indigo-500/5 p-3 rounded-lg border border-indigo-500/10 space-y-1.5">
                        <span className="font-semibold text-foreground flex items-center gap-1.5">
                          Least Privilege Permissions Checklist
                        </span>
                        <div className="space-y-1 text-[11px] text-muted-foreground leading-relaxed">
                          <p>When creating the token, configure these options:</p>
                          <ul className="list-disc pl-4 space-y-0.5">
                            <li><strong>Repository access:</strong> Select <strong>Only select repositories</strong>, then choose the repository that stores the snippets.</li>
                            <li><strong>Repository permissions:</strong>
                              <ul className="list-circle pl-4 mt-0.5 space-y-0.5">
                                <li><strong>Contents &rarr; Read and Write</strong> (needed to sync YAML files)</li>
                                <li><strong>Metadata &rarr; Read-only</strong> (needed for basic repository checks)</li>
                              </ul>
                            </li>
                            <li><strong>No other permissions are required.</strong> Leave all other settings as No Access.</li>
                          </ul>
                        </div>
                      </div>

                      <div className="space-y-1.5 pt-1">
                        <span className="font-semibold text-foreground">Step-by-step Setup Guide:</span>
                        
                        <div className="space-y-1 pl-1">
                          <p className="font-medium text-foreground/90">1. Create a Repository</p>
                          <p className="text-muted-foreground">
                            Create a public or private repository (e.g. <code>espander-snippets</code>) on GitHub to save your snippets.
                          </p>
                        </div>

                        <div className="space-y-1 pl-1 pt-1.5">
                          <p className="font-medium text-foreground/90">2. Generate a Fine-grained Token</p>
                          <p className="text-muted-foreground">
                            Go directly to the <a href="#" onClick={(e) => { e.preventDefault(); openBrowser("https://github.com/settings/personal-access-tokens/new"); }} className="text-indigo-400 hover:underline">GitHub Fine-grained Tokens Creator</a>.<br />
                            Fill in a name (e.g. <code>Espander Sync</code>), and pick your repository. Set permissions using the checklist above.
                          </p>
                        </div>

                        <div className="space-y-1 pl-1 pt-1.5">
                          <p className="font-medium text-foreground/90">3. Connect Espander</p>
                          <p className="text-muted-foreground">
                            Copy the token (begins with <code>github_pat_</code>) and paste it along with the Owner, Name, and Branch in Espander's settings. Click Sync in the sidebar to start synchronization!
                          </p>
                        </div>
                      </div>
                    </div>

                    <DialogFooter>
                      <Button size="sm" onClick={() => setShowGithubDocs(false)}>Close Guide</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            )}

            {settings.sync_provider === "local" && (
              <div className="pt-3 border-t border-border">
                <p className="text-xs text-muted-foreground/70">
                  All data is stored locally at ~/.espander/database/. No cloud sync configured.
                </p>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="import-export" className="space-y-4">
          <div className="settings-panel rounded-xl border border-border bg-card p-5 space-y-4">
            <h3 className="text-sm font-medium">Export Snippets</h3>
            <p className="text-xs text-muted-foreground/70">
              Export your snippets with category information for backup or migration.
            </p>

            {dataMessage && (
              <div
                className={cn(
                  "rounded-lg border p-3 text-xs font-medium",
                  dataMessage.type === "success"
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                    : "border-red-500/30 bg-red-500/10 text-red-400"
                )}
              >
                {dataMessage.text}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              {[
                { format: "csv" as const, label: "CSV", desc: "Spreadsheet-friendly columns" },
                { format: "yaml" as const, label: "YAML", desc: "Portable category-aware backup" },
              ].map(({ format, label, desc }) => (
                <Button
                  key={format}
                  variant="outline"
                  size="sm"
                  className="flex-col h-auto py-3 gap-1"
                  onClick={() => handleExportData(format)}
                >
                  <Download className="h-4 w-4" />
                  <span className="text-xs font-medium">{label}</span>
                  <span className="text-[10px] text-muted-foreground">{desc}</span>
                </Button>
              ))}
            </div>
          </div>

          <div className="settings-panel rounded-xl border border-border bg-card p-5 space-y-4">
            <h3 className="text-sm font-medium">Import Snippets</h3>
            <p className="text-xs text-muted-foreground/70">
              Import CSV or YAML files. Missing categories are created automatically.
            </p>

            <div className="flex gap-2">
              {[
                { format: "csv" as const, label: "CSV" },
                { format: "yaml" as const, label: "YAML" },
              ].map(({ format, label }) => (
                <Button
                  key={format}
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => handleImportData(format)}
                >
                  <Upload className="h-4 w-4" /> {label}
                </Button>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="docs" className="space-y-4">
          <div className="about-page settings-panel rounded-xl border border-border bg-card p-5">
            {docsHtml ? (
              <div
                className="page-content text-sm [&_h1]:text-lg [&_h1]:font-semibold [&_h1]:mb-2 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:mb-1.5 [&_p]:mb-2 [&_p]:leading-relaxed [&_a]:text-indigo-400 [&_a:hover]:text-indigo-300 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-2 [&_li]:mb-0.5 [&_hr]:border-border [&_hr]:my-3 [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_pre]:bg-muted [&_pre]:p-3 [&_pre]:rounded-lg [&_pre]:overflow-x-auto [&_pre]:text-xs [&_img]:rounded-lg [&_img]:max-w-full [&_blockquote]:border-l-2 [&_blockquote]:border-indigo-500 [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-muted-foreground"
                dangerouslySetInnerHTML={{ __html: docsHtml }}
              />
            ) : (
              <p className="text-sm text-muted-foreground">Loading...</p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="about" className="space-y-4">
          <div className="about-page settings-panel rounded-xl border border-border bg-card p-5">
            {aboutHtml ? (
              <div
                className="page-content text-sm [&_h1]:text-lg [&_h1]:font-semibold [&_h1]:mb-2 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:mb-1.5 [&_p]:mb-2 [&_p]:leading-relaxed [&_a]:text-indigo-400 [&_a:hover]:text-indigo-300 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-2 [&_li]:mb-0.5 [&_hr]:border-border [&_hr]:my-3 [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_pre]:bg-muted [&_pre]:p-3 [&_pre]:rounded-lg [&_pre]:overflow-x-auto [&_pre]:text-xs [&_img]:rounded-lg [&_img]:max-w-full [&_blockquote]:border-l-2 [&_blockquote]:border-indigo-500 [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-muted-foreground"
                dangerouslySetInnerHTML={{ __html: aboutHtml }}
              />
            ) : (
              <p className="text-sm text-muted-foreground">Loading...</p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="updates" className="space-y-4">
          <div className="settings-panel rounded-xl border border-border bg-card p-5 space-y-4">
            <h3 className="text-sm font-medium">Application Updates</h3>
            <p className="text-xs text-muted-foreground/70">
              Keep Espander up to date with the latest features, security patches, and performance fixes.
            </p>

            <div className="flex flex-col gap-4 rounded-lg bg-muted/30 p-4 border border-border">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">Currently Installed</span>
                  <p className="text-sm font-mono font-medium">v{currentVersion}</p>
                </div>
                <div className="space-y-1 text-right">
                  <span className="text-xs text-muted-foreground">Latest Available</span>
                  <p className="text-sm font-mono font-medium">
                    {updater ? `v${updater.version}` : "v0.1.0"}
                  </p>
                </div>
              </div>

              {updater && updater.version !== currentVersion ? (
                <div className="space-y-3 pt-3 border-t border-border/50">
                  <div className="rounded-lg bg-indigo-500/10 border border-indigo-500/20 p-3 text-indigo-300">
                    <span className="font-semibold text-xs block mb-1">New Update Available!</span>
                    <p className="text-xs text-indigo-300/80">
                      Version {updater.version} was released on {updater.release_date}.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <span className="text-xs text-muted-foreground font-medium">Release Notes</span>
                    <div className="text-xs text-muted-foreground/90 whitespace-pre-wrap bg-background/50 rounded-lg p-3 border border-border/50 max-h-40 overflow-y-auto leading-relaxed">
                      {updater.release_notes}
                    </div>
                  </div>

                  {localErrorMsg && (
                    <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400 font-medium">
                      Update failed: {localErrorMsg}
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button
                      size="sm"
                      onClick={handleInstallUpdate}
                      disabled={isUpdating}
                      className="flex-1 gap-2 text-xs h-9"
                    >
                      {isUpdating ? (
                        <>
                          <div className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
                          Installing Update...
                        </>
                      ) : (
                        <>
                          <ArrowUpCircle className="h-4 w-4" />
                          Update Automatically
                        </>
                      )}
                    </Button>

                    {(showFallback || localErrorMsg) && (
                      <a
                        href={updater.github_releases_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1"
                      >
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full gap-2 border-indigo-500/30 text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/5 text-xs h-9"
                        >
                          <ExternalLink className="h-4 w-4" />
                          Download Latest Version (Manual)
                        </Button>
                      </a>
                    )}
                  </div>
                </div>
              ) : (
                <div className="pt-3 border-t border-border/50 text-center py-4">
                  <CheckCircle2 className="h-8 w-8 text-emerald-400 mx-auto mb-2" />
                  <p className="text-sm font-medium text-foreground">You are up to date!</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Espander is running the latest available version (v{currentVersion}).
                  </p>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1.5"
                onClick={checkUpdates}
                disabled={isChecking}
              >
                <RefreshCw className={cn("h-3 w-3", isChecking && "animate-spin")} />
                Check for Updates
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
