// src/services/horarios.js
import api, { errorMessage } from "./api";

/* =========================
   Normalizadores y validaciones
   ========================= */
function hhmm(s) {
  if (!s) return "00:00";
  const parts = String(s).trim().split(":");
  const h = parseInt(parts[0] || "0", 10);
  const m = parseInt(parts[1] || "0", 10);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return "00:00";
  const H = Math.min(Math.max(h, 0), 23);
  const M = Math.min(Math.max(m, 0), 59);
  return `${H.toString().padStart(2, "0")}:${M.toString().padStart(2, "0")}`;
}
function normDia(d) {
  const n = parseInt(d, 10);
  if (Number.isFinite(n)) {
    if (n >= 0 && n <= 6) return n;       // 0..6 (L..D)
    if (n >= 1 && n <= 7) return n % 7;   // 1..7 -> 0..6 (7->0)
  }
  return 0;
}
function toMin(hhmmStr) {
  const [h, m] = hhmm(hhmmStr).split(":").map(x => parseInt(x, 10));
  return h * 60 + m;
}
function normIntervalo(x) {
  const n = parseInt(x, 10);
  return Number.isFinite(n) && n > 0 ? n : 30;
}
function normalizeBloques(raw) {
  const arr = Array.isArray(raw) ? raw : [];
  return arr
    .map(b => {
      const dia = normDia(b?.dia);
      const desde = hhmm(b?.desde);
      const hasta = hhmm(b?.hasta);
      const intervalo = normIntervalo(b?.intervalo);
      return { dia, desde, hasta, intervalo };
    })
    // Filtramos bloques claramente inválidos para evitar 422
    .filter(b => toMin(b.desde) < toMin(b.hasta));
}

/* =========================
   Lectura de horarios (dueño)
   ========================= */
export async function obtenerHorarios(emprendedorId) {
  const tries = [
    { method: "get", url: `/horarios/mis` },
    { method: "get", url: `/emprendedores/${emprendedorId}/horarios` },
  ];
  for (const t of tries) {
    try {
      const { data } = await api.request(t);
      return Array.isArray(data) ? data : [];
    } catch (e) {
      // En tu api.js el interceptor ya devuelve string. Por compatibilidad:
      const st = e?.response?.status;
      if ([404, 405].includes(st)) continue;
      if (typeof e === "string") throw e;
      throw errorMessage(e);
    }
  }
  return [];
}

/* =========================
   Reemplazo de horarios (dueño)
   - Normaliza: día, HH:MM, intervalo, y descarta desde>=hasta.
   - Intenta primero {bloques:[...]}.
   - Si responde 422, reintenta con body [] plano.
   - Luego prueba fallbacks por emprendedor.
   ========================= */
export async function reemplazarHorarios(emprendedorId, payload /* { bloques: [...] } */) {
  const bloques = normalizeBloques(payload?.bloques || payload || []);

  if (!bloques.length) {
    return Promise.reject("No hay bloques válidos para guardar.");
  }

  const attempts = [
    // 1) Lo que espera el back nuevo
    { method: "post", url: `/horarios/mis`, data: { bloques } },
    // 2) Tolerancia: lista plana
    { method: "post", url: `/horarios/mis`, data: bloques },
    // 3) Fallbacks por emprendedor (si existieran en tu back)
    { method: "put", url: `/emprendedores/${emprendedorId}/horarios:replace`, data: { bloques } },
    { method: "put", url: `/emprendedores/${emprendedorId}/horarios`, data: { bloques } },
  ];

  let last = "No se pudieron guardar los horarios.";
  for (const req of attempts) {
    try {
      const { data } = await api.request(req);
      // Devolvemos tal cual o reconstruimos desde nuestra normalización
      if (Array.isArray(data)) return data;
      if (Array.isArray(data?.bloques)) return data.bloques;
      return bloques;
    } catch (e) {
      // Si es string viene del interceptor; si no, lo transformamos
      const msg = typeof e === "string" ? e : errorMessage(e);
      // Si es un 422, seguimos probando siguiente formato de body
      last = msg;
      continue;
    }
  }
  return Promise.reject(last);
}
