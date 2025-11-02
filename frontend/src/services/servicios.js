// src/api/servicios.js
import api from "./client";

export async function listarMisServicios() {
  const { data } = await api.get("/servicios/mis");
  return data;
}

export async function crearServicio(payload) {
  const { data } = await api.post("/servicios/mis", payload);
  return data;
}

export async function actualizarServicio(id, patch) {
  const { data } = await api.put(`/servicios/mis/${id}`, patch);
  return data;
}

export async function eliminarServicio(id) {
  await api.delete(`/servicios/mis/${id}`);
}
