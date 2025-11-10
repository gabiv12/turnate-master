// src/services/mappers.js

export function normServicio(s) {
  if (!s) return null;
  return {
    id: s.id ?? s.servicio_id ?? s._id ?? null,
    nombre: s.nombre ?? s.titulo ?? "",
    duracion_min: s.duracion_min ?? s.duracion ?? s.duracionMin ?? 30,
    precio_ars: s.precio_ars ?? s.precio ?? s.monto ?? 0,
    activo: s.activo ?? s.enabled ?? true,
  };
}

export function normHorario(h) {
  if (!h) return null;
  return {
    id: h.id ?? h.horario_id ?? null,
    dia: h.dia ?? h.day ?? h.weekday ?? 0,
    desde: h.desde ?? h.inicio ?? h.start ?? "09:00:00",
    hasta: h.hasta ?? h.fin ?? h.end ?? "18:00:00",
    intervalo_min: h.intervalo_min ?? h.intervalo ?? 30,
  };
}

export function normTurno(t) {
  if (!t) return null;
  const inicio = t.inicio ?? t.desde ?? t.datetime ?? t.start ?? t.fecha_inicio;
  const dur = t.duracion_min ?? t.duracion ?? 30;
  return {
    id: t.id ?? t.turno_id ?? null,
    servicio_id: t.servicio_id ?? t.servicio?.id ?? null,
    cliente: t.cliente ?? t.nombre_cliente ?? t.user_name ?? "",
    inicio,
    duracion_min: dur,
    estado: t.estado ?? t.status ?? "confirmado",
    precio_ars: t.precio_ars ?? t.precio ?? 0,
  };
}
