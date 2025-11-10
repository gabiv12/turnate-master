// src/services/api.js
// ===========================================================
// Única fuente de verdad para:
// - Base URL (VITE_API_URL)
// - Token & Usuario (localStorage)
// - Interceptores (Authorization + manejo 401 global)
// - Helpers: errorMessage, setSession/clearSession
// - Atajos HTTP y endpoints básicos (login, register, me)
// - apiListEmprendedores, apiListRubros, apiGetEmprendedorByCodigo
// ===========================================================

import axios from "axios";

// ---------- Config base ----------
const API_URL = (import.meta?.env?.VITE_API_URL || "http://127.0.0.1:8000").replace(/\/+$/, "");

// ---------- Storage Keys ----------
const LS_TOKEN_KEY = "auth_token";
const LS_USER_KEY  = "user";

// ---------- Token helpers ----------
export function getAuthToken() {
  try { return localStorage.getItem(LS_TOKEN_KEY) || ""; } catch { return ""; }
}
export function setAuthToken(token) {
  try { token ? localStorage.setItem(LS_TOKEN_KEY, token) : localStorage.removeItem(LS_TOKEN_KEY); } catch {}
}
export function clearAuthToken() {
  try { localStorage.removeItem(LS_TOKEN_KEY); } catch {}
}

// ---------- User helpers ----------
export function getUser() {
  try {
    const raw = localStorage.getItem(LS_USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
export function setUser(u) {
  try { u ? localStorage.setItem(LS_USER_KEY, JSON.stringify(u)) : localStorage.removeItem(LS_USER_KEY); } catch {}
}
export function clearUser() {
  try { localStorage.removeItem(LS_USER_KEY); } catch {}
}

// ---------- Sesión atómica ----------
export function setSession(token, userObj) {
  setAuthToken(token);
  setUser(userObj);
}
export function clearSession() {
  clearAuthToken();
  clearUser();
}

// ---------- Mensaje amigable de error ----------
export function errorMessage(err) {
  if (!err) return "Ocurrió un error.";
  if (typeof err === "string") return err;

  const s = err?.response?.status;
  const d = err?.response?.data;

  if (s === 401) return "Tu sesión se cerró. Iniciá sesión nuevamente.";
  if (s === 403) return "No tenés permisos para esta acción.";
  if (s === 404) return typeof d === "string" ? d : (d?.detail || "No encontrado.");
  if (s === 409) {
    if (typeof d === "string") return d;
    if (d?.detail) return typeof d.detail === "string" ? d.detail : "Conflicto en los datos.";
    return "Conflicto.";
  }
  if (typeof d === "string") return d;
  if (d?.detail) return typeof d.detail === "string" ? d.detail : "Ocurrió un error.";
  return err?.message || "No disponible por el momento.";
}

// ---------- Axios instance ----------
const api = axios.create({ baseURL: API_URL });

// ---------- Interceptor: Request (agrega Authorization) ----------
api.interceptors.request.use(
  (config) => {
    const t = getAuthToken();
    if (t) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${t}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ---------- Interceptor: Response (401 => limpiar y mandar a /login) ----------
let handling401 = false;
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err?.response?.status;
    if (status === 401 && !handling401) {
      handling401 = true;
      try { clearSession(); } catch {}
      // Evitar loop si justo es login/registro
      const url = err?.config?.url || "";
      const safe = ["/usuarios/login", "/usuarios/registro", "/usuarios/registrar"];
      const onAuthEndpoint = safe.some((p) => url.includes(p));
      if (!onAuthEndpoint) {
        try { window.location.assign("/login"); } catch {}
      }
      handling401 = false;
      return Promise.reject("Tu sesión se cerró. Iniciá sesión nuevamente.");
    }
    return Promise.reject(err);
  }
);

// ---------- Atajos HTTP ----------
export async function apiGet(path, params)  { const r = await api.get(path, { params }); return r?.data; }
export async function apiPost(path, data, config = {}) { const r = await api.post(path, data, config); return r?.data; }
export async function apiPut(path, data)   { const r = await api.put(path, data);  return r?.data; }
export async function apiPatch(path, data) { const r = await api.patch(path, data); return r?.data; }
export async function apiDelete(path)      { const r = await api.delete(path); return r?.data; }

// ---------- Endpoints base ----------
/** /usuarios/me -> actualiza LS user y devuelve objeto usuario */
export async function me() {
  const r = await api.get("/usuarios/me");
  const user = r?.data || null;
  if (user) setUser(user);
  return user;
}

/** /usuarios/login {email, password} -> { token, user } (compat con varios backends) */
export async function login(credentials) {
  const r = await api.post("/usuarios/login", credentials);
  const data = r?.data || {};
  const token = data.token || data?.access_token || data?.Token || "";
  const user  = data.user_schema || data.user || data?.usuario || null;
  if (token) setAuthToken(token);
  if (user)  setUser(user);
  return { token, user };
}

/** Registro (compat) usa /usuarios/registro y fallback a /usuarios/registrar */
export async function register(payload) {
  try {
    const r = await api.post("/usuarios/registro", payload);
    return r?.data;
  } catch (e1) {
    const r2 = await api.post("/usuarios/registrar", payload);
    return r2?.data;
  }
}

/** Lista de rubros (para IngresarCódigo / filtros de emprendedores) */
export async function apiListRubros() {
  const r = await api.get("/emprendedores/rubros");
  // normalizamos a array simple
  const items = Array.isArray(r?.data?.items) ? r.data.items : Array.isArray(r?.data) ? r.data : [];
  return items;
}

/** Lista de emprendedores (con filtros opcionales {q, rubro, limit, offset}) */
export async function apiListEmprendedores(params = {}) {
  const r = await api.get("/emprendedores/", { params });
  return r?.data;
}

/** Obtener un emprendedor por código público */
export async function apiGetEmprendedorByCodigo(codigo) {
  if (!codigo) return null;
  const r = await api.get(`/emprendedores/by-codigo/${encodeURIComponent(codigo)}`);
  return r?.data || null;
}

// ---------- Export default ----------
export default api;
