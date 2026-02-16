import type { ReactNode } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { apiGet } from "../api";

export type User = {
  id?: number | string;
  sub?: string;
  email?: string;
  name?: string;
  picture?: string;
  displayName?: string;
  username?: string;
  [key: string]: unknown;
};

type MeResponse = {
  ok: boolean;
  user: User | null;
  error?: string;
};

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  error: string | null;
  sessionExpired: boolean;
  applyUserPatch: (patch: Partial<User>) => void;
  refreshMe: () => Promise<void>;
  logout: () => Promise<void>;
  dismissSessionExpired: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const API_BASE = import.meta.env.VITE_API_BASE_URL;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState<boolean>(false);
  const didInitRef = useRef(false);
  const previousUserRef = useRef<User | null>(null);
  const lastFocusRefreshMsRef = useRef<number>(0);

  const refreshMe = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiGet("/me");
      if (res.status === 401 || res.status === 403) {
        if (previousUserRef.current) {
          setSessionExpired(true);
        }
        setUser(null);
        return;
      }
      if (!res.ok || !res.data || typeof res.data !== "object") {
        if (previousUserRef.current) {
          setSessionExpired(true);
        }
        setUser(null);
        setError(res.error || "failed to load session");
        return;
      }

      const payload = res.data as MeResponse;
      if (payload.ok && payload.user) {
        setUser(payload.user);
        setSessionExpired(false);
      } else if (payload.ok && payload.user === null) {
        if (previousUserRef.current) {
          setSessionExpired(true);
        }
        setUser(null);
      } else {
        if (previousUserRef.current) {
          setSessionExpired(true);
        }
        setUser(null);
        if (payload.error) {
          setError(payload.error);
        }
      }
    } catch (e) {
      setUser(null);
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  const applyUserPatch = useCallback((patch: Partial<User>) => {
    setUser((previous) => {
      if (!previous) return previous;
      return {
        ...previous,
        ...patch
      };
    });
    setSessionExpired(false);
  }, []);

  const logout = useCallback(async () => {
    if (!API_BASE || !API_BASE.trim()) {
      throw new Error("VITE_API_BASE_URL is missing or empty");
    }

    setLoading(true);
    setError(null);
    try {
      await fetch(`${API_BASE}/auth/logout`, {
        method: "POST",
        credentials: "include"
      });
    } catch (e) {
      setError(String(e));
    } finally {
      setUser(null);
      setSessionExpired(false);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (didInitRef.current) {
      return;
    }
    didInitRef.current = true;
    void refreshMe();
  }, [refreshMe]);

  useEffect(() => {
    previousUserRef.current = user;
  }, [user]);

  useEffect(() => {
    const handleFocus = () => {
      const now = Date.now();
      if (now - lastFocusRefreshMsRef.current < 30000) {
        return;
      }
      lastFocusRefreshMsRef.current = now;
      void refreshMe();
    };
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [refreshMe]);

  const dismissSessionExpired = useCallback(() => {
    setSessionExpired(false);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      error,
      sessionExpired,
      applyUserPatch,
      refreshMe,
      logout,
      dismissSessionExpired
    }),
    [user, loading, error, sessionExpired, applyUserPatch, refreshMe, logout, dismissSessionExpired]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
