// src/services/usuarios.js
import api, { setSession, getAuthToken } from "./api";

/**
 * Login
 * POST /usuarios/login
 * Espera { email, password }
 * Responde típicamente { token, user_schema } (según tu backend)
 */
export async function login({ email, password }) {
  const r = await api.post("/usuarios/login", { email, password });
  const token =
    r?.data?.token || r?.data?.access_token || r?.data?.accessToken || null;
  const user =
    r?.data?.user_schema || r?.data?.user || r?.data?.usuario || r?.data || null;

  if (token && user) setSession(token, user);
  return user;
}

/**
 * Registro
 * POST /usuarios/registro   (no uses /usuarios/registrar: devuelve 405)
 * Acepta { email, password, nombre?, apellido?, dni? } (otros campos opcionales)
 * Si el backend devuelve token + user, dejamos la sesión activa.
 */
export async function register(payload) {
  const r = await api.post("/usuarios/registro", payload);

  const token =
    r?.data?.token || r?.data?.access_token || r?.data?.accessToken || null;
  const user =
    r?.data?.user_schema || r?.data?.user || r?.data?.usuario || r?.data || null;

  if (token && user) setSession(token, user);
  return user ?? r?.data ?? null;
}

/**
 * Usuario actual
 * GET /usuarios/me
 */
export async function me() {
  const r = await api.get("/usuarios/me");
  return r?.data ?? null;
}

/**
 * Activar modo emprendedor para un usuario
 * PUT /usuarios/{id}/activar_emprendedor
 * Tu backend suele devolver un token nuevo; si viene, lo guardamos.
 */
export async function activarEmprendedor(userId) {
  const r = await api.put(`/usuarios/${userId}/activar_emprendedor`);
  const token =
    r?.data?.token || r?.data?.access_token || r?.data?.accessToken || null;
  const user =
    r?.data?.user_schema || r?.data?.user || r?.data?.usuario || null;

  // Si el backend devuelve token y user actualizados, refrescamos sesión.
  if (token && user) setSession(token, user);
  return r?.data ?? null;
}

/**
 * Actualizar perfil (smart)
 * Prioriza: PUT /usuarios/{id}
 * Fallback: PUT /usuarios/me  o  PATCH /usuarios/me  (según permita el backend)
 */
export async function updatePerfilSmart(payload) {
  // 1) averiguamos ID
  let uid = null;
  try {
    const u = await me();
    uid = Number(u?.id ?? u?.user_id ?? u?.uid ?? null) || null;
  } catch {
    // si falla, seguimos con /usuarios/me
  }

  // 2) intentamos PUT /usuarios/{id}
  if (uid != null) {
    try {
      const r = await api.put(`/usuarios/${uid}`, payload);
      return r;
    } catch (e1) {
      // 405/404/… => fallback
      // 3) fallback PUT /usuarios/me
      try {
        const r2 = await api.put("/usuarios/me", payload);
        return r2;
      } catch (e2) {
        // 4) último intento: PATCH /usuarios/me
        const r3 = await api.patch("/usuarios/me", payload);
        return r3;
      }
    }
  }

  // Sin uid: vamos directo a /usuarios/me con PUT y luego PATCH
  try {
    const r = await api.put("/usuarios/me", payload);
    return r;
  } catch (e2) {
    const r3 = await api.patch("/usuarios/me", payload);
    return r3;
  }
}

/**
 * (Opcional) Cerrar sesión desde front (por si algún componente lo requiere)
 * Simplemente limpia el token manteniendo compatibilidad con tu api.js
 */
export function logoutFront() {
  setSession(null, null);
}

/**
 * (Opcional) Subir avatar (si tu backend lo admite)
 * POST /usuarios/me/avatar  (multipart/form-data con campo "file")
 */
export async function uploadAvatar(file) {
  const fd = new FormData();
  fd.append("file", file);
  const r = await api.post("/usuarios/me/avatar", fd, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return r?.data ?? null;
}

/**
 * (Helper) ¿estoy autenticado?
 */
export function isLoggedIn() {
  return !!getAuthToken();
}

export default {
  login,
  register,
  me,
  activarEmprendedor,
  updatePerfilSmart,
  logoutFront,
  uploadAvatar,
  isLoggedIn,
};
