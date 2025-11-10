// src/context/UserContext.jsx
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import api, { getAuthToken, setSession as lsSetSession, clearAuthToken, getUser as lsGetUser, setUser as lsSetUser } from "../services/api";
import { me as meSvc } from "../services/usuarios";

const Ctx = createContext(null);

export function UserProvider({ children }) {
  const [user, setUser] = useState(() => lsGetUser() || null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);

  const isAuth = !!getAuthToken();

  // ---- helpers de sesión (compat con el resto del proyecto) ----
  const setSession = (token, nextUser) => {
    // persiste en LS con los helpers de api.js
    lsSetSession(token || null, nextUser || null);
    setUser(nextUser || null);
  };

  const logout = () => {
    try { clearAuthToken(); } catch {}
    // limpiamos usuario en LS para evitar flashes
    lsSetUser(null);
    setUser(null);
    // redirigimos sin depender de react-router (es global y confiable)
    window.location.assign("/login");
  };

  // ---- carga inicial: me() una sola vez ----
  const refreshUser = async () => {
    try {
      const data = await meSvc(); // GET /usuarios/me
      // me() devuelve el usuario normalizado
      if (data && typeof data === "object") {
        lsSetUser(data);
        setUser(data);
      }
      return data;
    } catch (e) {
      // si hay 401, limpiamos estado pero NO rompemos la app
      if (e?.response?.status === 401) {
        try { clearAuthToken(); } catch {}
        lsSetUser(null);
        setUser(null);
      }
      return null;
    }
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      setIsLoadingUser(true);
      try {
        // si hay token, intentamos validar; si no, solo dejamos isLoadingUser=false
        if (getAuthToken()) {
          await refreshUser();
        } else {
          // mantener cualquier user residual limpio
          lsSetUser(null);
          setUser(null);
        }
      } finally {
        if (mounted) setIsLoadingUser(false);
      }
    })();
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo(() => ({
    user,
    isAuth: !!getAuthToken(),
    isLoadingUser,
    // compat con el resto de páginas
    setSession,
    refreshUser,
    logout,
  }), [user, isLoadingUser]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useUser() {
  return useContext(Ctx);
}
