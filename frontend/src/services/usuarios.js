// src/services/usuarios.js
import api, { setAuthToken, setUser } from "./api";

/* ---------- Registro (usado por Registro.jsx) ---------- */
export async function register({ email, password, nombre, apellido, dni }) {
  const payload = {
    email: String(email || "").trim(),
    password: String(password || "").trim(),
    nombre: (nombre || "").trim() || undefined,
    apellido: (apellido || "").trim() || undefined,
    dni: (dni || "").trim() || undefined,
  };
  const { data } = await api.post("/usuarios/registro", payload);
  return data;
}

/* ---------- Login ---------- */
export async function login({ email, password }) {
  const { data } = await api.post("/usuarios/login", { email, password });
  if (data?.token) setAuthToken(data.token);
  if (data?.user) setUser(data.user);
  return data;
}

/* ---------- /usuarios/me (GET) ---------- */
export async function me() {
  const { data } = await api.get("/usuarios/me");
  if (data) setUser(data);
  return data;
}

/* ---------- Actualización de perfil "inteligente" ----------
   Evita el 405 usando varios endpoints posibles del backend.
   Orden de intento:
   1) PUT /usuarios/me
   2) PATCH /usuarios/me
   3) PUT /usuarios/{id}
   4) PATCH /usuarios/{id}
*/
export async function updatePerfilSmart(payload, userId) {
  let uid = userId;
  if (!uid) {
    try {
      const m = await me();
      uid = m?.id;
    } catch {}
  }

  const intents = [
    () => api.put("/usuarios/me", payload),
    () => api.patch("/usuarios/me", payload),
    () => (uid ? api.put(`/usuarios/${uid}`, payload) : Promise.reject({ skip: true })),
    () => (uid ? api.patch(`/usuarios/${uid}`, payload) : Promise.reject({ skip: true })),
  ];

  let lastErr;
  for (const run of intents) {
    try {
      const r = await run();
      // si el back devuelve user actualizado o token, los reflejamos
      if (r?.data?.token) setAuthToken(r.data.token);
      if (r?.data) setUser(r.data);
      return r; // { data: ... }
    } catch (e) {
      if (e?.skip) { lastErr = e; continue; }
      const st = e?.response?.status;
      // 401/403 devolvemos; el resto probamos otro intento
      if (st === 401 || st === 403) throw e;
      lastErr = e;
    }
  }
  throw lastErr || new Error("No se pudo actualizar el perfil.");
}

/* ---------- Activación de Emprendedor ----------
   Tu backend define: PUT /usuarios/{usuario_id}/activar_emprendedor
   Probamos PUT/POST/PATCH por compatibilidad entre entornos.
*/
export async function activarEmprendedor(userId) {
  const respMe = !userId ? await me().catch(() => null) : null;
  const uid = userId || respMe?.id;
  if (!uid) throw new Error("Falta userId");

  const methods = ["put", "post", "patch"];
  const url = `/usuarios/${uid}/activar_emprendedor`;

  let lastErr = null;
  for (const method of methods) {
    try {
      const { data } = await api.request({ method, url, data: {} });
      if (data?.token) setAuthToken(data.token);
      try { await me(); } catch {}
      return data;
    } catch (e) {
      lastErr = e;
      const st = e?.response?.status;
      if (st === 401 || st === 403) throw e; // auth → cortar
      // 404/405/422 seguimos probando
    }
  }
  throw lastErr || new Error("No se pudo activar el modo Emprendedor.");
}
