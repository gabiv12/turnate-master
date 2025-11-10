// src/services/usuarios.js
import api, { setSession, getSession } from "./api";

/* ================= Helpers de sesión ================= */
function mergeUserInSession(nextUser) {
  const { token, user } = getSession();
  const merged = { ...(user || {}), ...(nextUser || {}) };
  setSession({ token, user: merged });
  return merged;
}

/* ================= Auth ================= */

/**
 * LOGIN
 * Esperado: { token, user_schema } o { token, user }
 */
export async function login({ email, password }) {
  const res = await api.post("/usuarios/login", { email, password });
  const token = res?.data?.token || res?.data?.access_token || null;
  const user  = res?.data?.user_schema || res?.data?.user || null;
  setSession({ token, user });
  return { token, user };
}

/** PERFIL autenticado */
export async function me() {
  const res = await api.get("/usuarios/me");
  return res.data || null;
}

/**
 * REGISTRO
 * Fallbacks comunes: /usuarios/registrar, /usuarios/registro, /usuarios/register, /usuarios (POST)
 * Si el back devuelve token/user, guardamos sesión.
 */
export async function register(payload) {
  const candidates = [
    "/usuarios/registrar",
    "/usuarios/registro",
    "/usuarios/register",
    "/usuarios",
  ];

  let lastErr = null;
  for (const path of candidates) {
    try {
      const res = await api.post(path, payload);
      const token = res?.data?.token || res?.data?.access_token || null;
      const user  = res?.data?.user_schema || res?.data?.user || null;
      if (token || user) {
        setSession({
          token: token ?? getSession().token,
          user : user  ?? getSession().user,
        });
      }
      return res.data || { ok: true };
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr ?? new Error("No se pudo registrar.");
}

/**
 * ACTIVAR EMPRENDEDOR
 * Soporta que el back devuelva token y/o user nuevos.
 */
export async function activarEmprendedor(userId) {
  const res = await api.put(`/usuarios/${userId}/activar_emprendedor`);
  const token = res?.data?.token || res?.data?.access_token || null;
  const user  = res?.data?.user_schema || res?.data?.user || null;
  if (token || user) {
    setSession({
      token: token ?? getSession().token,
      user : user  ?? getSession().user,
    });
  }
  return res.data;
}

/* ================= Perfil (UPDATE) ================= */

/**
 * updatePerfilSmart(payload, userId?)
 * Intenta actualizar el perfil del usuario con varios endpoints comunes:
 * 1) PATCH /usuarios/me
 * 2) PUT   /usuarios/me
 * 3) PATCH /usuarios/{id}
 * 4) PUT   /usuarios/{id}
 * Si la respuesta trae el user actualizado, lo guarda en sesión; si no, re-lee /usuarios/me.
 */
export async function updatePerfilSmart(payload, userId = null) {
  const id = userId ?? getSession()?.user?.id ?? null;

  // candidatos ordenados por preferencia
  const candidates = [
    { method: "patch", url: "/usuarios/me" },
    { method: "put",   url: "/usuarios/me" },
    ...(id ? [
      { method: "patch", url: `/usuarios/${id}` },
      { method: "put",   url: `/usuarios/${id}` },
    ] : []),
  ];

  let lastErr = null;
  for (const c of candidates) {
    try {
      const res = await api[c.method](c.url, payload);
      const updated =
        res?.data?.user_schema ||
        res?.data?.user ||
        res?.data ||
        null;

      if (updated) {
        return mergeUserInSession(updated);
      }

      // si no vino user, re-leemos /me
      try {
        const fresh = await me();
        return mergeUserInSession(fresh || {});
      } catch {
        return getSession().user || null;
      }
    } catch (e) {
      lastErr = e;
      // seguimos probando siguientes rutas
    }
  }
  throw lastErr ?? new Error("No se pudo actualizar el perfil.");
}

/** Alias por compatibilidad con código existente */
export const updatePerfil = updatePerfilSmart;
export const registerUser = register;
export async function registrar(datos) { return register(datos); }
