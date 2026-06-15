import { create } from "zustand";
import { persist } from "zustand/middleware";
import { jwtDecode } from "jwt-decode";
import { setTokens, clearTokens } from "@/lib/api/client";
import { authApi } from "@/lib/api/services";
import type { AuthUser, JWTPayload, UserRole } from "@/types";

interface AuthState {
  user: AuthUser | null;
  role: UserRole | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  fetchMe: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      role: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      login: async (email, password) => {
        set({ isLoading: true, error: null });
        try {
          const tokens = await authApi.login(email, password);
          setTokens(tokens.access, tokens.refresh);
          const payload = jwtDecode<JWTPayload>(tokens.access);
          // Fetch full user profile
          const user = await authApi.me();
          set({ user, role: payload.role, isAuthenticated: true, isLoading: false });
        } catch (err: unknown) {
          const msg =
            (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
            "Invalid credentials.";
          set({ error: msg, isLoading: false });
          throw err;
        }
      },

      logout: async () => {
        try {
          const { default: Cookies } = await import("js-cookie");
          const refresh = Cookies.get("sms_refresh");
          if (refresh) await authApi.logout(refresh);
        } finally {
          clearTokens();
          set({ user: null, role: null, isAuthenticated: false });
        }
      },

      fetchMe: async () => {
        try {
          const user = await authApi.me();
          set({ user, role: user.role as UserRole, isAuthenticated: true });
        } catch {
          clearTokens();
          set({ user: null, role: null, isAuthenticated: false });
        }
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: "sms-auth",
      partialize: (s) => ({ user: s.user, role: s.role, isAuthenticated: s.isAuthenticated }),
    },
  ),
);
