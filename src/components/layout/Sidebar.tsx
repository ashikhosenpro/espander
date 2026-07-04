import { useUIStore } from "@/stores/useUIStore";
import { useCategoryStore } from "@/stores/useCategoryStore";
import { useSyncStore } from "@/stores/useSyncStore";
import { useSnippetStore } from "@/stores/useSnippetStore";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Grid3X3,
  Heart,
  Settings,
  RefreshCw,
  Globe,
  WifiOff,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Info,
  Puzzle,
} from "lucide-react";
import { useEffect, useMemo } from "react";
import { useToolsStore } from "@/stores/useToolsStore";
import { useGlobalTextStore } from "@/stores/useGlobalTextStore";

const navItems = [
  { id: "snippets" as const, label: "All Snippets", icon: Grid3X3 },
  { id: "favorites" as const, label: "Favorites", icon: Heart },
];

export function Sidebar() {
  const { activeView, setActiveView, sidebarOpen } = useUIStore();
  const { categories, fetchCategories } = useCategoryStore();
  const { snippets, fetchSnippets, setSearch, setFilter, setFilterFavorite } = useSnippetStore();
  const { syncStatus, syncProgress, lastSyncAt, lastResult, errorMessage, syncNow } = useSyncStore();
  const { tools, fetchTools } = useToolsStore();
  const { texts, fetchTexts } = useGlobalTextStore();

  useEffect(() => {
    fetchCategories();
    fetchSnippets();
    fetchTools();
    fetchTexts();
  }, [fetchCategories, fetchSnippets, fetchTools, fetchTexts]);

  const favoriteCount = snippets.filter((snippet) => snippet.is_favorite).length;

  const snippetCountByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    for (const s of snippets) {
      map[s.category_id] = (map[s.category_id] || 0) + 1;
    }
    return map;
  }, [snippets]);

  const handleNavClick = (id: "snippets" | "favorites") => {
    setActiveView(id);
    setFilterFavorite(id === "favorites");
    if (id === "snippets") {
      setFilter(null);
    }
    setSearch("");
  };

  const handleCategoryClick = (categoryId: string | null) => {
    setActiveView("snippets");
    setFilter(categoryId);
    setFilterFavorite(false);
  };

  const syncIcon = {
    idle: Globe,
    syncing: Loader2,
    success: CheckCircle2,
    error: AlertCircle,
    offline: WifiOff,
  }[syncStatus];

  const syncColor = {
    idle: "text-muted-foreground",
    syncing: "text-indigo-400",
    success: "text-emerald-400",
    error: "text-red-400",
    offline: "text-muted-foreground",
  }[syncStatus];

  const SyncIcon = syncIcon;

  return (
    <aside
      className={cn(
        "sidebar flex flex-col border-r border-border bg-sidebar transition-all duration-200",
        sidebarOpen ? "w-60" : "w-0 overflow-hidden"
      )}
    >
      <div className="sidebar-header flex h-14 items-center gap-2.5 px-5 border-b border-border">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 shadow-sm">
          <span className="text-xs font-bold text-white">E</span>
        </div>
        <span className="font-semibold text-sm text-sidebar-foreground">Espander</span>
      </div>

      <nav className="sidebar-nav flex-1 overflow-y-auto scrollbar-thin p-3 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              className={cn(
                "sidebar-nav-item flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
                (activeView === item.id) ||
                  (item.id === "snippets" && activeView === "snippets" && !useSnippetStore.getState().filterCategory)
                  ? "bg-sidebar-accent text-sidebar-foreground font-medium"
                  : "text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="flex-1 text-left">{item.label}</span>
              {item.id === "snippets" && (
                <span className="text-[11px] text-sidebar-muted tabular-nums">
                  {snippets.length}
                </span>
              )}
              {item.id === "favorites" && favoriteCount > 0 && (
                <span className="text-[11px] text-sidebar-muted tabular-nums">
                  {favoriteCount}
                </span>
              )}
            </button>
          );
        })}

        <Separator className="my-3" />

        <div className="px-3 py-1.5 text-xs font-medium text-sidebar-muted uppercase tracking-wider">
          Categories
        </div>

        <div className="category-list space-y-0.5">
          {categories.map((cat) => {
            const count = snippetCountByCategory[cat.id] || 0;
            const isActive = useSnippetStore.getState().filterCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => handleCategoryClick(cat.id)}
                className={cn(
                  "category-item flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-foreground font-medium"
                    : "text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
                )}
              >
                <div
                  className="h-2 w-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: cat.color }}
                />
                <span className="flex-1 text-left truncate">{cat.name}</span>
                <span className="category-count text-[11px] text-sidebar-muted tabular-nums">
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <Separator className="my-3" />

        <button
          onClick={() => setActiveView("settings")}
          className={cn(
            "sidebar-nav-item flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
            activeView === "settings"
              ? "bg-sidebar-accent text-sidebar-foreground font-medium"
              : "text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
          )}
        >
          <Settings className="h-4 w-4" />
          <span className="flex-1 text-left">Settings</span>
        </button>

        <button
          onClick={() => setActiveView("tools")}
          className={cn(
            "sidebar-nav-item flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
            activeView === "tools"
              ? "bg-sidebar-accent text-sidebar-foreground font-medium"
              : "text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
          )}
        >
          <Puzzle className="h-4 w-4" />
          <span className="flex-1 text-left">{texts.more_tools_title}</span>
          {tools.length > 0 && (
            <span className="text-[11px] text-sidebar-muted tabular-nums">
              {tools.length}
            </span>
          )}
        </button>
      </nav>

      <div className="sidebar-footer p-3 border-t border-border">
        <div className="sync-status rounded-lg bg-sidebar-accent/50 p-3 space-y-2">
          <Popover>
            <PopoverTrigger asChild>
              <button className="flex w-full items-center gap-2 text-xs">
                <SyncIcon className={cn("h-3.5 w-3.5", syncColor, syncStatus === "syncing" && "animate-spin")} />
                <span className="text-sidebar-muted capitalize flex-1 text-left">
                  {syncStatus === "idle" ? "Idle" : syncStatus === "syncing" ? `Syncing ${syncProgress}%` : syncStatus === "success" ? "Synced" : "Error"}
                </span>
                {lastResult && <Info className="h-3 w-3 text-sidebar-muted" />}
              </button>
            </PopoverTrigger>
            {syncStatus === "syncing" && (
              <div className="h-1 overflow-hidden rounded-full bg-sidebar-muted/20">
                <div
                  className="h-full rounded-full bg-indigo-400 transition-all duration-300"
                  style={{ width: `${Math.max(8, Math.min(syncProgress, 100))}%` }}
                />
              </div>
            )}
            <PopoverContent side="top" align="start" className="w-56 p-3 text-xs">
              <div className="space-y-2">
                <h4 className="font-medium text-sm">Last Sync</h4>
                {lastSyncAt && (
                  <div className="text-muted-foreground">
                    {new Date(lastSyncAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}{" "}
                    {new Date(lastSyncAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                )}
                {lastResult ? (
                  <div className="grid grid-cols-2 gap-1.5 pt-1">
                    <div className="text-muted-foreground">Imported:</div>
                    <div className="text-right font-medium tabular-nums">{lastResult.imported}</div>
                    <div className="text-muted-foreground">Updated:</div>
                    <div className="text-right font-medium tabular-nums">{lastResult.updated}</div>
                    <div className="text-muted-foreground">Deleted:</div>
                    <div className="text-right font-medium tabular-nums">{lastResult.deleted}</div>
                    <div className="text-muted-foreground">Status:</div>
                    <div className="text-right font-medium text-emerald-400">Success</div>
                    <div className="text-muted-foreground col-span-2 pt-1 border-t border-border mt-1">
                      Source: {lastResult.source}
                    </div>
                  </div>
                ) : (
                  <div className="text-muted-foreground pt-1">No sync data yet</div>
                )}
                {errorMessage && (
                  <div className="p-2 rounded bg-red-500/5 border border-red-500/10 text-[10px] text-red-400 leading-normal max-h-24 overflow-y-auto break-words mt-2">
                    <strong>Error:</strong> {errorMessage}
                  </div>
                )}
              </div>
            </PopoverContent>
          </Popover>

          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs h-7"
            onClick={() => syncNow()}
            disabled={syncStatus === "syncing"}
          >
            <RefreshCw className={cn("h-3 w-3 mr-1.5", syncStatus === "syncing" && "animate-spin")} />
            Sync Now
          </Button>
        </div>
      </div>
    </aside>
  );
}
