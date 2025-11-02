// src/context/UserContext.jsx
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import api, {
  getAuthToken,
  setAuthToken,
  clearAuthToken,
  getUser as getUserLS,
  setUser as setUserLS,
} from "../services/api.js";

const Ctx = createContext({
  user: null,
  isAuthenticated: false,
  isEmprendedor: false,
  setUser: () => {},
  refreshUser: async () => null,
  loginFromResponse: () => {},
  logout: () => {},
});

export function UserProvider({ children }) {
  const [user, setUser] = useState(() => getUserLS());

  useEffect(() => {
    // mantener en LS
    setUserLS(user);
  }, [user]);

  async function refreshUser() {
    try {
      const { data } = await api.get("/usuarios/me");
      if (data) setUser(data);
      return data;
    } catch (e) {
      if (e?.response?.status === 401) {
        // /me vencido -> sesión inválida
        clearAuthToken();
        setUser(null);
      }
      return null;
    }
  }

  function loginFromResponse({ token, user }) {
    if (token) setAuthToken(token);
    if (user) setUser(user);
  }

  function logout() {
    clearAuthToken();
    setUser(null);
  }

  const isEmprendedor = useMemo(() => {
    const roles = new Set();
    if (Array.isArray(user?.roles)) user.roles.forEach(r => roles.add(String(r).toLowerCase()));
    if (user?.rol) roles.add(String(user.rol).toLowerCase());
    return roles.has("emprendedor");
  }, [user]);

  const value = useMemo(() => ({
    user,
    isAuthenticated: !!getAuthToken(),
    isEmprendedor,
    setUser,
    refreshUser,
    loginFromResponse,
    logout,
  }), [user, isEmprendedor]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useUser() {
  return useContext(Ctx);
}
