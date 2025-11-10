// src/pages/Turnos.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Calendario from "../components/Calendario.jsx";
import api from "../services/api";
import { useUser } from "../context/UserContext.jsx";
import { isEmprendedor as empCheck } from "../utils/roles";
import { format, startOfMonth, endOfMonth, startOfDay, endOfDay, addMinutes, isSameDay } from "date-fns";
import es from "date-fns/locale/es";
import {
  listarTurnosOwner,
  crearTurnoOwner,
  borrarTurno,
} from "../services/turnos";

const cx = (...c) => c.filter(Boolean).join(" ");

/* ===== Helpers ===== */
function friendly(err) {
  if (typeof err === "string") return err;
  const s = err?.response?.status;
  const d = err?.response?.data;
  if (s === 401) return "Tu sesión se cerró. Iniciá sesión.";
  if (s === 403) return "No autorizado.";
  if (s === 409) return d?.detail || "Horario no disponible o fuera de bloque.";
  if (typeof d === "string") return d;
  if (d?.detail) return typeof d.detail === "string" ? d.detail : "Ocurrió un error.";
  return err?.message || "No disponible por el momento.";
}
const iso = (d) => (d instanceof Date ? d.toISOString() : new Date(d).toISOString());
const toLocalNaive = (date) => {
  const d = new Date(date);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}:${pad(d.getSeconds())}`;
};
const sanitize = (s = "") => s.replace(/[<>]/g, "").trim();

/* ===== Horarios helpers ===== */
const mapDiaToJS = (dia) => {
  const n = Number(dia);
  if (!Number.isFinite(n)) return null;
  if (n === 0 || n === 7) return 0; // domingo
  if (n >= 1 && n <= 6) return n;   // 1..6 => lun..sab
  return n % 7;
};
const enabledWeekdaysFrom = (horarios = []) => {
  const set = new Set();
  horarios
    .filter((h) => h?.activo !== false)
    .forEach((h) => {
      const jsd = mapDiaToJS(h.dia_semana);
      if (jsd !== null) set.add(jsd);
    });
  return set;
};

/* ===== Map Turno -> Evento calendario ===== */
const toDate = (v) => (v ? new Date(v) : null);
function mapTurnoParaCalendario(t, servicios = []) {
  const svc = servicios.find((s) => Number(s.id) === Number(t.servicio_id));
  const start =
    toDate(t.inicio) || toDate(t.desde) || toDate(t.datetime) || toDate(t.fecha_inicio) || new Date();
  const svcDur =
    Number(t?.duracion_minutos ?? t?.duracion_min ?? svc?.duracion_min ?? svc?.duracion_minutos ?? 30) || 30;
  const end = toDate(t.fin) || toDate(t.hasta) || new Date(start.getTime() + svcDur * 60000);

  const nombreServicio = t?.servicio?.nombre || svc?.nombre || t.servicio_nombre || "Servicio";
  const rawCliente = (t?.cliente?.nombre ?? t?.cliente_nombre ?? t?.nombre_cliente ?? "").toString().trim();
  const cliente = rawCliente.length ? rawCliente : null;

  return {
    id: t.id ?? t.turno_id ?? t.uuid,
    title: cliente ? `${cliente} · ${nombreServicio}` : nombreServicio,
    start,
    end,
    servicio_id: t.servicio_id ?? svc?.id ?? null,
    servicio: nombreServicio,
    cliente_nombre: cliente || "",
    notas: t.notas ?? t.nota ?? "",
    cliente_contacto: t?.cliente_contacto ?? t?.contacto ?? "",
    estado: t?.estado ?? "reservado",
    raw: t,
  };
}

/* ============================================================
 *  MODAL: UI tipo “Reservar” (Día → Servicio → Horario → Confirmar)
 *  Sólo UX; la lógica de backend se mantiene (onCreate/onUpdate).
 * ============================================================ */
function TurnoModal({
  open,
  onClose,
  servicios,
  horarios,
  rawTurnos, // para calcular ocupados
  selected,
  onCreate,
  onUpdate,
  inlineMsg,
  busy,
}) {
  const isEdit = !!(selected && selected.id != null);

  // Estado
  const [fecha, setFecha] = useState(() => (isEdit ? new Date(selected?.start) : null));
  const [servicioId, setServicioId] = useState(() => (isEdit ? (selected?.servicio_id ?? "") : ""));
  const [slot, setSlot] = useState(() => (isEdit ? { start: new Date(selected?.start) } : null));
  const [cliente, setCliente] = useState(() => (isEdit ? (selected?.cliente_nombre || "") : ""));
  const [notas, setNotas] = useState(() => (isEdit ? (selected?.notas || "") : ""));
  const [localMsg, setLocalMsg] = useState("");

  // Normalizadores
  const cutHHMM = (t) => String(t || "").slice(0, 5);
  const normHorario = (h) => ({
    dia_semana: Number(h?.dia_semana ?? 0),
    hora_desde: cutHHMM(h?.hora_desde ?? h?.inicio ?? "08:00"),
    hora_hasta: cutHHMM(h?.hora_hasta ?? h?.fin ?? "18:00"),
    intervalo_min: Number(h?.intervalo_min ?? 30) || 30,
    activo: h?.activo !== false,
  });

  const horariosNorm = useMemo(
    () => (Array.isArray(horarios) ? horarios.map(normHorario) : []),
    [horarios]
  );

  const servicioSel = useMemo(
    () => (servicios || []).find((s) => String(s.id) === String(servicioId)) || null,
    [servicioId, servicios]
  );

  const ocupadosDelDia = useMemo(() => {
    if (!fecha) return [];
    return (rawTurnos || [])
      .map((t) => (t.inicio && t.fin ? { inicio: new Date(t.inicio), fin: new Date(t.fin) } : null))
      .filter(Boolean)
      .filter((t) => isSameDay(t.inicio, fecha));
  }, [fecha, rawTurnos]);

  // Slots calculados según horarios + servicio
  const slots = useMemo(() => {
    if (!fecha || !servicioSel) return [];
    const day = fecha.getDay();
    const bloques = horariosNorm.filter((h) => h.activo && Number(h.dia_semana) === day);
    if (bloques.length === 0) return [];

    const dur = Number(servicioSel.duracion_min ?? servicioSel.duracion ?? 30) || 30;
    const list = [];
    bloques.forEach((b) => {
      const [hD, mD] = String(b.hora_desde || "08:00").split(":").map(Number);
      const [hH, mH] = String(b.hora_hasta || "18:00").split(":").map(Number);
      const step = Number(b.intervalo_min || 30) || 30;

      const base = new Date(fecha); base.setHours(hD, mD, 0, 0);
      const blockEnd = new Date(fecha); blockEnd.setHours(hH, mH, 0, 0);

      for (let d = new Date(base); d < blockEnd; d = addMinutes(d, step)) {
        const end = addMinutes(new Date(d), dur);
        if (end > blockEnd) continue;
        const choca = ocupadosDelDia.some((o) => o.inicio < end && o.fin > d);
        if (!choca) list.push({ start: new Date(d), blockEnd: new Date(blockEnd) });
      }
    });
    return list;
  }, [fecha, servicioSel, horariosNorm, ocupadosDelDia]);

  // Reset al abrir
  useEffect(() => {
    if (!open) return;
    setLocalMsg("");
    if (isEdit) {
      setFecha(new Date(selected?.start));
      setServicioId(selected?.servicio_id ?? "");
      setSlot({ start: new Date(selected?.start) });
      setCliente(selected?.cliente_nombre || "");
      setNotas(selected?.notas || "");
    } else {
      setFecha(null);
      setServicioId("");
      setSlot(null);
      setCliente("");
      setNotas("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isEdit, selected?.id]);

  // ESC
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "enter") handleSubmit();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, fecha, servicioId, slot, cliente, notas, busy]);

  async function handleSubmit(e) {
    e?.preventDefault?.();
    if (!fecha) return setLocalMsg("Elegí un día.");
    if (!servicioId) return setLocalMsg("Elegí un servicio.");
    if (!slot) return setLocalMsg("Elegí un horario disponible.");

    const dur = Number(servicioSel?.duracion_min ?? 30) || 30;
    const start = new Date(slot.start);
    const end = new Date(start.getTime() + dur * 60000);
    const payload = {
      servicio_id: Number(servicioId),
      inicio: start.toISOString(),
      fin: end.toISOString(),
      cliente_nombre: sanitize(cliente),
      notas: sanitize(notas),
    };
    if (isEdit) await onUpdate?.(payload);
    else await onCreate?.(payload);
  }

  if (!open) return null;

  // UI 4 columnas compactas
  return (
    <div
      className="fixed inset-0 z-[90] grid place-items-center bg-slate-900/60 backdrop-blur-sm px-3"
      role="dialog"
      aria-modal="true"
      onClick={(e) => { if (e.target === e.currentTarget && !busy) onClose?.(); }}
    >
      <div className="w-full max-w-5xl overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-slate-200">
        {/* Header */}
        <div className="relative bg-gradient-to-r from-blue-700 via-sky-600 to-emerald-500 px-5 py-5 text-white">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 grid place-items-center rounded-xl bg-white/15 ring-1 ring-white/30">
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <rect x="3" y="4" width="18" height="18" rx="3" />
                  <path d="M16 2v4M8 2v4M3 10h18" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl md:text-2xl font-extrabold tracking-tight">
                  {isEdit ? "Editar turno" : "Nuevo turno"}
                </h2>
                <p className="text-white/90 text-sm">
                  Elegí <b>día</b>, <b>servicio</b> y <b>horario</b>. Validamos choques y bloques.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="rounded-xl bg-white/10 px-3 py-1.5 text-sm font-semibold ring-1 ring-white/30 hover:bg-white/20 disabled:opacity-60"
              aria-label="Cerrar"
              title="Cerrar (Esc)"
            >
              Cerrar
            </button>
          </div>
        </div>

        {/* Mensajes */}
        <div className="px-5 pt-4">
          {inlineMsg && (
            <div className={cx(
              "rounded-xl px-3 py-2 text-sm mb-3 ring-1",
              /(error|No se pudo|403|404|405|409|500|cerró)/i.test(inlineMsg)
                ? "bg-red-50 text-red-700 ring-red-200"
                : "bg-emerald-50 text-emerald-700 ring-emerald-200"
            )}>
              {inlineMsg}
            </div>
          )}
          {localMsg && (
            <div className="rounded-xl px-3 py-2 text-sm mb-3 ring-1 bg-sky-50 text-sky-700 ring-sky-200">
              {localMsg}
            </div>
          )}
        </div>

        {/* 4 columnas: Día / Servicio / Horario / Confirmar */}
        <form onSubmit={handleSubmit} className="px-5 pb-5">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 auto-rows-fr">
            {/* 1) Día */}
            <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm flex flex-col">
              <h3 className="text-sm font-semibold text-slate-900 mb-2">1) Día</h3>
              <input
                type="date"
                className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 outline-none focus:ring-2 focus:ring-sky-300"
                value={fecha ? format(fecha, "yyyy-MM-dd") : ""}
                onChange={(e) => {
                  const [y, m, d] = e.target.value.split("-").map(Number);
                  const nd = new Date(y, m - 1, d, 0, 0, 0, 0);
                  setFecha(isNaN(+nd) ? null : nd);
                  setSlot(null);
                }}
              />
              <p className="mt-2 text-[11px] text-slate-500">
                Sólo se mostrarán horarios dentro de tus bloques activos.
              </p>
            </section>

            {/* 2) Servicio */}
            <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm flex flex-col">
              <h3 className="text-sm font-semibold text-slate-900 mb-2">2) Servicio</h3>
              <div className="grow min-h-0 overflow-auto space-y-2">
                {(servicios || []).map((s) => {
                  const sel = String(servicioId) === String(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      disabled={!fecha}
                      onClick={() => { setServicioId(s.id); setSlot(null); }}
                      className={cx(
                        "w-full text-left rounded-xl border px-3 py-2 text-sm transition",
                        !fecha ? "opacity-50 cursor-not-allowed" :
                        sel ? "border-sky-600 bg-sky-50 text-sky-900" : "border-slate-300 bg-white hover:bg-slate-50"
                      )}
                      title={`${s.nombre} · ${Number(s.duracion_min ?? 30)} min`}
                    >
                      <div className="font-medium truncate">{s.nombre}</div>
                      <div className="text-xs text-slate-500">{Number(s.duracion_min ?? 30)} min</div>
                    </button>
                  );
                })}
                {fecha && servicios?.length === 0 && (
                  <div className="text-xs text-slate-500">No tenés servicios aún.</div>
                )}
              </div>
            </section>

            {/* 3) Horario */}
            <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm flex flex-col">
              <h3 className="text-sm font-semibold text-slate-900 mb-2">3) Horario</h3>
              <div className="grow min-h-0 overflow-auto">
                {!fecha ? (
                  <div className="text-sm text-slate-500">Elegí un día.</div>
                ) : !servicioId ? (
                  <div className="text-sm text-slate-500">Elegí un servicio.</div>
                ) : slots.length === 0 ? (
                  <div className="text-sm text-slate-500">No hay horarios disponibles.</div>
                ) : (
                  <div className="grid grid-cols-2 xl:grid-cols-3 gap-2">
                    {slots.slice(0, 36).map((s, i) => {
                      const sel = slot && s.start.getTime() === slot.start.getTime();
                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setSlot(s)}
                          className={cx(
                            "rounded-xl border px-3 py-2 text-sm font-medium transition",
                            sel ? "border-sky-600 bg-sky-50 text-sky-900 shadow-sm"
                                : "border-slate-300 bg-white text-slate-800 hover:bg-slate-50"
                          )}
                          title={`Hasta ${format(s.blockEnd, "HH:mm")}`}
                        >
                          {format(s.start, "HH:mm", { locale: es })}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>

            {/* 4) Confirmar */}
            <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm flex flex-col">
              <h3 className="text-sm font-semibold text-slate-900 mb-2">4) Confirmar</h3>
              <div className="grow min-h-0 space-y-2">
                <p className="text-sm text-slate-600">
                  {slot
                    ? <>Turno para <b>{format(slot.start, "EEEE d 'de' MMMM", { locale: es })}</b> a las <b>{format(slot.start, "HH:mm")}</b>.</>
                    : <>Completá los pasos para confirmar.</>}
                </p>

                <div>
                  <label className="block text-xs font-semibold text-sky-700 mb-1">Cliente (opcional)</label>
                  <input
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 outline-none focus:ring-2 focus:ring-sky-300"
                    value={cliente}
                    onChange={(e) => setCliente(sanitize(e.target.value))}
                    placeholder="Cliente X"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-sky-700 mb-1">Nota (opcional)</label>
                  <input
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 outline-none focus:ring-2 focus:ring-sky-300"
                    value={notas}
                    onChange={(e) => setNotas(sanitize(e.target.value))}
                    placeholder="Referencia breve"
                    maxLength={220}
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={busy}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold hover:bg-slate-50 disabled:opacity-60"
                  title="Cancelar (Esc)"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!fecha || !servicioId || !slot || busy}
                  className="rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-sky-700 disabled:opacity-60"
                  title={isEdit ? "Guardar cambios (Ctrl/⌘+Enter)" : "Crear turno (Ctrl/⌘+Enter)"}
                >
                  {busy ? (isEdit ? "Guardando…" : "Creando…") : isEdit ? "Guardar" : "Crear"}
                </button>
              </div>
            </section>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ====== Página ====== */
export default function Turnos() {
  const navigate = useNavigate();
  const { user } = useUser();
  const isEmp = empCheck(user);

  const [servicios, setServicios] = useState([]);
  const [horarios, setHorarios] = useState([]);

  const [eventos, setEventos] = useState([]);
  const [rawTurnos, setRawTurnos] = useState([]);

  const [selected, setSelected] = useState(null);
  const [openNew, setOpenNew] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const [rStart, setRStart] = useState(() => {
    const d = new Date();
    const s = startOfMonth(d);
    s.setHours(0, 0, 0, 0);
    return s;
  });
  const [rEnd, setREnd] = useState(() => {
    const d = new Date();
    const e = endOfMonth(d);
    e.setHours(23, 59, 59, 999);
    return e;
  });

  // Carga catálogos sólo si es emprendedor
  useEffect(() => {
    (async () => {
      if (!isEmp) {
        setServicios([]); setHorarios([]);
        return;
      }
      try {
        const rs = await api.get("/servicios/mis");
        setServicios(Array.isArray(rs.data?.items) ? rs.data.items : Array.isArray(rs.data) ? rs.data : []);
      } catch {}
      try {
        const rh = await api.get("/horarios/mis");
        setHorarios(Array.isArray(rh.data?.items) ? rh.data.items : Array.isArray(rh.data) ? rh.data : []);
      } catch {}
    })();
  }, [isEmp]);

  // Primera carga
  const firstRef = useRef(false);
  useEffect(() => {
    (async () => {
      if (firstRef.current) return;
      firstRef.current = true;
      await fetchTurnosRange(rStart, rEnd);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Remap cuando cambian servicios
  useEffect(() => {
    setEventos(rawTurnos.map((t) => mapTurnoParaCalendario(t, servicios)));
  }, [servicios, rawTurnos]);

  // ==== Listado
  async function listTurnos(start, end) {
    const arr = await listarTurnosOwner({ desde: iso(start), hasta: iso(end) });
    return arr.map((t) => mapTurnoParaCalendario(t, servicios));
  }

  async function fetchTurnosRange(start, end) {
    try {
      setLoading(true);
      setMsg("");
      const evs = await listTurnos(start, end);
      setRawTurnos(
        evs.map((e) => e.raw || { id: e.id, inicio: e.start?.toISOString(), fin: e.end?.toISOString(), servicio_id: e.servicio_id })
      );
      setEventos(evs);
      if (selected?.id) {
        const again = evs.find((x) => x.id === selected.id);
        if (again) setSelected(again);
      }
    } catch (e) {
      setRawTurnos([]); setEventos([]);
      setMsg(friendly(e));
    } finally {
      setLoading(false);
      setTimeout(() => setMsg(""), 2400);
    }
  }

  // ==== CRUD
  const crearTurno = async (payload) => {
    try {
      setLoading(true);
      setMsg("Creando turno…");
      try {
        await crearTurnoOwner(payload);
      } catch {
        await crearTurnoOwner({ ...payload, inicio: toLocalNaive(payload.inicio), fin: toLocalNaive(payload.fin) });
      }
      setMsg("Turno creado.");
      await fetchTurnosRange(rStart, rEnd);
      setOpenNew(false);
    } catch (e) {
      setMsg(friendly(e));
    } finally {
      setLoading(false);
      setTimeout(() => setMsg(""), 2800);
    }
  };

  const editarTurno = async (payload) => {
    if (!selected?.id) return;
    try {
      setLoading(true);
      setMsg("Guardando cambios…");
      await api.patch(`/turnos/${selected.id}`, payload).catch(async () => {
        await api.put(`/turnos/${selected.id}`, payload).catch(async () => {
          await api.post(`/turnos/${selected.id}:update`, payload);
        });
      });
      setMsg("Turno actualizado.");
      await fetchTurnosRange(rStart, rEnd);
      setOpenNew(false);
    } catch (e) {
      setMsg(friendly(e));
    } finally {
      setLoading(false);
      setTimeout(() => setMsg(""), 3000);
    }
  };

  const eliminarTurno = async () => {
    if (!selected?.id) return;
    if (!confirm("¿Eliminar el turno seleccionado?")) return;
    try {
      setLoading(true);
      setMsg("Eliminando turno…");
      await borrarTurno(selected.id);
      await fetchTurnosRange(rStart, rEnd);
      setSelected(null);
      setMsg("Turno cancelado.");
    } catch (e) {
      setMsg(friendly(e));
    } finally {
      setLoading(false);
      setTimeout(() => setMsg(""), 2500);
    }
  };

  // ==== Calendario
  const enabledWeekdays = useMemo(() => enabledWeekdaysFrom(horarios), [horarios]);
  const dayPropGetter = (date) => {
    const wd = date.getDay();
    const allowed = enabledWeekdays.has(wd);
    return allowed || !horarios?.length
      ? {}
      : { style: { backgroundColor: "#f3f4f6", color: "#9ca3af", cursor: "not-allowed" } };
  };

  const handleRangeRequest = async (start, end) => {
    setRStart(start);
    setREnd(end);
    await fetchTurnosRange(start, end);
  };

  const onSelectEvent = (evt) => {
    setSelected(evt);
    setOpenNew(true);
  };

  const onSelectSlot = (slot) => {
    if (!slot?.start) { setOpenNew(true); return; }
    setSelected({
      id: null,
      start: slot.start,
      end: slot.end || new Date(new Date(slot.start).getTime() + 30 * 60000),
      cliente_nombre: "",
      servicio: "",
      servicio_id: "",
      notas: "",
    });
    setOpenNew(true);
  };

  // ==== Render no-emprendedor: sólo info + link a reservar
  if (!isEmp) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm text-slate-700">
              Para reservar, ingresá el <b>código</b> del emprendimiento.
            </div>
            <button
              onClick={() => navigate("/reservar")}
              className="rounded-xl bg-sky-600 text-white px-4 py-2.5 text-sm font-semibold"
            >
              Sacar turno
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <Calendario
            turnos={eventos}
            onSelectEvent={() => {}}
            onSelectSlot={() => {}}
            defaultView="month"
            height={760}
            onRangeRequest={handleRangeRequest}
          />
        </div>
      </div>
    );
  }

  // ==== Render emprendedor
  return (
    <div className="space-y-4">
      {/* Encabezado */}
      <div className="-mx-4 lg:-mx-6 overflow-x-clip">
        <div className="rounded-3xl bg-gradient-to-r from-blue-600 to-cyan-400 p-5 md:p-6 text-white shadow">
          <div className="mx-auto max-w-7xl px-4 lg:px-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Gestión de Turnos</h1>
                <p className="text-sm md:text-base/relaxed opacity-90">Organizá tus servicios, horarios y turnos.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  to="/servicios"
                  className="inline-flex items-center gap-2 rounded-xl bg-white text-sky-700 px-4 py-2 text-sm font-semibold ring-1 ring-white/70 shadow hover:brightness-95"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7">
                    <path d="M12 3l8 4-8 4-8-4 8-4Z" />
                    <path d="M4 12l8 4 8-4" />
                    <path d="M4 17l8 4 8-4" />
                  </svg>
                  <span>Servicios</span>
                </Link>
                <Link
                  to="/horarios"
                  className="inline-flex items-center gap-2 rounded-xl bg-white text-sky-700 px-4 py-2 text-sm font-semibold ring-1 ring-white/70 shadow hover:brightness-95"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 7v5l3 2" />
                  </svg>
                  <span>Horarios</span>
                </Link>
                <button
                  onClick={() => { setSelected(null); setOpenNew(true); }}
                  className="rounded-xl bg-white text-sky-700 px-4 py-2 text-sm font-semibold shadow hover:brightness-95"
                >
                  + Agregar turno
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Grid principal: calendario + panel derecho */}
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-4 items-start">
        <div className="min-w-0">
          <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            <Calendario
              turnos={eventos}
              onSelectEvent={onSelectEvent}
              onSelectSlot={onSelectSlot}
              defaultView="month"
              height={760}
              dayPropGetter={dayPropGetter}
              onRangeRequest={handleRangeRequest}
            />
          </div>
        </div>

        <aside className="space-y-4 w-full xl:w-[340px] self-start xl:top-[96px] xl:sticky">
          {/* KPIs */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-slate-200 bg-white p-3 text-center">
              <div className="text-xs text-slate-500">Servicios</div>
              <div className="text-xl font-semibold">{servicios.length}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-3 text-center">
              <div className="text-xs text-slate-500">Turnos hoy</div>
              <div className="text-xl font-semibold">
                {eventos.filter((e) => {
                  const d = new Date();
                  const s = startOfDay(d);
                  const ee = endOfDay(d);
                  return e.start >= s && e.start <= ee;
                }).length}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-3 text-center">
              <div className="text-xs text-slate-500">Turnos periodo</div>
              <div className="text-xl font-semibold">{eventos.length}</div>
            </div>
          </div>

          {/* Acciones CRUD */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-2 font-medium text-slate-700">Acciones de turnos</div>
            <ul className="mb-3 text-xs text-slate-600 space-y-1.5">
              <li>• <b>Agregar</b>: “+ Agregar turno” o clic en una fecha.</li>
              <li>• <b>Editar / Posponer</b>: clic en un evento → “Guardar”.</li>
              <li>• <b>Cancelar</b>: seleccioná un turno y tocá “Cancelar”.</li>
            </ul>

            <div className="grid grid-cols-1 gap-2">
              <button
                onClick={() => { setSelected(null); setOpenNew(true); }}
                className="w-full rounded-xl bg-sky-600 px-3 py-2.5 text-sm font-semibold text-white shadow hover:bg-sky-700"
              >
                + Agregar turno
              </button>

              <button
                disabled={!selected}
                onClick={() => setOpenNew(true)}
                className={cx(
                  "w-full rounded-xl px-3 py-2.5 text-sm font-semibold transition shadow",
                  "bg-gradient-to-r from-indigo-500 to-violet-500 text-white",
                  !selected && "opacity-50 cursor-not-allowed"
                )}
              >
                Editar / Posponer
              </button>

              <button
                disabled={!selected}
                onClick={eliminarTurno}
                className={cx(
                  "w-full rounded-xl px-3 py-2.5 text-sm font-semibold transition shadow",
                  "bg-gradient-to-r from-rose-600 to-red-500 text-white",
                  !selected && "opacity-50 cursor-not-allowed"
                )}
              >
                Cancelar
              </button>
            </div>

            <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
              <span>{selected ? "Turno seleccionado listo para acciones." : "Elegí un turno para ver acciones."}</span>
              <button
                onClick={() => fetchTurnosRange(rStart, rEnd)}
                className="underline underline-offset-2 hover:text-slate-700"
                title="Actualizar"
              >
                Actualizar
              </button>
            </div>

            {msg && (
              <div
                className={cx(
                  "mt-3 rounded-xl px-3 py-2 text-sm ring-1",
                  /(cerró|error|No se pudo|403|404|405|409|500)/i.test(msg)
                    ? "bg-red-50 text-red-700 ring-red-200"
                    : "bg-emerald-50 text-emerald-700 ring-emerald-200"
                )}
              >
                {msg}
              </div>
            )}
          </div>

          {/* Agenda de hoy */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-2 font-medium text-slate-700">
              Agenda de hoy · {format(new Date(), "EEEE d 'de' MMMM", { locale: es })}
            </div>

            <div className="max-h-72 overflow-auto pr-1">
              {eventos.filter((e) => {
                const d = new Date();
                const s = startOfDay(d);
                const ee = endOfDay(d);
                return e.start >= s && e.start <= ee;
              }).length === 0 ? (
                <div className="text-sm text-slate-500">No hay turnos para hoy.</div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {eventos
                    .filter((e) => {
                      const d = new Date();
                      const s = startOfDay(d);
                      const ee = endOfDay(d);
                      return e.start >= s && e.start <= ee;
                    })
                    .sort((a, b) => a.start - b.start)
                    .map((e) => (
                      <li
                        key={e.id}
                        className={cx(
                          "py-2 flex items-start gap-3",
                          selected?.id === e.id ? "bg-sky-50/60 rounded-lg px-2 -mx-2" : ""
                        )}
                      >
                        <div className="shrink-0">
                          <div className="h-8 w-12 rounded-md ring-1 ring-slate-200 grid place-items-center text-xs font-semibold text-slate-800">
                            {format(e.start, "HH:mm", { locale: es })}
                          </div>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-slate-900 truncate">
                            {e.cliente_nombre || "Cliente"} · {e.servicio || e.title}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {e.cliente_contacto ? `Contacto: ${e.cliente_contacto}` : ""}
                            {e.cliente_contacto && e.notas ? " · " : ""}
                            {e.notas ? `Notas: ${e.notas}` : ""}
                          </div>
                        </div>
                        <button
                          onClick={() => setSelected(e)}
                          title="Seleccionar para editar/cancelar"
                          className="shrink-0 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium hover:bg-slate-50"
                        >
                          Seleccionar
                        </button>
                      </li>
                    ))}
                </ul>
              )}
            </div>
          </div>
        </aside>
      </div>

      {/* Modal Crear/Editar */}
      <TurnoModal
        open={openNew}
        onClose={() => { setOpenNew(false); }}
        servicios={servicios}
        horarios={horarios}
        rawTurnos={rawTurnos}
        selected={selected}
        onCreate={crearTurno}
        onUpdate={editarTurno}
        inlineMsg={msg}
        busy={loading}
      />
    </div>
  );
}
