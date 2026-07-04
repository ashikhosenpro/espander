import { Bell, Search, Plus, List, Grid3X3 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useSnippetStore } from "@/stores/useSnippetStore";
import { useUIStore } from "@/stores/useUIStore";
import { useNotificationStore } from "@/stores/useNotificationStore";
import { useGlobalTextStore } from "@/stores/useGlobalTextStore";
import { cn } from "@/lib/utils";

export function TopBar() {
  const { searchQuery, setSearch } = useSnippetStore();
  const { viewMode, setViewMode, openEditor, setActiveView, clearSelectedNotification } = useUIStore();
  const { notifications, isRead } = useNotificationStore();
  const { texts } = useGlobalTextStore();

  const unreadNotifications = notifications.filter((notification) => !isRead(notification.id)).length;

  const openNotifications = () => {
    clearSelectedNotification();
    setActiveView("notifications");
  };

  return (
    <header className="flex h-14 items-center gap-3 border-b border-border bg-background px-4">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search snippets..."
          value={searchQuery}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-8 text-sm bg-muted/50 border-0 focus-visible:ring-1"
        />
      </div>

      <div className="flex items-center gap-1 rounded-lg border border-border p-0.5">
        <button
          onClick={() => setViewMode("list")}
          className={cn(
            "p-1.5 rounded-md transition-colors",
            viewMode === "list" ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <List className="h-4 w-4" />
        </button>
        <button
          onClick={() => setViewMode("grid")}
          className={cn(
            "p-1.5 rounded-md transition-colors",
            viewMode === "grid" ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Grid3X3 className="h-4 w-4" />
        </button>
      </div>

      <button
        onClick={openNotifications}
        className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        aria-label={texts.notifications_title}
        title={texts.notifications_title}
      >
        <Bell className="h-4 w-4" />
        {unreadNotifications > 0 && (
          <span className="absolute -right-1.5 -top-1.5 min-w-4 rounded-full bg-sky-500 px-1 text-center text-[10px] font-semibold leading-4 text-white shadow-sm">
            {unreadNotifications > 99 ? "99+" : unreadNotifications}
          </span>
        )}
      </button>

      <Button onClick={() => openEditor("create")} size="sm" className="h-8 gap-1">
        <Plus className="h-4 w-4" />
        New Snippet
      </Button>
    </header>
  );
}
