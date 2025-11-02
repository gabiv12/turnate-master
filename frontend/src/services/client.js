// src/api/client.js
import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000",
  withCredentials: false,
});

function getToken() {
  return localStorage.getItem("token") || "";
}

export const setToken = (t) => localStorage.setItem("token", t || "");
export const clearToken = () => localStorage.removeItem("token");

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    // Podés manejar 401/403 si querés redirigir automáticamente
    return Promise.reject(err);
  }
);

export default api;
