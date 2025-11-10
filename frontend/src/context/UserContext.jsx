// src/context/UserContext.jsx
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import api, { getAuthToken, clearSession, setSession } from "../services/api";
import * as UserSvc from "../services/usuarios";

const Ctx = createContext(null);

export function UserProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);

  // evita loops si el back responde 401 repetido
  const lastAuthFailAt = useRef(0);

  const isAuthenticated = !!getAuthToken();

  const logout = React.useCallback(() => {
    try { clearSession(); } catch {}
    setUser(null);
    setIsLoadingUser(false);
    if (window.location.pathname !== "/login") {
      window.location.assign("/login");
    }
  }, []);

  const refreshUser = React.useCallback(async () => {
    // si no hay token, no pegamos /me
    if (!getAuthToken()) {
      setUser(null);
      setIsLoadingUser(false);
      return null;
    }
    try {
      setIsLoadingUser(true);
      const data = await UserSvc.me();
      setUser(data || null);
      return data || null;
    } catch (e) {
      // si 401, limpiar sesión una sola vez por ventana de 3s
      const st = e?.response?.status;
      if (st === 401) {
        const now = Date.now();
        if (now - lastAuthFailAt.current > 3000) {
          lastAuthFailAt.current = now;
          logout();
        } else {
          setUser(null);
          setIsLoadingUser(false);
        }
      } else {
        // otros errores: no tumbamos la sesión, pero dejamos el estado usable
        setIsLoadingUser(false);
      }
      return null;
    } finally {
      setIsLoadingUser(false);
    }
  }, [logout]);

  // hidratación inicial: SOLO si hay token
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!mounted) return;
      if (!getAuthToken()) { setIsLoadingUser(false); return; }
      await refreshUser();
    })();
    return () => { mounted = false; };
  }, [refreshUser]);

  const isEmprendedor = useMemo(() => {
    if (!user) return false;
    const roles = new Set();
    if (Array.isArray(user?.roles)) user.roles.forEach(r => roles.add(String(r).toLowerCase()));
    if (user?.rol) roles.add(String(user.rol).toLowerCase());
    return roles.has("emprendedor");
  }, [user]);

  const value = useMemo(() => ({
    user,
    setUser,
    isAuthenticated,
    isLoadingUser,
    isEmprendedor,
    refreshUser,
    logout,
  }), [user, isAuthenticated, isLoadingUser, isEmprendedor, refreshUser, logout]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useUser() {
  return useContext(Ctx);
}
