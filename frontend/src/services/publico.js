// src/api/publico.js
import api from "./client";

export async function emprendedorPorCodigo(codigo) {
  const { data } = await api.get(`/publico/emprendedores/by-codigo/${codigo}`);
  return data; // {id, nombre, descripcion, codigo_cliente}
}

export async function serviciosPublicos(emprendedor_id) {
  const { data } = await api.get(`/publico/servicios/${emprendedor_id}`);
  return data;
}

export async function agendaPublica({ emprendedor_id, desde, hasta }) {
  const { data } = await api.get(`/publico/agenda`, { params: { emprendedor_id, desde, hasta } });
  return data; // { slots: [...] }
}

export async function crearTurnoPublico(payload) {
  const { data } = await api.post(`/publico/turnos`, payload);
  return data;
}
