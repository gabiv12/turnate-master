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
  const currentToken = getAuthToken();
  const currentUser  = getUser();

  let token, user;
  if (typeof arg1 === "object" && arg1 !== null && arg2 === undefined) {
    token = (arg1.token === undefined) ? currentToken : arg1.token;
    user  = (arg1.user  === undefined) ? currentUser  : arg1.user;
  } else {
    token = (arg1 === undefined) ? currentToken : arg1;
    user  = (arg2 === undefined) ? currentUser  : arg2;
  }

  if (token === null) clearAuthToken(); else setAuthToken(token);
  if (user  === null) clearUser();      else setUser(user);
}
export function getSession() { return { token: getAuthToken(), user: getUser() }; }
export function clearSession() { clearAuthToken(); clearUser(); }

/* ========= Mensajes de error amigables ========= */
export function errorMessage(err) {
  const st = err?.response?.status;
  if (st === 401) return "Sesión vencida o no autorizada.";
  if (st === 403) return "Sin permisos para esta acción.";
  if (st === 404) return "No encontrado.";
  if (st === 409) return "Conflicto de datos.";
  if (st >= 500)  return "Error del servidor.";
  return err?._friendly || err?.message || "Error de red.";
}

/* ========= Adaptador /horarios/mis (si lo usás) ========= */
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
function toFlatHorariosPayload(body) {
  if (!body) return [];
  const list = (x) => (Array.isArray(x) ? x : (x ? [x] : []));
  const dias = list(body?.dias ?? body?.dia ?? []);
  const bloques = list(body?.bloques ?? body?.items ?? []);
  const intervalo = Number(body?.intervalo_min ?? body?.intervalo ?? 30);

  const flat = [];
  for (const d of dias) {
    const dia = normDia(d);
    for (const b of bloques) {
      flat.push({
        dia,
        desde: hhmm(b?.desde ?? b?.inicio ?? b?.start),
        hasta: hhmm(b?.hasta ?? b?.fin ?? b?.end),
        intervalo_min: intervalo,
      });
    }
  }
  return flat;
}

/* ========= Axios base ========= */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://127.0.0.1:8000",
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

  // Adaptador para /horarios/mis (opcional)
  const method = String(config.method || "get").toLowerCase();
  const url = String(config.url || "");
  if (method === "post" && url.endsWith("/horarios/mis")) {
    try {
      const flat = toFlatHorariosPayload(config.data);
      config.data = flat;
      config.headers = config.headers || {};
      config.headers["Content-Type"] = "application/json";
    } catch {}
  }

  return config;
});

/* ========= Response interceptor ========= */
api.interceptors.response.use(
  (res) => res,
  (err) => {
    err._friendly = errorMessage(err);
    const st = err?.response?.status;
    const reqUrl = (err?.config?.url || "").toString();

    // ⛔ No limpies ni redirijas si el 401 es del propio endpoint de LOGIN
    const isLoginCall = /\/usuarios\/login\b/.test(reqUrl);

    if (st === 401 && !isLoginCall) {
      try { clearSession(); } catch {}
      if (window.location.pathname !== "/login") {
        window.location.assign("/login");
      }
    }
    return Promise.reject(err);
  }
);

export async function apiListEmprendedores(params = {}) {
  const { q, rubro, limit = 50, offset = 0 } = params;
  const res = await api.get("/emprendedores/", { params: { q, rubro, limit, offset } });
  return res.data || [];
}
export async function apiListRubros() {
  const res = await api.get("/emprendedores/rubros");
  return res.data || [];
}

export default api;
