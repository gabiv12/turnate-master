// src/services/emprendedores.js
import api from "./api";
import { me } from "./usuarios";

/* ==== Lecturas ==== */
export async function miEmprendedor() {
  try {
    const r = await api.get("/emprendedores/mi");
    return r.data || null;
  } catch (e) {
    if (e?.response?.status === 404) return null; // no tiene aún
    throw e;
  }
}

/* ==== Creación tolerante (para auto-recuperar 404) ==== */
async function crearEmprendedorMin({ nombre = "Mi Negocio", descripcion = null } = {}) {
  try {
    const { data } = await api.post("/emprendedores", { nombre, descripcion });
    return data?.emprendedor || data;
  } catch { return null; }
}

async function crearPorRutasAlternas({ nombre = "Mi Negocio" } = {}) {
  try {
    const { data } = await api.post("/usuarios/me/emprendedor", { nombre });
    return data?.emprendedor || data;
  } catch {}
  try {
    const { data } = await api.post("/emprendedores/asegurar", { nombre });
    return data?.emprendedor || data;
  } catch {}
  return null;
}

/* ==== Smart getter (intenta crear si /mi da 404) ==== */
export async function miEmprendedorSmart({ nombreFallback } = {}) {
  const tryGet = async () => {
    const { data } = await api.get("/emprendedores/mi");
    return data?.emprendedor || data;
  };
  try {
    return await tryGet();
  } catch (e) {
    if (!/404/.test(String(e))) throw e;
    const u = await me().catch(() => null);
    const nombre = (u?.nombre || nombreFallback || "Mi Negocio").toString().trim() || "Mi Negocio";
    let emp = await crearEmprendedorMin({ nombre });
    if (!emp) emp = await crearPorRutasAlternas({ nombre });
    if (emp) return await tryGet();
    throw "Aún no activaste el plan Emprendedor.";
  }
}

/* ==== Actualización (lo que te faltaba) ==== */
export async function actualizarEmprendedor(payload = {}) {
  // 1) Ruta preferida
  try {
    const { data } = await api.put("/emprendedores/mi", payload);
    return data?.emprendedor || data;
  } catch (e1) {
    // 2) Fallback por id si existe
    let id = payload?.id || payload?.emprendedor_id || null;
    if (!id) {
      try { id = (await miEmprendedorSmart())?.id || null; } catch {}
    }
    if (id) {
      try {
        const { data } = await api.put(`/emprendedores/${id}`, payload);
        return data?.emprendedor || data;
      } catch (e2) {
        // 3) Último intento con PATCH
        const { data } = await api.patch(`/emprendedores/${id}`, payload);
        return data?.emprendedor || data;
      }
    }
    throw e1;
  }
}

/* ==== Endpoints “mis/*” ==== */
export async function misServicios() {
  const { data } = await api.get("/servicios/mis");
  return Array.isArray(data) ? data : data?.items || [];
}
export async function misHorarios() {
  const { data } = await api.get("/horarios/mis");
  return Array.isArray(data) ? data : data?.items || [];
}
export async function misTurnos(params = {}) {
  const { data } = await api.get("/turnos/mis", { params });
  return Array.isArray(data) ? data : data?.items || [];
}

/* ==== Público ==== */
export async function publicoByCodigo(codigo) {
  const { data } = await api.get(`/publico/emprendedores/by-codigo/${codigo}`);
  return data;
}
