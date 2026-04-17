import { create } from 'zustand';
import type { Notification } from '@/types';
import { notificationAPI } from '@/api/endpoints';

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  wsConnected: boolean;
  ws: WebSocket | null;
  fetchNotifications: () => Promise<void>;
  fetchUnreadCount: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  connectWS: () => void;
  disconnectWS: () => void;
  addNotification: (n: Notification) => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  wsConnected: false,
  ws: null,

  fetchNotifications: async () => {
    try {
      const res = await notificationAPI.list();
      set({ notifications: res.data.results });
    } catch { /* ignore */ }
  },

  fetchUnreadCount: async () => {
    try {
      const res = await notificationAPI.unreadCount();
      set({ unreadCount: res.data.count });
    } catch { /* ignore */ }
  },

  markRead: async (id) => {
    await notificationAPI.markRead(id);
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, is_read: true } : n
      ),
      unreadCount: Math.max(0, state.unreadCount - 1),
    }));
  },

  markAllRead: async () => {
    await notificationAPI.markAllRead();
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, is_read: true })),
      unreadCount: 0,
    }));
  },

  addNotification: (n) => {
    set((state) => ({
      notifications: [n, ...state.notifications],
      unreadCount: state.unreadCount + 1,
    }));
  },

  connectWS: () => {
    const token = localStorage.getItem('access_token');
    if (!token) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/notifications/?token=${token}`);

    ws.onopen = () => set({ wsConnected: true });
    ws.onclose = () => {
      set({ wsConnected: false });
      // Reconnect after 3 seconds
      setTimeout(() => get().connectWS(), 3000);
    };
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'new_notification') {
        get().addNotification(data.notification);
      }
      if (data.type === 'unread_count') {
        set({ unreadCount: data.count });
      }
    };

    set({ ws });
  },

  disconnectWS: () => {
    const { ws } = get();
    if (ws) ws.close();
    set({ ws: null, wsConnected: false });
  },
}));
