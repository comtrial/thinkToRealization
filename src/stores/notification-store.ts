import { create } from "zustand";

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  nodeId: string | null;
  actorId: string | null;
  isRead: boolean;
  createdAt: string;
}

interface NotificationStore {
  notifications: NotificationItem[];
  unreadCount: number;
  isLoading: boolean;
  fetchNotifications: () => Promise<void>;
  fetchUnreadCount: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
}

export const useNotificationStore = create<NotificationStore>((set) => ({
  notifications: [],
  unreadCount: 0,
  isLoading: false,

  fetchNotifications: async () => {
    set({ isLoading: true });
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) {
        const { data } = await res.json();
        set({ notifications: data, isLoading: false });
      } else {
        set({ isLoading: false });
      }
    } catch {
      set({ isLoading: false });
    }
  },

  fetchUnreadCount: async () => {
    try {
      const res = await fetch("/api/notifications/unread-count");
      if (res.ok) {
        const { data } = await res.json();
        set({ unreadCount: data.count });
      }
    } catch {
      // silently fail
    }
  },

  markAsRead: async (id) => {
    try {
      const res = await fetch(`/api/notifications/${id}/read`, { method: "PUT" });
      if (res.ok) {
        set((s) => ({
          notifications: s.notifications.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
          unreadCount: Math.max(0, s.unreadCount - 1),
        }));
      }
    } catch {
      // silently fail
    }
  },

  markAllAsRead: async () => {
    try {
      const res = await fetch("/api/notifications/read-all", { method: "PUT" });
      if (res.ok) {
        set((s) => ({
          notifications: s.notifications.map((n) => ({ ...n, isRead: true })),
          unreadCount: 0,
        }));
      }
    } catch {
      // silently fail
    }
  },
}));
