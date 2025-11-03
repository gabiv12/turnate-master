// src/services/usuarios.js
import api, { setAuthToken, setUser as setUserLS } from "./api";

/* ----------- Registro / Login / Me ----------- */
export async function register({ email, password, nombre, apellido, dni }) {
  const payload = {
    email: String(email || "").trim(),
    password: String(password || "").trim(),
    nombre: (nombre || "").trim() || undefined,
    apellido: (apellido || "").trim() || undefined,
    dni: (dni || "").trim() || undefined,
  };
  const { data } = await api.post("/usuarios/registro", payload);
  if (data?.token) setAuthToken(data.token);
  if (data?.user)  setUserLS(data.user);
  return data;
}

export async function login({ email, password }) {
  const { data } = await api.post("/usuarios/login", { email, password });
  if (data?.token) setAuthToken(data.token);
  if (data?.user)  setUserLS(data.user);
  return data;
}

export async function me() {
  const { data } = await api.get("/usuarios/me");
  if (data) setUserLS(data);
  return data;
}

/* ----------- Update perfil (prioriza /usuarios/{id}) ----------- */
export async function updatePerfilSmart(payload = {}, userId) {
  // sanitizar
  const clean = {};
  for (const [k, v] of Object.entries(payload || {})) {
    if (v !== undefined) clean[k] = typeof v === "string" ? v.trim() : v;
  }

  // obtener id
  let uid = userId;
  if (!uid) {
    try { uid = (await me())?.id; } catch {}
  }
  if (!uid) throw new Error("No se pudo determinar el ID de usuario.");

  const attempts = [
    { method: "put",   url: `/usuarios/${uid}` },
    { method: "patch", url: `/usuarios/${uid}` },
    { method: "patch", url: "/usuarios/me" },
    { method: "put",   url: "/usuarios/me" },
  ];

  let lastErr = null;
  for (const a of attempts) {
    try {
      const { data } = await api.request({ method: a.method, url: a.url, data: clean });

      // token nuevo?
      const newToken = data?.token || data?.access_token || data?.jwt || null;
      if (newToken) setAuthToken(newToken);

      // merge y persistir
      const merged = await _mergeUserLocal(data, clean);
      return { data: merged };
    } catch (e) {
      lastErr = e;
      const st = e?.response?.status;
      if (st === 401 || st === 403) throw e;             // auth → cortar
      if (![400,404,405,409,422].includes(st)) throw e;  // errores "no esperables" → cortar
      // si es 400/404/405/409/422, probamos el siguiente intento
    }
  }
  throw lastErr || new Error("No se pudo actualizar el perfil.");
}

/* ----------- Password ----------- */
export async function changePassword({ current_password, new_password }) {
  const { data } = await api.put("/usuarios/me/password", {
    current_password,
    new_password,
  });
  return data;
}

/* ----------- Activar Emprendedor ----------- */
export async function activarEmprendedor(userId) {
  let uid = userId;
  if (!uid) {
    try { uid = (await me())?.id; } catch {}
  }
  if (!uid) throw new Error("Falta userId");

  const methods = ["put", "post", "patch"];
  const url = `/usuarios/${uid}/activar_emprendedor`;
  let lastErr = null;

  for (const m of methods) {
    try {
      const { data } = await api.request({ method: m, url, data: {} });
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

/* ----------- Utils ----------- */
async function _mergeUserLocal(serverData, payload) {
  let localUser = null;
  try {
    const raw = localStorage.getItem("user");
    localUser = raw ? JSON.parse(raw) : null;
  } catch {}

  const serverUser = serverData?.user ?? serverData ?? {};
  const merged = {
    ...(localUser || {}),
    ...serverUser,
    email:    serverUser.email    ?? payload.email    ?? localUser?.email,
    nombre:   serverUser.nombre   ?? payload.nombre   ?? localUser?.nombre,
    apellido: serverUser.apellido ?? payload.apellido ?? localUser?.apellido,
    dni:      serverUser.dni      ?? payload.dni      ?? localUser?.dni,
  };

  setUserLS(merged);
  return merged;
}
