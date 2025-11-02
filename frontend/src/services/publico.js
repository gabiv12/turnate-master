// src/api/publico.js
import api from "../services/api";

export async function emprendedorPorCodigo(codigo) {
  const { data } = await api.get(`/publico/emprendedores/by-codigo/${codigo}`);
  return data;
}
export async function serviciosPublicos(emprendedor_id) {
  const { data } = await api.get(`/publico/servicios/${emprendedor_id}`);
  return data;
}
export async function agendaPublica({ emprendedor_id, desde, hasta }) {
  const { data } = await api.get(`/publico/agenda`, { params: { emprendedor_id, desde, hasta } });
  return data;
}
export async function crearTurnoPublico(payload) {
  const { data } = await api.post(`/publico/turnos`, payload);
  return data;
}
