import { useMemo } from "react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { useUIStore } from "@/stores/useUIStore";
import { SnippetListPage } from "@/components/snippets/SnippetListPage";
import { SettingsPage } from "@/components/settings/SettingsPage";
import { NotificationsPage } from "@/components/notifications/NotificationsPage";
import { SnippetEditorDialog } from "@/components/snippets/SnippetEditorDialog";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { useUpdateStore } from "@/stores/useUpdateStore";
import { useNotificationStore } from "@/stores/useNotificationStore";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { openBrowser, readFooterSettings, registerAppInstall, type FooterSettings } from "@/lib/tauri";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  AlertTriangle,
  ExternalLink,
  Download,
  Github,
  Info,
  X,
} from "lucide-react";

export function AppLayout() {
  const { activeView, openNotification } = useUIStore();
  const { settings, loadSettings } = useSettingsStore();
  const { announcement, announcementDismissed, dismissAnnouncement, checkUpdates } = useUpdateStore();
  const { activeNotification, dismissNotification, startPolling } = useNotificationStore();
  const [footerSettings, setFooterSettings] = useState<FooterSettings>({
    left_text: "Espander v0.1.0 · MIT License",
    link_label: "GitHub",
    link_url: "https://github.com/ashikhosenpro/Expander",
    show_github_icon: true,
  });

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    if (!settings.first_launch_complete) {
      getCurrentWindow().show().catch(() => {});
      getCurrentWindow().setFocus().catch(() => {});
    }
  }, [settings.first_launch_complete]);

  useEffect(() => {
    checkUpdates();
  }, [checkUpdates]);

  useEffect(() => {
    readFooterSettings()
      .then(setFooterSettings)
      .catch((error) => console.error("Failed to load footer settings:", error));
  }, []);

  useEffect(() => {
    const cleanup = startPolling();
    return cleanup;
  }, [startPolling]);

  useEffect(() => {
    const deviceKey = "espander_device_id";
    const pingKey = "espander_install_ping_date";
    let deviceId = localStorage.getItem(deviceKey);

    if (!deviceId) {
      deviceId = crypto.randomUUID();
      localStorage.setItem(deviceKey, deviceId);
    }

    const today = new Date().toISOString().split("T")[0];
    if (localStorage.getItem(pingKey) !== today) {
      registerAppInstall(deviceId)
        .then(() => localStorage.setItem(pingKey, today))
        .catch((error) => console.error("Failed to register app install:", error));
    }
  }, []);

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
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1.5 border-amber-500/30 text-amber-300 hover:text-amber-200"
            onClick={() => openBrowser("https://espanso.org/install/")}
          >
            <Download className="h-3 w-3" /> Install Espanso
          </Button>
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
          {activeNotification && activeView !== "settings" && activeView !== "notifications" && (
            <div
              role="button"
              tabIndex={0}
              onClick={() => openNotification(activeNotification.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  openNotification(activeNotification.id);
                }
              }}
              className={cn(
                "relative cursor-pointer border-b px-4 py-3 text-xs shadow-[0_10px_30px_rgba(0,0,0,0.16)]",
                activeNotification.type_name === "success" && "border-emerald-500/25 bg-[linear-gradient(90deg,rgba(16,185,129,0.18),rgba(20,184,166,0.08),rgba(15,23,42,0.02))]",
                activeNotification.type_name === "warning" && "border-amber-500/25 bg-[linear-gradient(90deg,rgba(245,158,11,0.18),rgba(251,191,36,0.08),rgba(15,23,42,0.02))]",
                activeNotification.type_name === "error" && "border-red-500/25 bg-[linear-gradient(90deg,rgba(239,68,68,0.18),rgba(244,63,94,0.08),rgba(15,23,42,0.02))]",
                activeNotification.type_name === "info" && "border-sky-500/25 bg-[linear-gradient(90deg,rgba(14,165,233,0.18),rgba(99,102,241,0.08),rgba(15,23,42,0.02))]"
              )}
              style={{
                background: activeNotification.background_color || undefined,
                color: activeNotification.text_color || undefined,
              }}
            >
              {activeNotification.custom_css && (
                <style>{activeNotification.custom_css}</style>
              )}
              <div className="flex items-start gap-3">
                <div className={cn(
                  "mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md border",
                  activeNotification.type_name === "success" && "border-emerald-400/25 bg-emerald-400/10 text-emerald-300",
                  activeNotification.type_name === "warning" && "border-amber-400/25 bg-amber-400/10 text-amber-300",
                  activeNotification.type_name === "error" && "border-red-400/25 bg-red-400/10 text-red-300",
                  activeNotification.type_name === "info" && "border-sky-400/25 bg-sky-400/10 text-sky-300"
                )}>
                  <Info className="h-4 w-4" />
                </div>

                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="font-semibold text-foreground">{activeNotification.title}</span>
                    {activeNotification.action_url && activeNotification.action_label && (
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          openBrowser(activeNotification.action_url!);
                        }}
                        className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-background/40 px-2 py-0.5 text-[11px] font-medium text-foreground hover:bg-background/70"
                      >
                        {activeNotification.action_label}
                        <ExternalLink className="h-3 w-3" />
                      </button>
                    )}
                  </div>

                  {activeNotification.html_content ? (
                    <div
                      className="espander-rich-notification max-w-none text-muted-foreground [&_a]:font-medium [&_a]:text-sky-300 [&_a:hover]:text-sky-200 [&_b]:text-foreground [&_strong]:text-foreground [&_code]:rounded [&_code]:bg-background/50 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[11px] [&_p]:my-1 [&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-4"
                      onClick={(event) => {
                        const anchor = (event.target as HTMLElement).closest("a");
                        if (anchor instanceof HTMLAnchorElement && anchor.href) {
                          event.preventDefault();
                          event.stopPropagation();
                          openBrowser(anchor.href);
                        }
                      }}
                      dangerouslySetInnerHTML={{ __html: activeNotification.html_content }}
                    />
                  ) : (
                    <p className="truncate text-muted-foreground">{activeNotification.message}</p>
                  )}
                </div>

                {activeNotification.dismissible && (
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      dismissNotification(activeNotification.id);
                    }}
                    className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md border border-border/50 bg-background/30 text-muted-foreground hover:bg-background/70 hover:text-foreground"
                    aria-label="Dismiss notification"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          )}
          <main className="app-main flex-1 overflow-y-auto scrollbar-thin">
            {activeView === "settings" ? (
              <SettingsPage />
            ) : activeView === "notifications" ? (
              <NotificationsPage />
            ) : (
              <SnippetListPage />
            )}
          </main>
          <footer className="app-footer flex items-center justify-between px-4 py-2 border-t border-border bg-muted/20">
            <p className="text-[11px] text-muted-foreground/70">
              {footerSettings.left_text}
            </p>
            {footerSettings.link_url && footerSettings.link_label && (
              <button
                onClick={() => openBrowser(footerSettings.link_url)}
                className="text-[11px] text-muted-foreground/70 hover:text-foreground flex items-center gap-1.5 transition-colors"
              >
                {footerSettings.show_github_icon && <Github className="h-3 w-3" />}
                {footerSettings.link_label}
                <ExternalLink className="h-2.5 w-2.5" />
              </button>
            )}
          </footer>
        </div>
      </div>
      <SnippetEditorDialog />
    </div>
  );
}
