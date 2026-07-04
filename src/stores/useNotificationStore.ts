import { create } from "zustand";
import { fetchNotifications, type Notification } from "@/lib/tauri";

interface NotificationStore {
  notifications: Notification[];
  activeNotification: Notification | null;
  isFetching: boolean;
  fetchNotificationsList: () => Promise<void>;
  fetchActiveNotification: () => Promise<void>;
  dismissNotification: (id: string) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  isRead: (id: string) => boolean;
  startPolling: (intervalMs?: number) => () => void;
}

export const useNotificationStore = create<NotificationStore>((set, get) => {
  const cacheKey = "espander_notifications_cache";

  const getLocalDateKey = (date = new Date()) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const minutesSinceMidnight = (date: Date) => date.getHours() * 60 + date.getMinutes();

  const parseTimeToMinutes = (value: string): number | null => {
    const match = value.trim().match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return null;
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
    return hours * 60 + minutes;
  };

  const getNotificationTime = (notification: Notification) => {
    const explicit = notification.created_at ?? notification.updated_at ?? notification.start_date;
    if (explicit) {
      const parsed = new Date(explicit).getTime();
      if (Number.isFinite(parsed)) return parsed;
    }

    const idDate = notification.id.match(/notice-(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/);
    if (idDate) {
      const [, year, month, day, hour, minute, second] = idDate;
      const parsed = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}`).getTime();
      if (Number.isFinite(parsed)) return parsed;
    }

    return 0;
  };

  const getOccurrenceKey = (notification: Notification, now = new Date()) => {
    const today = getLocalDateKey(now);
    if (notification.schedule_mode === "time_windows" && notification.schedule_time_windows?.length) {
      const current = minutesSinceMidnight(now);
      const fallbackWindow = Math.max(1, notification.schedule_window_minutes ?? 60);

      for (const windowValue of notification.schedule_time_windows) {
        const [startRaw, endRaw] = windowValue.split("-").map((part) => part.trim());
        const start = parseTimeToMinutes(startRaw);
        if (start === null) continue;

        const end = endRaw ? parseTimeToMinutes(endRaw) : Math.min(start + fallbackWindow, 24 * 60 - 1);
        if (end === null) continue;

        if (current >= start && current <= end) {
          return `${today}_${startRaw}-${endRaw || `${String(Math.floor(end / 60)).padStart(2, "0")}:${String(end % 60).padStart(2, "0")}`}`;
        }
      }
    }

    return today;
  };

  const isDismissedToday = (notification: Notification): boolean => {
    const id = notification.id;
    const dismissedData = localStorage.getItem(`dismissed_notif_${id}`);
    if (!dismissedData) return false;

    try {
      const { dismissedAt, occurrence } = JSON.parse(dismissedData);
      const todayStr = getLocalDateKey();
      return dismissedAt === todayStr && (!occurrence || occurrence === getOccurrenceKey(notification));
    } catch {
      return false;
    }
  };

  const getDailyShowCount = (id: string): number => {
    const data = localStorage.getItem(`shown_notif_${id}`);
    if (!data) return 0;
    try {
      const parsed = JSON.parse(data);
      return parsed.date === getLocalDateKey() ? Number(parsed.count) || 0 : 0;
    } catch {
      return 0;
    }
  };

  const bumpDailyShowCount = (id: string) => {
    const count = getDailyShowCount(id) + 1;
    localStorage.setItem(`shown_notif_${id}`, JSON.stringify({ date: getLocalDateKey(), count }));
  };

  const isInTimeWindow = (notification: Notification, now: Date) => {
    const windows = notification.schedule_time_windows?.filter(Boolean) ?? [];
    if (windows.length === 0) return true;

    const current = minutesSinceMidnight(now);
    const fallbackWindow = Math.max(1, notification.schedule_window_minutes ?? 60);

    return windows.some((windowValue) => {
      const [startRaw, endRaw] = windowValue.split("-").map((part) => part.trim());
      const start = parseTimeToMinutes(startRaw);
      if (start === null) return false;

      const end = endRaw ? parseTimeToMinutes(endRaw) : Math.min(start + fallbackWindow, 24 * 60 - 1);
      if (end === null) return false;

      return current >= start && current <= end;
    });
  };

  const isWithinSchedule = (notification: Notification, now: Date) => {
    const mode = notification.schedule_mode ?? "always";

    if (mode === "interval_days") {
      const interval = Math.max(1, notification.schedule_interval_days ?? 1);
      const baseline = notification.start_date ? new Date(notification.start_date) : now;
      const startOfBaseline = new Date(baseline.getFullYear(), baseline.getMonth(), baseline.getDate()).getTime();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const days = Math.floor((startOfToday - startOfBaseline) / 86400000);
      return days >= 0 && days % interval === 0;
    }

    if (mode === "time_windows") {
      return isInTimeWindow(notification, now);
    }

    return true;
  };

  const isRead = (id: string): boolean => {
    return localStorage.getItem(`read_notif_${id}`) === "1";
  };

  const markAsRead = (id: string) => {
    localStorage.setItem(`read_notif_${id}`, "1");
  };

  const getScheduledNotifications = (notifications: Notification[]): Notification[] => {
    const now = new Date();

    return notifications.filter((notif) => {
      if (!notif.active) return false;

      if (notif.start_date) {
        const startDate = new Date(notif.start_date);
        if (startDate > now) return false;
      }

      if (notif.end_date) {
        const endDate = new Date(notif.end_date);
        if (endDate < now) return false;
      }

      if (!isWithinSchedule(notif, now)) return false;

      const maxPerDay = notif.schedule_max_per_day ?? null;
      if (maxPerDay && maxPerDay > 0 && getDailyShowCount(notif.id) >= maxPerDay) return false;

      return true;
    }).sort((a, b) => getNotificationTime(b) - getNotificationTime(a));
  };

  const getScheduledActiveNotification = (notifications: Notification[], trackDisplay = true): Notification | null => {
    const eligible = getScheduledNotifications(notifications).filter((notif) => {
      if (isDismissedToday(notif)) return false;
      if (isRead(notif.id)) return false;

      return true;
    });

    if (eligible.length === 0) return null;

    eligible.sort((a, b) => {
      const priority = b.priority - a.priority;
      return priority !== 0 ? priority : getNotificationTime(b) - getNotificationTime(a);
    });

    const active = eligible[0];
    const current = trackDisplay ? get().activeNotification : null;
    if (trackDisplay && (!current || current.id !== active.id || getOccurrenceKey(current) !== getOccurrenceKey(active))) {
      bumpDailyShowCount(active.id);
    }
    return active;
  };

  const readCachedNotifications = (): Notification[] => {
    try {
      const cached = localStorage.getItem(cacheKey);
      if (!cached) return [];
      const parsed = JSON.parse(cached);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const cachedNotifications = getScheduledNotifications(readCachedNotifications());

  return {
    notifications: cachedNotifications,
    activeNotification: getScheduledActiveNotification(cachedNotifications, false),
    isFetching: false,
    isRead,

    fetchNotificationsList: async () => {
      set({ isFetching: true });
      try {
        const res = await fetchNotifications();
        localStorage.setItem(cacheKey, JSON.stringify(res.notifications));
        const scheduled = getScheduledNotifications(res.notifications);
        const active = getScheduledActiveNotification(scheduled);
        set({ notifications: scheduled, activeNotification: active, isFetching: false });
      } catch (err) {
        console.error("Failed to fetch notifications:", err);
        set({ isFetching: false });
      }
    },

    fetchActiveNotification: async () => {
      await get().fetchNotificationsList();
    },

    dismissNotification: (id: string) => {
      const notification = get().notifications.find((item) => item.id === id);
      if (notification?.repeat_daily) {
        const todayStr = getLocalDateKey();
        localStorage.setItem(
          `dismissed_notif_${id}`,
          JSON.stringify({ dismissedAt: todayStr, occurrence: getOccurrenceKey(notification) })
        );
      } else {
        markAsRead(id);
      }
      get().fetchActiveNotification();
    },

    markAsRead: (id: string) => {
      markAsRead(id);
      get().fetchActiveNotification();
    },

    markAllAsRead: () => {
      get().notifications.forEach((notification) => markAsRead(notification.id));
      get().fetchActiveNotification();
    },

    startPolling: (intervalMs = 300000) => { // 5 minutes default
      get().fetchActiveNotification();
      const interval = setInterval(() => {
        get().fetchActiveNotification();
      }, intervalMs);

      // Return cleanup function
      return () => clearInterval(interval);
    },
  };
});
