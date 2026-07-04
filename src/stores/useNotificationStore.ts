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
  removeNotification: (id: string) => void;
  clearAllNotifications: () => void;
  isRead: (id: string) => boolean;
  isRemoved: (id: string) => boolean;
  startPolling: (intervalMs?: number) => () => void;
}

export const useNotificationStore = create<NotificationStore>((set, get) => {
  const isDismissedToday = (id: string): boolean => {
    const dismissedData = localStorage.getItem(`dismissed_notif_${id}`);
    if (!dismissedData) return false;

    try {
      const { dismissedAt } = JSON.parse(dismissedData);
      const todayStr = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
      return dismissedAt === todayStr;
    } catch {
      return false;
    }
  };

  const isRead = (id: string): boolean => {
    return localStorage.getItem(`read_notif_${id}`) === "1";
  };

  const isRemoved = (id: string): boolean => {
    return localStorage.getItem(`removed_notif_${id}`) === "1";
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

      return true;
    });
  };

  const getScheduledActiveNotification = (notifications: Notification[]): Notification | null => {
    const eligible = getScheduledNotifications(notifications).filter((notif) => {
      if (isDismissedToday(notif.id)) return false;
      if (isRead(notif.id)) return false;
      if (isRemoved(notif.id)) return false;

      return true;
    });

    if (eligible.length === 0) return null;

    // Sort by priority descending (highest priority first)
    eligible.sort((a, b) => b.priority - a.priority);

    return eligible[0];
  };

  return {
    notifications: [],
    activeNotification: null,
    isFetching: false,
    isRead,
    isRemoved,

    fetchNotificationsList: async () => {
      set({ isFetching: true });
      try {
        const res = await fetchNotifications();
        const scheduled = getScheduledNotifications(res.notifications);
        const visible = scheduled.filter((notification) => !isRemoved(notification.id));
        const active = getScheduledActiveNotification(scheduled);
        set({ notifications: visible, activeNotification: active, isFetching: false });
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
        const todayStr = new Date().toISOString().split("T")[0];
        localStorage.setItem(
          `dismissed_notif_${id}`,
          JSON.stringify({ dismissedAt: todayStr })
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

    removeNotification: (id: string) => {
      localStorage.setItem(`removed_notif_${id}`, "1");
      get().fetchActiveNotification();
    },

    clearAllNotifications: () => {
      get().notifications.forEach((notification) => {
        localStorage.setItem(`removed_notif_${notification.id}`, "1");
      });
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
