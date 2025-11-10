// src/services/session.js
const KEY_TOKEN = "token";
const KEY_USER  = "user";

export function getToken() {
  try { return localStorage.getItem(KEY_TOKEN) || ""; } catch { return ""; }
}
export function setToken(t) {
  try { t ? localStorage.setItem(KEY_TOKEN, t) : localStorage.removeItem(KEY_TOKEN); } catch {}
}
export function getUser() {
  try {
    const raw = localStorage.getItem(KEY_USER);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
export function setUser(u) {
  try {
    u ? localStorage.setItem(KEY_USER, JSON.stringify(u)) : localStorage.removeItem(KEY_USER);
  } catch {}
}
export function clearSession() {
  setToken("");
  setUser(null);
}
export function isAuthenticated() {
  return Boolean(getToken());
}
