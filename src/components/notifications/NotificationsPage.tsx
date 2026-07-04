import { useEffect, useMemo } from "react";
import { ArrowLeft, Bell, CheckCheck, ExternalLink, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { openBrowser, type Notification } from "@/lib/tauri";
import { useNotificationStore } from "@/stores/useNotificationStore";
import { useUIStore } from "@/stores/useUIStore";
import { useGlobalTextStore } from "@/stores/useGlobalTextStore";
import { HtmlNotificationFrame, isHtmlNotification } from "./HtmlNotificationFrame";

function notificationTone(notification: Notification) {
  if (notification.type_name === "warning") {
    return "border-amber-500/25 bg-amber-500/[0.06]";
  }
  if (notification.type_name === "error" || notification.type_name === "danger") {
    return "border-red-500/25 bg-red-500/[0.06]";
  }
  if (notification.type_name === "success") {
    return "border-emerald-500/25 bg-emerald-500/[0.06]";
  }
  return "border-sky-500/25 bg-sky-500/[0.06]";
}

function notificationDate(notification: Notification) {
  const value = notification.created_at ?? notification.updated_at ?? notification.start_date;
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function NotificationsPage() {
  const {
    notifications,
    isFetching,
    fetchNotificationsList,
    markAsRead,
    markAllAsRead,
    isRead,
  } = useNotificationStore();
  const { selectedNotificationId, openNotification, clearSelectedNotification } = useUIStore();
  const { texts, fetchTexts } = useGlobalTextStore();

  useEffect(() => {
    fetchNotificationsList();
    fetchTexts();
  }, [fetchNotificationsList, fetchTexts]);

  const selectedNotification = useMemo(
    () => notifications.find((notification) => notification.id === selectedNotificationId) ?? null,
    [notifications, selectedNotificationId]
  );

  if (selectedNotification) {
    const read = isRead(selectedNotification.id);
    const htmlMode = isHtmlNotification(selectedNotification);

    return (
      <div className="min-h-full p-5">
        <div className={cn("mx-auto space-y-4", htmlMode ? "max-w-6xl" : "max-w-4xl")}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={clearSelectedNotification}
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back
            </Button>
            {!read && (
              <Button
                size="sm"
                className="h-8 gap-1.5 text-xs"
                onClick={() => markAsRead(selectedNotification.id)}
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Mark as read
              </Button>
            )}
          </div>

          {htmlMode ? (
            <div className="relative">
              <HtmlNotificationFrame
                notification={selectedNotification}
                className="block w-full border-0 bg-transparent"
                onLinkClick={openBrowser}
              />
            </div>
          ) : (
            <article
              className={cn("overflow-hidden rounded-lg border bg-card shadow-sm", notificationTone(selectedNotification))}
              style={{
                background: selectedNotification.background_color || undefined,
                color: selectedNotification.text_color || undefined,
              }}
            >
              <div className="border-b border-border/60 p-5">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="rounded border border-border/60 px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                    {read ? "Read" : "Unread"}
                  </span>
                  <span className="rounded border border-border/60 px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                    {selectedNotification.type_name}
                  </span>
                </div>
                <h1 className="text-xl font-semibold tracking-normal text-foreground">
                  {selectedNotification.title}
                </h1>
              </div>

              <div className="space-y-4 p-5">
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                  {selectedNotification.message}
                </p>

                {selectedNotification.action_url && selectedNotification.action_label && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs"
                    onClick={() => openBrowser(selectedNotification.action_url!)}
                  >
                    {selectedNotification.action_label}
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </article>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full p-5">
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold tracking-normal">{texts.notifications_title}</h1>
            <p className="mt-1 text-xs text-muted-foreground">
              {texts.notifications_subtitle}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={fetchNotificationsList}
              disabled={isFetching}
            >
              <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={markAllAsRead}
              disabled={notifications.length === 0 || notifications.every((notification) => isRead(notification.id))}
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Mark all as read
            </Button>
          </div>
        </div>

        {notifications.length > 0 ? (
          <div className="space-y-2">
            {notifications.map((notification) => {
              const read = isRead(notification.id);

              return (
                <button
                  key={notification.id}
                  onClick={() => openNotification(notification.id)}
                  className={cn(
                    "w-full overflow-hidden rounded-lg border p-4 text-left text-xs shadow-sm transition-colors hover:bg-muted/40",
                    notificationTone(notification),
                    read && "opacity-75"
                  )}
                  style={{
                    background: notification.background_color || undefined,
                    color: notification.text_color || undefined,
                  }}
                >
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      "mt-1 h-2.5 w-2.5 flex-shrink-0 rounded-full",
                      read ? "bg-muted-foreground/40" : "bg-sky-400"
                    )} />
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-foreground">{notification.title}</span>
                        <span className="rounded border border-border/60 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                          {read ? "Read" : "Unread"}
                        </span>
                        {notificationDate(notification) && (
                          <span className="text-[11px] text-muted-foreground">
                            {notificationDate(notification)}
                          </span>
                        )}
                      </div>
                      <p className="line-clamp-2 text-muted-foreground">
                        {isHtmlNotification(notification) ? "HTML notification" : notification.message}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="flex min-h-64 flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card p-8 text-center">
            <Bell className="mb-3 h-8 w-8 text-muted-foreground/60" />
            <p className="text-sm font-medium">No notifications</p>
            <p className="mt-1 text-xs text-muted-foreground">
              New messages will appear here automatically.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
