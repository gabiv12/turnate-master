// src/services/auth.js
import api, { setAuthToken, clearAuthToken } from "./api";

/* Guarda token en TODAS las claves vistas en el repo (compat total) */
function persistTokenCompat(token) {
  if (!token) return;
  try {
    localStorage.setItem("accessToken", token);
    localStorage.setItem("token", token);
    localStorage.setItem("access_token", token);
    localStorage.setItem("jwt", token);
    localStorage.setItem("access", token);
  } catch {}
  setAuthToken(token);
}

/* Login: username O email (evita 400 del backend) */
export async function login(identifier, password) {
  const id = String(identifier || "").trim();
  const body = id.includes("@") ? { email: id, password } : { username: id, password };
  const { data } = await api.post("/usuarios/login", body);
  const token = data?.token || data?.access_token || data?.jwt;
  if (!token) throw new Error("No se recibió token.");
  persistTokenCompat(token);
  return { token, user: data?.user || null };
}

export function logout() {
  clearAuthToken();
  try {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("token");
    localStorage.removeItem("access_token");
    localStorage.removeItem("jwt");
    localStorage.removeItem("access");
  } catch {}
}

/* Registro: envía 'nombre' para no romper NOT NULL */
export async function register({ email, username, password, nombre, apellido, dni }) {
  const payload = {
    email: String(email || "").trim().toLowerCase(),
    username: String(username || "").trim(),
    password: String(password || ""),
    nombre: (nombre && String(nombre).trim()) || "Usuario",
    apellido: (apellido && String(apellido).trim()) || "",
    ...(dni ? { dni } : {}),
  };
  const { data } = await api.post("/usuarios/registro", payload);
  const token = data?.token || data?.access_token || null;
  if (token) persistTokenCompat(token);
  return data;
}

/* Variante /me por si tu UI la usa */
export async function activarEmprendedorMe() {
  const { data } = await api.put("/usuarios/me/activar_emprendedor");
  const token = data?.token || data?.access_token || null;
  if (token) persistTokenCompat(token);
  return data;
}
