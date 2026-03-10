import { create } from "zustand";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
}

interface AuthStore {
  user: AuthUser | null;
  isLoading: boolean;
  fetchUser: () => Promise<void>;
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  register: (email: string, name: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  isLoading: true,

  fetchUser: async () => {
    try {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const { data } = await res.json();
        set({ user: data, isLoading: false });
      } else {
        set({ user: null, isLoading: false });
      }
    } catch {
      set({ user: null, isLoading: false });
    }
  },

  login: async (email, password) => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json();
      if (res.ok) {
        set({ user: json.data });
        return { ok: true };
      }
      return { ok: false, error: json.error?.message ?? "로그인에 실패했습니다" };
    } catch {
      return { ok: false, error: "네트워크 오류가 발생했습니다" };
    }
  },

  register: async (email, name, password) => {
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, password }),
      });
      const json = await res.json();
      if (res.ok) {
        set({ user: json.data });
        return { ok: true };
      }
      return { ok: false, error: json.error?.message ?? "회원가입에 실패했습니다" };
    } catch {
      return { ok: false, error: "네트워크 오류가 발생했습니다" };
    }
  },

  logout: async () => {
    // Unsubscribe from push notifications before logging out
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await fetch("/api/push/unsubscribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ endpoint: sub.endpoint }),
          }).catch(() => {});
          await sub.unsubscribe().catch(() => {});
        }
      } catch {
        // Ignore SW errors during logout
      }
    }
    await fetch("/api/auth/logout", { method: "POST" });
    set({ user: null });
  },
}));
