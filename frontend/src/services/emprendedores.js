// src/services/emprendedores.js
import api from "./api";

export async function getMiEmprendedor() {
  try {
    const { data } = await api.get("/usuarios/me/emprendedor");
    return data;
  } catch (err) {
    const status = err?.response?.status || 0;
    if (status !== 404 && status !== 500) throw err;
  }
  const { data } = await api.get("/emprendedores/mi");
  return data;
}

export async function updateEmprendedor(id, payload) {
  try {
    const { data } = await api.put(`/emprendedores/${id}`, payload);
    return data;
  } catch (err) {
    const status = err?.response?.status || 0;
    if (status === 405 || status === 404 || status === 422) {
      const { data } = await api.patch(`/emprendedores/${id}`, payload);
      return data;
    }
    throw err;
  }
}

export async function generarCodigoCliente(id) {
  const { data } = await api.post(`/emprendedores/${id}/generar-codigo`);
  return data;
}

export async function activarEmprendedorById(userId) {
  const { data } = await api.put(`/usuarios/${userId}/activar_emprendedor`);
  return data;
}
