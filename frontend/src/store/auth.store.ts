import { create } from "zustand";
import { persist } from "zustand/middleware";
import { jwtDecode } from "jwt-decode";
import { setTokens, clearTokens } from "@/lib/api/client";
import { authApi } from "@/lib/api/services";
import { getApiErrorMessage, isNetworkError, withRetry } from "@/lib/utils/errors";
import type { AuthUser, JWTPayload, UserRole } from "@/types";

interface AuthState {
  user: AuthUser | null;
  role: UserRole | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  // Zustand's persist middleware reads localStorage asynchronously — on the
  // very first render after a hard reload, `isAuthenticated` is still the
  // default `false` for one tick before rehydration lands. Consumers that
  // make redirect decisions (e.g. the dashboard layout) must wait for this
  // flag before trusting `isAuthenticated`, or they'll bounce an
  // actually-logged-in user to /login on every page refresh.
  hasHydrated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  fetchMe: () => Promise<void>;
  clearError: () => void;
  setHasHydrated: (value: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      role: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      hasHydrated: false,

      login: async (email, password) => {
        set({ isLoading: true, error: null });
        try {
          // withRetry: a flaky mobile connection can drop the login POST
          // itself — retry transparently on network/timeout errors, but
          // never on a real 401 (wrong credentials) or 429 (throttled).
          const tokens = await withRetry(() => authApi.login(email, password));
          setTokens(tokens.access, tokens.refresh);
          const payload = jwtDecode<JWTPayload>(tokens.access);
          // Fetch full user profile
          const user = await withRetry(() => authApi.me());
          set({ user, role: payload.role, isAuthenticated: true, isLoading: false });
        } catch (err: unknown) {
          set({ error: getApiErrorMessage(err, "Invalid credentials."), isLoading: false });
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
          const user = await withRetry(() => authApi.me());
          set({ user, role: user.role as UserRole, isAuthenticated: true });
        } catch (err: unknown) {
          // A network error means we're offline/flaky, not that the
          // session is invalid — keep the tokens and stay "authenticated"
          // so the dashboard layout can retry on reconnect instead of
          // silently bouncing the user back to /login (the bug this
          // guards against: a weak mobile connection logging users out
          // on every page refresh).
          if (!isNetworkError(err)) {
            clearTokens();
            set({ user: null, role: null, isAuthenticated: false });
          }
        }
      },

      clearError: () => set({ error: null }),
      setHasHydrated: (value) => set({ hasHydrated: value }),
    }),
    {
      name: "sms-auth",
      // Only persist the boolean auth flag and role — never the user object
      // (which contains email and PII). The user profile is re-fetched via
      // fetchMe() when the layout mounts after a page refresh.
      partialize: (s) => ({ isAuthenticated: s.isAuthenticated, role: s.role }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);
