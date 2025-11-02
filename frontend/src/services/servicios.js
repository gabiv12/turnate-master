// src/services/servicios.js
import api from "./api";

/* ---------- Listar ---------- */
export async function listarServicios(empId) {
  try {
    const { data } = await api.get("/servicios/mis");
    if (Array.isArray(data)) return data;
  } catch (e) {
    const st = e?.response?.status;
    if (![401,403,404,405].includes(st)) throw e;
  }
  const { data } = await api.get(`/emprendedores/${empId}/servicios`);
  return Array.isArray(data) ? data : [];
}

/* ---------- Crear ---------- */
export async function crearServicio(empId, payload) {
  const tries = [
    { method: "post", url: `/emprendedores/${empId}/servicios`, data: payload },
    { method: "post", url: `/servicios`, data: payload },
  ];
  let lastErr = null;
  for (const t of tries) {
    try {
      const { data } = await api.request(t);
      return data;
    } catch (e) {
      lastErr = e;
      const st = e?.response?.status;
      if (![401,403,404,405].includes(st)) throw e;
    }
  }
  throw lastErr || new Error("No se pudo crear el servicio.");
}

/* ---------- Editar ---------- */
export async function actualizarServicio(empId, id, payload) {
  const tries = [
    { method: "put", url: `/servicios/${id}`, data: payload },
    { method: "put", url: `/emprendedores/${empId}/servicios/${id}`, data: payload },
  ];
  let lastErr = null;
  for (const t of tries) {
    try {
      const { data } = await api.request(t);
      return data;
    } catch (e) {
      lastErr = e;
      const st = e?.response?.status;
      if (![401,403,404,405].includes(st)) throw e;
    }
  }
  throw lastErr || new Error("No se pudo actualizar el servicio.");
}

/* ---------- (Des)activar ---------- */
export async function desactivarServicio(empId, id) {
  const tries = [
    { method: "delete", url: `/servicios/${id}` },
    { method: "put", url: `/servicios/${id}`, data: { activo: false } },
    { method: "put", url: `/emprendedores/${empId}/servicios/${id}`, data: { activo: false } },
  ];
  let lastErr = null;
  for (const t of tries) {
    try {
      const resp = await api.request(t);
      return resp?.data ?? true;
    } catch (e) {
      lastErr = e;
      const st = e?.response?.status;
      if (![401,403,404,405].includes(st)) throw e;
    }
  }
  throw lastErr || new Error("No se pudo (des)activar el servicio.");
}
