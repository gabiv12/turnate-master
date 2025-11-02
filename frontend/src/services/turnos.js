// src/services/turnos.js
import api from "./api";

/* ===== OWNER (panel) ===== */
export async function listarTurnosOwner({ desde, hasta }) {
  const { data } = await api.get("/turnos/mis", { params: { desde, hasta } });
  return Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
}
export async function crearTurnoOwner(payload) {
  const { data } = await api.post("/turnos", payload);
  return data;
}
export async function borrarTurno(id) {
  const { data } = await api.delete(`/turnos/${id}`);
  return data;
}
export async function actualizarTurnoOwner(id, payload) {
  try {
    const { data } = await api.put(`/turnos/${id}`, payload);
    return data;
  } catch (e) {
    const st = e?.response?.status;
    if (st === 404 || st === 405) {
      const { data } = await api.post(`/turnos/${id}/posponer`, payload);
      return data;
    }
    throw e;
  }
}

/* ===== PÚBLICO (Reservar.jsx) ===== */
// codeOrId: aceptamos id numérico (emprendedor_id) o código
export async function listarTurnosPublicos(codeOrId, { desde, hasta } = {}) {
  const path =
    /^[0-9]+$/.test(String(codeOrId)) ? `/publico/turnos/${codeOrId}` : `/publico/turnos/${codeOrId}`;
  const { data } = await api.get(path, { params: { desde, hasta } });
  return Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
}
export async function reservarTurno(payload) {
  // payload: { codigo, servicio_id, inicio, fin?, cliente_nombre?, cliente_telefono?, notas? }
  const body = { ...payload };
  if (body.notas && !body.nota) body.nota = body.notas; // compat
  const { data } = await api.post(`/publico/turnos`, body);
  return data;
}
export async function horariosPublicos(emprendedor_id) {
  const { data } = await api.get(`/publico/horarios/${emprendedor_id}`);
  return Array.isArray(data) ? data : [];
}
export async function serviciosPublicos(codigo) {
  const { data } = await api.get(`/publico/servicios/${codigo}`);
  return Array.isArray(data) ? data : [];
}
