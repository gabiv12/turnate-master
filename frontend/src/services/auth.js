// src/services/auth.js
import api, { setAuthToken, TOKEN_KEY, USER_KEY } from "./api";

// Guarda user en localStorage (compat)
export function setStoredUser(user) {
  try {
    localStorage.setItem(USER_KEY, JSON.stringify(user || null));
  } catch {}
}
export function getStoredUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function login({ email, username, identity, password }) {
  const payload =
    email ? { email, password } :
    identity ? { identity, password } :
    username ? { username, password } :
    { email: username, password };

  const { data } = await api.post("/usuarios/login", payload);

  const token = data?.access_token || data?.token || data?.jwt;
  const user = data?.user || data?.usuario || data?.user_schema || data;

  if (!token || !user) throw new Error("Respuesta de login incompleta.");

  // ✅ Persistimos atómicamente token+usuario
  setSession(token, user);
  return { token, user };
}

export function logout() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  } catch {}
}

export async function fetchMe() {
  const { data } = await api.get("/usuarios/me");
  return data;
}
