// src/components/api.jsx
import axios from "axios";

const BASE_URL =
  (import.meta?.env?.VITE_API_URL || "http://127.0.0.1:8000").replace(/\/+$/, "");

// Claves comunes para compatibilidad con otros clientes
const TOKEN_KEYS = ["accessToken", "token", "jwt", "access", "access_token"];

// ====== Token helpers ======
export function readToken() {
  for (const k of TOKEN_KEYS) {
    const v = (localStorage.getItem(k) || "").trim();
    if (v) return v.replace(/^Bearer\s+/i, "");
  }
  return "";
}

export function setToken(tok) {
  const clean = String(tok || "").replace(/^Bearer\s+/i, "");
  if (!clean) return clearToken();
  // Guardamos en 1 sola clave “fuente de verdad” y dejamos las otras si querés compat
  localStorage.setItem("accessToken", clean);
}

export function clearToken() {
  for (const k of TOKEN_KEYS) localStorage.removeItem(k);
}

// ====== Axios client ======
const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: false,
  headers: { "Content-Type": "application/json" },
});

// —— Request: inyecta Authorization con el token actual (una sola vez)
api.interceptors.request.use(
  (config) => {
    const t = readToken();
    if (t) {
      // si el caller ya pasó Authorization explícito, lo respetamos
      if (!config.headers) config.headers = {};
      if (!config.headers.Authorization) {
        config.headers.Authorization = `Bearer ${t}`;
      }
      // log útil
      // eslint-disable-next-line no-console
      console.log(
        `[API] → ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`,
        "(Auth ON)"
      );
    } else {
      if (config?.headers?.Authorization) delete config.headers.Authorization;
      // eslint-disable-next-line no-console
      console.log(
        `[API] → ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`,
        "(Auth OFF)"
      );
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// —— Response: solo informamos 401 (no reintentar ni redirigir para evitar loops)
api.interceptors.response.use(
  (resp) => resp,
  (error) => {
    const status = error?.response?.status;
    if (status === 401) {
      // eslint-disable-next-line no-console
      console.warn("[API 401] Token inválido/expirado");
    }
    return Promise.reject(error);
  }
);

export default api;
