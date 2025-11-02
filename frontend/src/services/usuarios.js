// src/services/usuarios.js
import api from "./api";

/* Compat: persistimos token en varias claves */
function persistTokenCompat(token) {
  if (!token) return;
  try {
    localStorage.setItem("accessToken", token);
    localStorage.setItem("token", token);
    localStorage.setItem("access_token", token);
    localStorage.setItem("jwt", token);
    localStorage.setItem("access", token);
  } catch {}
}

export async function registro(payload) {
  if (!payload?.nombre) payload = { ...payload, nombre: "Usuario" }; // evita NOT NULL
  const { data } = await api.post("/usuarios/registro", payload);
  if (data?.token) persistTokenCompat(data.token);
  return data;
}

export async function login(identifier, password) {
  const id = String(identifier || "").trim();
  const body = id.includes("@") ? { email: id, password } : { username: id, password };
  const { data } = await api.post("/usuarios/login", body);
  const token = data?.token || data?.access_token || data?.jwt;
  if (token) persistTokenCompat(token);
  return data;
}

export async function me() {
  const { data } = await api.get("/usuarios/me");
  return data;
}

export async function actualizarMe(patch) {
  const { data } = await api.put("/usuarios/me", patch);
  return data;
}

export async function changePassword(current_password, new_password) {
  await api.put("/usuarios/me/password", { current_password, new_password });
}

export async function activarEmprendedorMe() {
  const { data } = await api.put("/usuarios/me/activar_emprendedor");
  if (data?.token) persistTokenCompat(data.token);
  return data;
}
