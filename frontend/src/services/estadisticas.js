// src/services/estadisticas.js

function num(v) { const n = Number(v); return Number.isFinite(n) ? n : 0; }

export function kpisBasicos({ turnos = [], servicios = [] }) {
  const byIdServicio = new Map(servicios.map(s => [Number(s.id), s]));
  const confirmados = turnos.filter(t => (t.estado || "confirmado") === "confirmado");
  const totalTurnos = confirmados.length;

  let ingresos = 0;
  const porServicio = new Map();
  const ocupacionDia = new Map();

  for (const t of confirmados) {
    const sid = Number(t.servicio_id ?? t.servicio?.id);
    const s = byIdServicio.get(sid) || t.servicio || {};
    const precio = num(t.precio_aplicado ?? s.precio ?? 0);
    ingresos += precio;

    const key = sid || s.id || String(s.nombre || "sin-servicio");
    const agg = porServicio.get(key) || { servicio: s.nombre || "Sin servicio", cantidad: 0, ingresos: 0 };
    agg.cantidad += 1;
    agg.ingresos += precio;
    porServicio.set(key, agg);

    const rawDate = t.inicio || t.fecha || t.desde || t.datetime;
    const d = rawDate ? new Date(rawDate) : null;
    const day = d && !isNaN(d) ? d.toISOString().slice(0, 10) : null;
    if (day) ocupacionDia.set(day, (ocupacionDia.get(day) || 0) + 1);
  }

  const topServicios = Array.from(porServicio.values())
    .sort((a, b) => b.cantidad - a.cantidad)
    .slice(0, 5);

  const ocupacion = Array.from(ocupacionDia.entries())
    .map(([fecha, cantidad]) => ({ fecha, cantidad }))
    .sort((a, b) => a.fecha.localeCompare(b.fecha));

  return { totalTurnos, ingresosEstimados: ingresos, topServicios, ocupacionDia: ocupacion };
}

export function toCSV(rows, headers) {
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const head = headers.map(h => esc(h.label)).join(",");
  const body = rows.map(r => headers.map(h => esc(r[h.key])).join(",")).join("\n");
  return `${head}\n${body}`;
}
