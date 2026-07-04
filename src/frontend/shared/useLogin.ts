import { useCallback, useEffect, useState } from "react";
import { api } from "./api";

type Role = "chef" | "manager";

export function useLogin(role: Role) {
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<{ role: Role | null }>("/auth/me")
      .then((res) => setLoggedIn(res.role === role))
      .catch(() => setLoggedIn(false));
  }, [role]);

  const login = useCallback(
    async (password: string) => {
      setError(null);
      try {
        await api.post("/auth/login", { role, password });
        setLoggedIn(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Login failed");
      }
    },
    [role]
  );

  const logout = useCallback(async () => {
    await api.post("/auth/logout");
    setLoggedIn(false);
  }, []);

  return { loggedIn, error, login, logout };
}
