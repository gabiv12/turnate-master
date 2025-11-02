// src/services/api.js
import axios from "axios";

export const TOKEN_KEY = "accessToken";

export function setAuthToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {}
}

export function getAuthToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function clearAuthToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {}
}

const BASE_URL =
  import.meta?.env?.VITE_API_URL?.trim() ||
  "http://127.0.0.1:8000";

const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: false,
});

// Adjunta el Bearer si hay token guardado
api.interceptors.request.use((config) => {
  const t = getAuthToken();
  if (t) config.headers.Authorization = `Bearer ${t}`;
  return config;
});

// Cliente autenticado ad-hoc (por si alguna pantalla lo pide)
export function apiAuth(customToken) {
  const instance = axios.create({
    baseURL: BASE_URL,
    withCredentials: false,
  });
  instance.interceptors.request.use((config) => {
    const t = customToken ?? getAuthToken();
    if (t) config.headers.Authorization = `Bearer ${t}`;
    return config;
  });
  return instance;
}

export default api;
