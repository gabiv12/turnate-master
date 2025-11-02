// src/context/UserContext.jsx
import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import api, { getAuthToken, setAuthToken, clearAuthToken } from "../services/api";

// === helpers de rol (tolerantes) ===
function hasRole(user, name) {
  if (!user) return false;
  const target = String(name || "").toLowerCase();

  // rol simple
  const single = String(user.rol || "").toLowerCase();
  if (single === target) return true;

  // array de roles
  const roles = user.roles || [];
  for (const r of roles) {
    const v = (r && (r.nombre || r)) ? String(r.nombre || r).toLowerCase() : "";
    if (v === target) return true;
  }

  // flags alternativos comunes
  if ((user.es_emprendedor || user.is_emprendedor) && target === "emprendedor") return true;

  return false;
}

const UserCtx = createContext(null);
export const useUser = () => useContext(UserCtx);

export function UserProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); // evita "Cargando..." infinito si no se corta

  const boot = useCallback(async () => {
    setLoading(true);
    try {
      const t = getAuthToken();
      if (!t) {
        setUser(null);
        setLoading(false);
        return;
      }
      const { data } = await api.get("/usuarios/me");
      setUser(data || null);
    } catch {
      clearAuthToken();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    boot();
  }, [boot]);

  const refreshUser = useCallback(async () => {
    try {
      const { data } = await api.get("/usuarios/me");
      setUser(data || null);
      return data || null;
    } catch {
      return null;
    }
  }, []);

  const logout = useCallback(() => {
    clearAuthToken();
    try { localStorage.removeItem("user"); } catch {}
    setUser(null);
  }, []);

  const value = {
    user,
    setUser,
    loading,
    isAuthenticated: !!user,
    isEmprendedor: hasRole(user, "emprendedor"),
    isAdmin: hasRole(user, "admin"),
    refreshUser,
    logout,
    setSession: (token, u = null) => {
      setAuthToken(token);
      if (u) setUser(u);
    },
  };

  return <UserCtx.Provider value={value}>{children}</UserCtx.Provider>;
}

// ⬇️ export default también, así no tenés que tocar main.jsx
export default UserProvider;
