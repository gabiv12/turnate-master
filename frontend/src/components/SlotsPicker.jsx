import { useMemo, useState } from "react";
import { format, addDays, addMinutes, startOfDay, isBefore } from "date-fns";
import es from "date-fns/locale/es";
import { agendaPublica, crearTurnoPublico } from "../api/publico";

const money = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
const DIAS_LARGO = ["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"];

// helpers
const hhmmFromAny = (val) => {
  // admite "HH:mm" o Date/Time serializado
  if (!val) return null;
  if (typeof val === "string") {
    // si viene "HH:MM:SS" o "HH:MM"
    const hhmm = val.slice(0,5);
    return /^\d{2}:\d{2}$/.test(hhmm) ? hhmm : null;
  }
  // no forzamos más formatos
  return null;
};
const toDateAt = (dayDate, hhmm) => {
  const [hh, mm] = String(hhmm || "00:00").split(":").map(Number);
  const d = new Date(dayDate);
  d.setHours(hh || 0, mm || 0, 0, 0);
  return d;
};
const overlaps = (a0, a1, b0, b1) => a0 < b1 && a1 > b0;

// mapea un horario cualquiera a {desde, hasta}
const mapHorario = (h) => {
  // soporta {inicio, fin} (tu modelo actual) o {hora_desde, hora_hasta}
  const desde = hhmmFromAny(h?.inicio) ?? hhmmFromAny(h?.hora_desde);
  const hasta = hhmmFromAny(h?.fin)    ?? hhmmFromAny(h?.hora_hasta);
  // step configurable si viene, sino 30
  const intervalo = Number(h?.intervalo_min ?? h?.intervalo ?? 30) || 30;
  const dia_semana = Number(h?.dia_semana ?? 0);
  return { dia_semana, desde, hasta, intervalo };
};

export default function SlotsPicker({
  codigo,
  emprendedorId,
  servicios = [],
  horarios = [],
  turnos = [],
  desdeISO,
  hastaISO,
  onAfterReserve,
  diasAdelante = 21,
}) {
  const [selServicioId, setSelServicioId] = useState(servicios[0]?.id ?? null);
  const [cliente, setCliente] = useState({ nombre: "", telefono: "" });
  const [booking, setBooking] = useState({ when: null, saving: false, ok: "", err: "" });

  const servicioSel = useMemo(() => servicios.find(s => Number(s.id) === Number(selServicioId)) || null, [servicios, selServicioId]);
  const duracionMin = useMemo(() => {
    const d = Number(servicioSel?.duracion_min ?? servicioSel?.duracion_minutos ?? 0);
    return d > 0 ? d : 30;
  }, [servicioSel]);

  const turnosPorDia = useMemo(() => {
    const map = new Map();
    for (const t of turnos) {
      const d0 = new Date(t.inicio);
      const k = format(d0, "yyyy-MM-dd");
      const arr = map.get(k) || [];
      const fin = t.fin ? new Date(t.fin) : addMinutes(d0, Number(t.duracion_min ?? 60));
      arr.push({ inicio: d0, fin });
      map.set(k, arr);
    }
    return map;
  }, [turnos]);

  const horariosPorDia = useMemo(() => {
    const m = new Map();
    for (let i = 0; i < 7; i++) m.set(i, []);
    for (const raw of horarios) {
      const h = mapHorario(raw);
      if (h.desde && h.hasta) m.get(h.dia_semana).push(h);
    }
    for (const [, arr] of m) arr.sort((a,b) => (a.desde||"").localeCompare(b.desde||""));
    return m;
  }, [horarios]);

  const hoy = useMemo(() => startOfDay(new Date()), []);
  const dias = useMemo(() => {
    const out = [];
    for (let d = 0; d <= diasAdelante; d++) {
      const day = addDays(hoy, d);
      const diaSemana = day.getDay();
      const bloques = horariosPorDia.get(diaSemana) || [];

      const slots = [];
      for (const b of bloques) {
        const start = toDateAt(day, b.desde);
        const end   = toDateAt(day, b.hasta);
        const step  = Number(b.intervalo || 30) || 30;

        for (let t = new Date(start); addMinutes(t, duracionMin) <= end; t = addMinutes(t, step)) {
          const slotStart = new Date(t);
          const slotEnd = addMinutes(slotStart, duracionMin);
          if (isBefore(slotStart, new Date())) continue;
          const key = format(slotStart, "yyyy-MM-dd");
          const ocupados = turnosPorDia.get(key) || [];
          const choca = ocupados.some(o => overlaps(slotStart, slotEnd, o.inicio, o.fin));
          if (!choca) slots.push({ start: slotStart, end: slotEnd });
        }
      }
      out.push({ day, slots });
    }
    return out;
  }, [hoy, horariosPorDia, turnosPorDia, duracionMin, diasAdelante]);

  async function onReservar(slot) {
    if (!servicioSel) return;
    setBooking((p) => ({ ...p, when: slot, saving: true, ok: "", err: "" }));
    try {
      const payload = {
        codigo,
        emprendedor_id: emprendedorId,           // opcional, pero ayuda si tu back lo acepta
        servicio_id: Number(servicioSel.id),
        inicio: slot.start.toISOString(),
        // el back calcula fin con duracion_min; si querés enviar fin, dejalo:
        // fin: slot.end.toISOString(),
        cliente_nombre: (cliente.nombre || "Cliente").trim(),
        cliente_contacto: (cliente.telefono || "").trim() || null,
      };
      await crearTurnoPublico(payload);

      // refrescá agenda pública
      if (emprendedorId && desdeISO && hastaISO) {
        await agendaPublica({ emprendedor_id: emprendedorId, desde: desdeISO, hasta: hastaISO });
      }
      onAfterReserve?.(); // el padre puede volver a pedir agenda/servicios

      setBooking({ when: null, saving: false, ok: "¡Reserva confirmada!", err: "" });
      setTimeout(() => setBooking({ when: null, saving: false, ok: "", err: "" }), 2500);
    } catch (e) {
      const s = e?.response?.status;
      const detail = e?.response?.data?.detail || e?.response?.data?.message || e?.message;
      const msg =
        s === 409 ? "Ese horario se ocupó recién. Elegí otro, por favor."
        : s === 422 ? "Datos inválidos. Revisá el servicio y el horario."
        : s === 401 ? "Tu sesión expiró. Volvé a iniciar sesión."
        : detail || "No se pudo reservar el turno.";
      setBooking((p) => ({ ...p, saving: false, err: msg }));
    }
  }

  return (
    <div className="grid gap-4">
      {/* selector de servicio */}
      <div className="w-full max-w-xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="sm:col-span-2">
          <label className="block text-xs font-semibold text-sky-700 mb-1">Servicio</label>
          <select
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 outline-none focus:ring-2 focus:ring-sky-300"
            value={selServicioId || ""}
            onChange={(e)=>setSelServicioId(Number(e.target.value)||null)}
          >
            {servicios.length === 0 && <option value="">No hay servicios configurados</option>}
            {servicios.map(s=>(
              <option key={s.id} value={s.id}>
                {s.nombre} · {Number(s.duracion_min ?? s.duracion_minutos ?? 30)} min {s.precio ? `· ${money.format(Number(s.precio||0))}` : ""}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-sky-700 mb-1">Duración</label>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm">
            {duracionMin} min
          </div>
        </div>
      </div>

      {/* grilla de días/slots */}
      {servicioSel ? (
        <div className="grid md:grid-cols-2 gap-4">
          {dias.map(({ day, slots }) => (
            <div key={day.toISOString()} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="font-medium text-slate-800 text-center">
                {DIAS_LARGO[day.getDay()]} {format(day, "d 'de' MMM", { locale: es })}
              </div>
              {slots.length === 0 ? (
                <div className="text-xs text-slate-500 text-center mt-1.5">Sin turnos para este día.</div>
              ) : (
                <div className="mt-2 flex flex-wrap justify-center gap-2">
                  {slots.slice(0, 24).map((s) => (
                    <button
                      key={s.start.toISOString()}
                      onClick={() => setBooking({ when: s, saving: false, ok: "", err: "" })}
                      className="rounded-lg bg-blue-600 text-white px-3 py-1.5 text-sm font-semibold hover:bg-blue-700"
                    >
                      {format(s.start, "HH:mm")}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-sm text-center text-slate-500">Primero elegí un servicio.</div>
      )}

      {/* confirmación */}
      {booking.when && (
        <section className="rounded-2xl border-2 border-blue-200 bg-white p-4 md:p-5 shadow-sm">
          <div className="text-center">
            <div className="font-semibold text-slate-900">Confirmar turno</div>
            <div className="text-sm text-slate-600 mt-0.5">
              {format(booking.when.start, "EEE d MMM · HH:mm", { locale: es })}
            </div>
            <div className="grid sm:grid-cols-2 gap-3 mt-3 max-w-xl mx-auto">
              <div>
                <label className="block text-xs font-semibold text-sky-700 mb-1">Tu nombre</label>
                <input
                  value={cliente.nombre}
                  onChange={(e)=>setCliente(p=>({...p, nombre: e.target.value}))}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 outline-none focus:ring-2 focus:ring-sky-300"
                  placeholder="Ej: Cliente X"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-sky-700 mb-1">Teléfono (opcional)</label>
                <input
                  value={cliente.telefono}
                  onChange={(e)=>setCliente(p=>({...p, telefono: e.target.value}))}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 outline-none focus:ring-2 focus:ring-sky-300"
                  placeholder="Ej: +54 9 ..."
                />
              </div>
            </div>

            <div className="mt-3 flex items-center justify-center gap-2">
              <button
                onClick={()=>setBooking({ when: null, saving: false, ok: "", err: "" })}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-50"
                type="button"
              >
                Cancelar
              </button>
              <button
                onClick={()=>onReservar(booking.when)}
                disabled={booking.saving || !servicioSel}
                className="rounded-xl bg-blue-600 text-white px-5 py-2 text-sm font-semibold hover:bg-blue-700 disabled:opacity-60"
                type="button"
              >
                {booking.saving ? "Reservando…" : "Confirmar reserva"}
              </button>
            </div>

            {booking.ok && (
              <div className="mt-3 rounded-xl bg-emerald-50 text-emerald-700 text-sm px-4 py-2 ring-1 ring-emerald-200">
                {booking.ok}
              </div>
            )}
            {booking.err && (
              <div className="mt-3 rounded-xl bg-rose-50 text-rose-700 text-sm px-4 py-2 ring-1 ring-rose-200">
                {booking.err}
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
