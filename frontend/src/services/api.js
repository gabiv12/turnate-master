// src/services/api.js
import axios from "axios";

const API_URL = (import.meta.env.VITE_API_URL || "http://127.0.0.1:8000").replace(/\/+$/, "");

// Claves compatibles con otros clientes que hayan quedado
const TOKEN_KEYS = ["accessToken", "turnate_token", "token", "access_token", "jwt"];

export function readToken() {
  for (const k of TOKEN_KEYS) {
    const v = localStorage.getItem(k);
    if (v) return v.replace(/^Bearer\s+/i, "");
  }
  return null;
}
export function setToken(tok) {
  const clean = String(tok || "").replace(/^Bearer\s+/i, "");
  if (!clean) return clearToken();
  for (const k of TOKEN_KEYS) localStorage.setItem(k, clean);
}
export function clearToken() {
  for (const k of TOKEN_KEYS) localStorage.removeItem(k);
}

// Cliente con Authorization + manejo de 401 amigable (NO redirige automáticamente)
function createClient() {
  const client = axios.create({
    baseURL: API_URL,
    headers: { "Content-Type": "application/json" },
  });

  client.interceptors.request.use((cfg) => {
    const tk = readToken();
    if (tk) {
      cfg.headers = cfg.headers || {};
      cfg.headers.Authorization = `Bearer ${tk}`;
    } else if (cfg?.headers?.Authorization) {
      delete cfg.headers.Authorization;
    }
    return cfg;
  });

  client.interceptors.response.use(
    (res) => res,
    (err) => {
      // Normaliza 401 a un detalle de UI, sin cortar la pantalla
      if (err?.response?.status === 401) {
        if (!err.response.data || typeof err.response.data !== "object") {
          err.response.data = {};
        }
        err.response.data.detail = "Tu sesión se cerró. Iniciá sesión y volvé a intentar.";
      }
      return Promise.reject(err);
    }
  );

  return client;
}

export const apiAuth = createClient();

// Helper de login (form-urlencoded) que guarda el token
export async function loginAuth(username, password) {
  const body = new URLSearchParams();
  body.append("grant_type", "password");
  body.append("username", username);
  body.append("password", password);

  const { data } = await apiAuth.post("/auth/login", body.toString(), {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });

  const token = data?.access_token;
  if (!token) throw new Error("No recibimos el token.");
  setToken(token);
  return token;
}

// Export de compat (algunos imports viejos usan "api")
const api = apiAuth;
export default api;
