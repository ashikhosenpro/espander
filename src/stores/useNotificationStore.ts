import { create } from "zustand";
import { fetchNotifications, type Notification } from "@/lib/tauri";

interface NotificationStore {
  activeNotification: Notification | null;
  isFetching: boolean;
  fetchActiveNotification: () => Promise<void>;
  dismissNotification: (id: string) => void;
  startPolling: (intervalMs?: number) => () => void;
}

export const useNotificationStore = create<NotificationStore>((set, get) => {
  // Helper to check if notification is dismissed for today
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

  const getScheduledActiveNotification = (notifications: Notification[]): Notification | null => {
    const now = new Date();

    const eligible = notifications.filter((notif) => {
      // 1. Must be active
      if (!notif.active) return false;

      // 2. Must not be dismissed today
      if (isDismissedToday(notif.id)) return false;

      // 3. Date schedule check
      if (notif.start_date) {
        const startDate = new Date(notif.start_date);
        // Start date is in the future
        if (startDate > now) return false;
      }

      if (notif.end_date) {
        const endDate = new Date(notif.end_date);
        // End date has passed
        if (endDate < now) return false;
      }

      return true;
    });

    if (eligible.length === 0) return null;

    // Sort by priority descending (highest priority first)
    eligible.sort((a, b) => b.priority - a.priority);

    return eligible[0];
  };

  return {
    activeNotification: null,
    isFetching: false,

    fetchActiveNotification: async () => {
      set({ isFetching: true });
      try {
        const res = await fetchNotifications();
        const active = getScheduledActiveNotification(res.notifications);
        set({ activeNotification: active, isFetching: false });
      } catch (err) {
        console.error("Failed to fetch notifications:", err);
        set({ isFetching: false });
      }
    },

    dismissNotification: (id: string) => {
      const todayStr = new Date().toISOString().split("T")[0];
      localStorage.setItem(
        `dismissed_notif_${id}`,
        JSON.stringify({ dismissedAt: todayStr })
      );
      // Re-evaluate to clear or show next highest priority notification
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
