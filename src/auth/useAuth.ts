import { useCallback, useEffect, useRef, useState } from "react";
import { apiGet } from "../api";

export type User = {
  id: number;
  email?: string;
  name?: string;
  picture?: string;
  [key: string]: unknown;
};

type MeResponse = {
  ok: boolean;
  user: User | null;
  error?: string;
};

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const didInitRef = useRef(false);

  const refreshMe = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiGet("/me");
      if (!res.ok || !res.data || typeof res.data !== "object") {
        setUser(null);
        setError(res.error || "failed to load session");
        return;
      }

      const payload = res.data as MeResponse;
      if (payload.ok && payload.user) {
        setUser(payload.user);
      } else {
        setUser(null);
      }
    } catch (e) {
      setUser(null);
      setError(String(e));
    } finally {
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

  return { user, loading, error, refreshMe, setUser };
}
