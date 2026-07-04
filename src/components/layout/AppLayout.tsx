import { useMemo } from "react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { useUIStore } from "@/stores/useUIStore";
import { SnippetListPage } from "@/components/snippets/SnippetListPage";
import { SettingsPage } from "@/components/settings/SettingsPage";
import { SnippetEditorDialog } from "@/components/snippets/SnippetEditorDialog";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { useUpdateStore } from "@/stores/useUpdateStore";
import { useNotificationStore } from "@/stores/useNotificationStore";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  ExternalLink,
  Download,
  Github,
  Info,
} from "lucide-react";

export function AppLayout() {
  const { activeView } = useUIStore();
  const { settings, loadSettings } = useSettingsStore();
  const { announcement, announcementDismissed, dismissAnnouncement, checkUpdates } = useUpdateStore();
  const { activeNotification, dismissNotification, startPolling } = useNotificationStore();

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    checkUpdates();
  }, [checkUpdates]);

  useEffect(() => {
    const cleanup = startPolling();
    return cleanup;
  }, [startPolling]);

  const espansoMissing = useMemo(() => {
    return !settings.espanso_auto_detected && !settings.espanso_path;
  }, [settings.espanso_auto_detected, settings.espanso_path]);

  if (!settings.first_launch_complete) {
    return <OnboardingWizard />;
  }

  return (
    <div className="app-root flex flex-col h-screen overflow-hidden bg-background">
      {espansoMissing && (
        <div className="espanso-banner flex items-center gap-3 px-4 py-2.5 bg-amber-500/10 border-b border-amber-500/20">
          <AlertTriangle className="h-4 w-4 text-amber-400 flex-shrink-0" />
          <p className="text-xs text-amber-300/90 flex-1">
            Espanso not detected. Snippets will be saved locally but won't be deployed.
          </p>
          <a
            href="https://espanso.org/install/"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5 border-amber-500/30 text-amber-300 hover:text-amber-200">
              <Download className="h-3 w-3" /> Install Espanso
            </Button>
          </a>
        </div>
      )}

      {announcement && announcement.active && !announcementDismissed && (
        <div className={cn(
          "announcement-banner flex items-center gap-3 px-4 py-2.5 border-b text-xs",
          announcement.type_name === "warning" ? "bg-amber-500/10 border-amber-500/20 text-amber-300" :
          announcement.type_name === "danger" ? "bg-red-500/10 border-red-500/20 text-red-300" :
          announcement.type_name === "success" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300" :
          "bg-indigo-500/10 border-indigo-500/20 text-indigo-300"
        )}>
          <Info className="h-4 w-4 flex-shrink-0" />
          <div className="flex-1">
            <span className="font-semibold mr-1">{announcement.title}:</span>
            {announcement.message}
          </div>
          <button
            className="text-[10px] uppercase font-bold tracking-wider opacity-70 hover:opacity-100 px-1.5 py-0.5 rounded transition-opacity"
            onClick={dismissAnnouncement}
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="app-container flex flex-1 min-h-0">
        <Sidebar />
        <div className="app-content flex flex-1 flex-col min-w-0">
          <TopBar />
          {activeNotification && (
            <div className={cn(
              "flex items-center gap-3 px-4 py-2 border-b text-xs transition-all",
              activeNotification.type_name === "success" && "bg-emerald-500/5 text-emerald-400 border-emerald-500/10",
              activeNotification.type_name === "warning" && "bg-amber-500/5 text-amber-300 border-amber-500/10",
              activeNotification.type_name === "error" && "bg-red-500/5 text-red-400 border-red-500/10",
              activeNotification.type_name === "info" && "bg-indigo-500/5 text-indigo-400 border-indigo-500/10"
            )}>
              <Info className="h-3.5 w-3.5 flex-shrink-0" />
              <div className="flex-1 truncate">
                <span className="font-semibold mr-1.5">{activeNotification.title}</span>
                <span className="text-muted-foreground">{activeNotification.message}</span>
              </div>
              {activeNotification.dismissible && (
                <button
                  onClick={() => dismissNotification(activeNotification.id)}
                  className="text-[10px] font-medium tracking-wide uppercase px-2 py-0.5 rounded border border-border/40 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                >
                  Dismiss
                </button>
              )}
            </div>
          )}
          <main className="app-main flex-1 overflow-y-auto scrollbar-thin">
            {activeView === "settings" ? <SettingsPage /> : <SnippetListPage />}
          </main>
          <footer className="app-footer flex items-center justify-between px-4 py-2 border-t border-border bg-muted/20">
            <p className="text-[11px] text-muted-foreground/70">
              Espander v0.1.0 &middot; MIT License
            </p>
            <a
              href="https://github.com/anomalyco/espander"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-muted-foreground/70 hover:text-foreground flex items-center gap-1.5 transition-colors"
            >
              <Github className="h-3 w-3" />
              GitHub
              <ExternalLink className="h-2.5 w-2.5" />
            </a>
          </footer>
        </div>
      </div>
      <SnippetEditorDialog />
    </div>
  );
}
