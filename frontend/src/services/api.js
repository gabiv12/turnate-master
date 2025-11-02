// src/services/api.js
import axios from "axios";

/* ========= Constantes de Storage ========= */
export const TOKEN_KEY = "accessToken";
export const USER_KEY  = "user";

/* ========= Token helpers ========= */
export function setAuthToken(token) {
  try { token ? localStorage.setItem(TOKEN_KEY, token) : localStorage.removeItem(TOKEN_KEY); } catch {}
}
export function getAuthToken() {
  try { return localStorage.getItem(TOKEN_KEY) || null; } catch { return null; }
}
export function clearAuthToken() {
  try { localStorage.removeItem(TOKEN_KEY); } catch {}
}

/* ========= User helpers ========= */
export function setUser(user) {
  try { user ? localStorage.setItem(USER_KEY, JSON.stringify(user)) : localStorage.removeItem(USER_KEY); } catch {}
}
export function getUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
export function clearUser() {
  try { localStorage.removeItem(USER_KEY); } catch {}
}

/* ========= Sesión helpers ========= */
export function setSession(arg1, arg2) {
  let token, user;
  if (typeof arg1 === "object" && arg1 !== null && arg2 === undefined) {
    token = arg1.token;
    user  = arg1.user;
  } else {
    token = arg1;
    user  = arg2;
  }
  if (token) setAuthToken(token); else clearAuthToken();
  if (user)  setUser(user); else clearUser();
}
export function getSession() {
  return { token: getAuthToken(), user: getUser() };
}
export function clearSession() {
  clearAuthToken(); clearUser();
}

/* ========= Normalizador de errores (a string) ========= */
export function errorMessage(err) {
  // Si ya es string, devolver tal cual
  if (typeof err === "string") return err;

  const res = err?.response;
  if (res) {
    const data = res.data;
    if (data?.detail) {
      if (Array.isArray(data.detail)) {
        const first = data.detail[0];
        if (first?.msg) return String(first.msg);
        try { return JSON.stringify(first); } catch {}
      }
      if (typeof data.detail === "string") return data.detail;
    }
    if (typeof data === "string") return data;
    return `[API][${res.status}] ${res.config?.url || ""}`.trim();
  }
  if (err?.message) return err.message;
  try { return JSON.stringify(err); } catch {}
  return "Error inesperado";
}

/* ========= Utilidades para horarios (transformación) ========= */
function hhmm(v) {
  if (!v) return "09:00";
  const [h = "09", m = "00"] = String(v).split(":");
  return `${h.padStart(2, "0")}:${m.padStart(2, "0")}`;
}
function normDia(x) {
  const n = Number(x);
  if (!Number.isFinite(n)) return 0;
  if (n >= 0 && n <= 6) return n;
  if (n >= 1 && n <= 7) return n % 7;
  return 0;
}
/**
 * Plano esperado por el back (este router): 
 * [ { dia_semana, desde, hasta, intervalo_min } ... ]
 * Esta función toma agrupado o plano y lo devuelve plano.
 */
function toFlatHorariosPayload(body) {
  if (!body) return [];

  const list = (x) => (Array.isArray(x) ? x : []);
  let items = [];

  if (typeof body === "object" && !Array.isArray(body) && Array.isArray(body.items)) {
    items = body.items;
  } else if (typeof body === "object" && !Array.isArray(body) && Array.isArray(body.bloques)) {
    items = body.bloques;
  } else if (Array.isArray(body)) {
    items = body;
  } else {
    return [];
  }

  // Si ya es plano
  if (items.length && items[0] && typeof items[0] === "object" && !("bloques" in items[0]) && "desde" in items[0]) {
    return items.map((r) => ({
      dia_semana: normDia(r.dia_semana ?? r.dia ?? r.weekday ?? 0),
      dia: normDia(r.dia ?? r.dia_semana ?? r.weekday ?? 0), // compat
      desde: hhmm(r.desde),
      hasta: hhmm(r.hasta),
      intervalo_min: Number(r.intervalo_min ?? r.intervalo ?? 30),
    }));
  }

  // Agrupado -> plano
  const flat = [];
  for (const it of items) {
    if (!it || typeof it !== "object") continue;
    const dia = normDia(it.dia_semana ?? it.dia ?? it.weekday ?? 0);
    const intervalo = Number(it.intervalo_min ?? it.intervalo ?? 30);
    const activo = it.activo !== false;
    if (!activo) continue;
    for (const b of list(it.bloques)) {
      flat.push({
        dia_semana: dia,
        dia, // compat extra
        desde: hhmm(b.desde ?? b.inicio),
        hasta: hhmm(b.hasta ?? b.fin),
        intervalo_min: intervalo,
      });
    }
  }
  return flat;
}

/* ========= Axios base ========= */
const api = axios.create({
  baseURL: "http://127.0.0.1:8000",
  withCredentials: false,
  timeout: 30000,
});

/* ========= Request interceptor ========= */
api.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }

  const url = String(config.url || "");
  const method = String(config.method || "get").toLowerCase();

  if (method === "post" && url.endsWith("/horarios/mis")) {
    try {
      const body = config.data;
      const flat = toFlatHorariosPayload(body);
      // ⚠️ NO JSON.stringify aquí — dejá que Axios serialice
      config.data = flat;
      config.headers = config.headers || {};
      config.headers["Content-Type"] = "application/json";
      console.info("[API] Adapt payload /horarios/mis -> flat:", flat);
    } catch (e) {
      console.warn("[API] No se pudo adaptar payload de /horarios/mis:", e?.message || e);
    }
  }

  if (config?.method && config?.url) {
    console.info("[API]", String(config.method || "").toUpperCase(), config.url);
  }
  return config;
});

/* ========= Response interceptor ========= */
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const msg = errorMessage(err);
    const st = err?.response?.status;
    const url = err?.config?.url || "";
    console.warn(`[API][${st || "ERR"}] ${url} :: ${msg}`);
    // Siempre rechazamos como string para no romper renders
    return Promise.reject(msg);
  }
);

export default api;
