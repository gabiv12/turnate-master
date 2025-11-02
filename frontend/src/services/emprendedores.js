// src/services/emprendedores.js
import api from "./api";

/* ---------- Mi Emprendedor con fallback ---------- */
export async function miEmprendedor() {
  try {
    const { data } = await api.get("/emprendedores/mi");
    return data || null;
  } catch (e) {
    const st = e?.response?.status;
    if (st !== 401 && st !== 404) throw e;
  }
  try {
    const { data } = await api.get("/usuarios/me/emprendedor");
    return data || null;
  } catch (e) {
    const st = e?.response?.status;
    if (st === 404) return null;
    throw e;
  }
}

/* ---------- Update Emprendedor ---------- */
export async function actualizarEmprendedor(id, payload) {
  const { data } = await api.put(`/emprendedores/${id}`, payload);
  return data;
}

/* ---------- Crear Emprendedor (Plan B) ----------
   Crea un Emprendedor mínimo cuando la activación falla (401/404/405).
   Fallbacks probables según back:
   1) POST /emprendedores
   2) POST /usuarios/{id}/emprendedor
   3) POST /emprendedores/ensure (si existiera)
*/
export async function crearEmprendedorMin({ usuario_id, nombre, descripcion, telefono, direccion }) {
  const payload = {
    usuario_id,
    nombre: (nombre || "Mi Emprendimiento").trim(),
    descripcion: descripcion || "",
    telefono: telefono || "",
    direccion: direccion || "",
  };

  const tries = [
    { method: "post", url: `/emprendedores`, data: payload },
    { method: "post", url: `/usuarios/${usuario_id}/emprendedor`, data: payload },
    { method: "post", url: `/emprendedores/ensure`, data: payload },
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
  throw lastErr || new Error("No se pudo crear el Emprendedor.");
}
