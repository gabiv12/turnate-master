// src/utils/jwt.js
import { getAuthToken } from "../services/api";

function base64urlDecode(str) {
  if (!str) return "";
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  const pad = 4 - (str.length % 4);
  if (pad !== 4) str += "=".repeat(pad);
  try {
    const json = atob(str)
      .split("")
      .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
      .join("");
    return decodeURIComponent(json);
  } catch {
    return "";
  }
}

export function parseJwt(token = getAuthToken()) {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    return JSON.parse(base64urlDecode(parts[1]));
  } catch {
    return null;
  }
}

export function tokenHasRole(role) {
  const p = parseJwt();
  const roles = Array.isArray(p?.roles) ? p.roles : [];
  return roles.includes(role);
}

export function isLoggedIn() {
  const p = parseJwt();
  if (!p) return false;
  const now = Math.floor(Date.now() / 1000);
  if (p.exp && now >= p.exp) return false;
  return true;
}

export function isEmprendedorFromToken() {
  const p = parseJwt();
  return !!p?.is_emprendedor;
}

export function empIdFromToken() {
  const p = parseJwt();
  return p?.emp_id ?? null;
}
