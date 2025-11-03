// src/pages/Turnos.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Calendario from "../components/Calendario.jsx";
import api from "../services/api";
import { useUser } from "../context/UserContext.jsx";
import { isEmprendedor as empCheck } from "../utils/roles";
import { format, startOfMonth, endOfMonth, startOfDay, endOfDay } from "date-fns";
import es from "date-fns/locale/es";
import {
  listarTurnosOwner,
  crearTurnoOwner,
  borrarTurno,
  actualizarTurnoOwner
} from "../services/turnos";

const cx = (...c) => c.filter(Boolean).join(" ");

// ===== Helpers =====
function friendly(err) {
  if (typeof err === "string") return err;
  const s = err?.response?.status;
  const d = err?.response?.data;
  if (s === 401) return "Tu sesión se cerró. Iniciá sesión.";
  if (s === 403) return "No autorizado.";
  if (s === 409) return (d?.detail || "Horario no disponible o fuera de bloque.");
  if (typeof d === "string") return d;
  if (d?.detail) return typeof d.detail === "string" ? d.detail : "Ocurrió un error.";
  return err?.message || "No disponible por el momento.";
}
const toDate = (v) => (v ? new Date(v) : null);
const iso = (d) => (d instanceof Date ? d.toISOString() : new Date(d).toISOString());
const toLocalNaive = (date) => {
  const d = new Date(date);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};
const sanitize = (s = "") => s.replace(/[<>]/g, "").trim();
const enabledWeekdaysFrom = (horarios = []) =>
  new Set(horarios.filter((h) => h?.activo !== false).map((h) => Number(h.dia_semana)));

// ===== Mapeo a eventos de Calendario =====
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
    // 🔹 NUEVO: pasamos contacto y estado para verlos en el modal y en agenda-hoy
    cliente_contacto: t?.cliente_contacto ?? t?.contacto ?? "",
    estado: t?.estado ?? "reservado",
    raw: t,
  };
}

// ===== Modal (detalle / crear / posponer) =====
function TurnoModal({ open, onClose, servicios, selected, onCreate, onUpdate, inlineMsg, busy }) {
  const isEdit = !!selected;

  const toLocalInput = (d) => {
    const x = new Date(d || Date.now());
    x.setSeconds(0, 0);
    const mins = x.getMinutes();
    x.setMinutes(mins - (mins % 5));
    const pad = (n) => String(n).padStart(2, "0");
    return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}T${pad(x.getHours())}:${pad(x.getMinutes())}`;
  };

  const defaultSvcId = isEdit ? selected?.servicio_id ?? "" : servicios?.[0]?.id ?? "";
  const [servicioId, setServicioId] = useState(defaultSvcId || "");
  const [dtLocal, setDtLocal] = useState(toLocalInput(isEdit ? selected?.start : new Date()));
  const [cliente, setCliente] = useState(isEdit ? (selected?.cliente_nombre || "") : "");
  const [notas, setNotas] = useState(isEdit ? (selected?.notas || "") : "");

  useEffect(() => {
    if (!open) return;
    const dId = isEdit ? selected?.servicio_id ?? "" : servicios?.[0]?.id ?? "";
    setServicioId(dId || "");
    setDtLocal(toLocalInput(isEdit ? selected?.start : new Date()));
    setCliente(isEdit ? (selected?.cliente_nombre || "") : "");
    setNotas(isEdit ? (selected?.notas || "") : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isEdit, selected?.id]);

  const duracionServicioMin = () => {
    const s = servicios.find((x) => Number(x.id) === Number(servicioId));
    return Number(s?.duracion_min ?? s?.duracion_minutos ?? s?.duracion ?? 30) || 30;
  };

  const valid = servicioId && dtLocal;

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-900/50 backdrop-blur-sm px-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200">
        <div className="border-b px-5 py-4">
          <h3 className="text-lg font-semibold text-slate-900">
            {isEdit ? "Detalle de turno" : "Nuevo turno"}
          </h3>
          {isEdit && (
            <p className="mt-1 text-xs text-slate-500">
              {selected?.cliente_nombre ? <>Cliente: <b>{selected.cliente_nombre}</b> · </> : null}
              Servicio: <b>{selected?.servicio || "Servicio"}</b>
            </p>
          )}
        </div>

        <div className="p-5 grid gap-4">
          <div>
            <label className="block text-xs font-semibold text-sky-700 mb-1">Servicio</label>
            <select
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 outline-none focus:ring-2 focus:ring-sky-300"
              value={servicioId}
              onChange={(e) => setServicioId(e.target.value)}
            >
              <option value="">Elegí un servicio</option>
              {servicios.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre} ({Number(s.duracion_min ?? s.duracion_minutos ?? 30)} min)
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-sky-700 mb-1">Fecha y hora</label>
              <input
                type="datetime-local"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 outline-none focus:ring-2 focus:ring-sky-300"
                value={dtLocal}
                onChange={(e) => setDtLocal(e.target.value)}
              />
            </div>
            <div className="text-xs text-slate-500 flex items-end pb-1">
              Duración: <span className="ml-1 font-semibold">{duracionServicioMin()} min</span>
            </div>
          </div>

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
            <label className="block text-xs font-semibold text-sky-700 mb-1">Notas (opcional)</label>
            <input
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 outline-none focus:ring-2 focus:ring-sky-300"
              value={notas}
              onChange={(e) => setNotas(sanitize(e.target.value))}
              placeholder="Dirección / referencia (se guarda y el emprendedor la ve)"
              maxLength={220}
            />
          </div>

          {/* 🔹 NUEVO: detalles informativos, sin inputs (no cambia UI principal) */}
          {isEdit && (
            <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200/70 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <div className="text-slate-500">Estado</div>
                  <div className="font-medium text-slate-900">{selected?.estado || "reservado"}</div>
                </div>
                <div>
                  <div className="text-slate-500">Contacto</div>
                  <div className="font-medium text-slate-900">{selected?.cliente_contacto || "—"}</div>
                </div>
              </div>
            </div>
          )}

          {/* Tips mini e intuitivos */}
          <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200/70 text-xs text-slate-600">
            • Elegí servicio y fecha/hora. • La duración sale del servicio. • Si choca con otro turno, probá 5–10 min después.
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 px-5 py-4 border-t">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold hover:bg-slate-50"
            disabled={busy}
          >
            Cerrar
          </button>

          <div className="flex items-center gap-2">
            {inlineMsg && (
              <span
                className={
                  "text-sm rounded-lg px-3 py-2 " +
                  (/(error|No se pudo|403|404|405|409|500)/i.test(inlineMsg)
                    ? "bg-red-50 text-red-700 ring-1 ring-red-200"
                    : "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200")
                }
              >
                {String(inlineMsg)}
              </span>
            )}

            {!isEdit ? (
              <button
                type="button"
                onClick={() => {
                  const dur = duracionServicioMin();
                  const start = new Date(dtLocal);
                  const end = new Date(start.getTime() + dur * 60000);
                  onCreate?.({
                    servicio_id: Number(servicioId),
                    inicio: start.toISOString(),
                    fin: end.toISOString(),
                    cliente_nombre: sanitize(cliente),
                    notas: sanitize(notas),
                  });
                }}
                className="rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-sky-700 disabled:opacity-60"
                disabled={busy || !valid}
              >
                Crear
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  const dur = duracionServicioMin();
                  const start = new Date(dtLocal);
                  const end = new Date(start.getTime() + dur * 60000);
                  onUpdate?.({
                    servicio_id: Number(servicioId),
                    inicio: start.toISOString(),
                    fin: end.toISOString(),
                    cliente_nombre: sanitize(cliente),
                    notas: sanitize(notas),
                  });
                }}
                className="rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-sky-700 disabled:opacity-60"
                disabled={busy || !valid}
                title="Guardar cambios / Posponer"
              >
                Guardar
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ===== Página =====
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

  const [ignoreBlocks, setIgnoreBlocks] = useState(false);

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

  // Catálogos
  useEffect(() => {
    (async () => {
      if (!isEmp) { setServicios([]); setHorarios([]); return; }
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

  // Remap si cambian servicios
  useEffect(() => {
    setEventos(rawTurnos.map((t) => mapTurnoParaCalendario(t, servicios)));
  }, [servicios, rawTurnos]);

  // ==== Listar
  async function listTurnos(start, end) {
    const arr = await listarTurnosOwner({ desde: iso(start), hasta: iso(end) });
    return arr.map((t) => mapTurnoParaCalendario(t, servicios));
  }

  async function fetchTurnosRange(start, end) {
    try {
      setLoading(true); setMsg("");
      const evs = await listTurnos(start, end);
      setRawTurnos(evs.map((e) => e.raw || {
        id: e.id, inicio: e.start?.toISOString(), fin: e.end?.toISOString(), servicio_id: e.servicio_id
      }));
      setEventos(evs);
    } catch (e) {
      setRawTurnos([]); setEventos([]); setMsg(friendly(e));
    } finally {
      setLoading(false);
      setTimeout(() => setMsg(""), 2500);
    }
  }

  // ==== CRUD
  const crearTurno = async (payload) => {
    try {
      setLoading(true); setMsg("Creando turno…");
      try {
        await crearTurnoOwner(payload); // ISO
      } catch {
        await crearTurnoOwner({ ...payload, inicio: toLocalNaive(payload.inicio), fin: toLocalNaive(payload.fin) });
      }
      setMsg("Turno creado.");
      await fetchTurnosRange(rStart, rEnd);
      setOpenNew(false); setSelected(null);
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
      setLoading(true); setMsg("Guardando cambios…");
      try {
        await actualizarTurnoOwner(selected.id, payload);
      } catch {
        await actualizarTurnoOwner(selected.id, {
            ...payload,
            inicio: toLocalNaive(payload.inicio),
            fin: toLocalNaive(payload.fin),
        });
      }
      setMsg("Turno actualizado.");
      await fetchTurnosRange(rStart, rEnd);
      setOpenNew(false); setSelected(null);
    } catch (e) {
      setMsg(friendly(e));
    } finally {
      setLoading(false);
      setTimeout(() => setMsg(""), 2600);
    }
  };

  const eliminarTurno = async () => {
    if (!selected?.id) return;
    if (!confirm("¿Eliminar el turno seleccionado?")) return;
    try {
      setLoading(true); setMsg("Eliminando turno…");
      await borrarTurno(selected.id);
      await fetchTurnosRange(rStart, rEnd);
      setSelected(null);
      setMsg("Turno cancelado.");
    } catch (e) {
      setMsg(friendly(e));
    } finally {
      setLoading(false);
      setTimeout(() => setMsg(""), 2600);
    }
  };

  // ==== Calendario
  const enabledWeekdays = useMemo(() => enabledWeekdaysFrom(horarios), [horarios]);

  const dayPropGetter = (date) => {
    const wd = date.getDay();
    const allowed = enabledWeekdays.has(wd);
    return allowed || ignoreBlocks
      ? {}
      : { style: { backgroundColor: "#f3f4f6", color: "#9ca3af", cursor: "not-allowed" } };
  };

  const handleRangeRequest = async (start, end) => {
    setRStart(start); setREnd(end);
    await fetchTurnosRange(start, end);
  };

  const onSelectEvent = (evt) => { setSelected(evt); setOpenNew(true); };

  // Tu componente Calendario a veces no pasa el slot/start; abrimos modal vacío y elige fecha/hora ahí.
  const onSelectSlot = () => { setSelected(null); setOpenNew(true); };

  // ===== Render no-emprendedor
  if (!isEmp) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm text-slate-700">
              Para reservar, ingresá el <b>código</b> del emprendimiento.
            </div>
            <button onClick={() => navigate("/reservar")} className="rounded-xl bg-sky-600 text-white px-4 py-2.5 text-sm font-semibold">
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

  // ===== Render emprendedor
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="-mx-4 lg:-mx-6 overflow-x-clip">
        <div className="rounded-3xl bg-gradient-to-r from-blue-600 to-cyan-400 p-5 md:p-6 text-white shadow">
          <div className="mx-auto max-w-7xl px-4 lg:px-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Gestión de Turnos</h1>
                <p className="text-sm md:text-base/relaxed opacity-90">Organizá tus servicios, horarios y turnos.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Link to="/servicios" className="inline-flex items-center gap-2 rounded-xl bg-white text-sky-700 px-4 py-2 text-sm font-semibold ring-1 ring-white/70 shadow hover:brightness-95">
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7">
                    <path d="M12 3l8 4-8 4-8-4 8-4Z"/><path d="M4 12l8 4 8-4"/><path d="M4 17l8 4 8-4"/>
                  </svg>
                  <span>Servicios</span>
                </Link>
                <Link to="/horarios" className="inline-flex items-center gap-2 rounded-xl bg-white text-sky-700 px-4 py-2 text-sm font-semibold ring-1 ring-white/70 shadow hover:brightness-95">
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7">
                    <circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>
                  </svg>
                  <span>Horarios</span>
                </Link>
                <button onClick={() => { setSelected(null); setOpenNew(true); }}
                  className="rounded-xl bg-white text-sky-700 px-4 py-2 text-sm font-semibold shadow hover:brightness-95">
                  + Agregar turno
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Grid principal */}
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-4 items-start">
        <div className="min-w-0">
          <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            
            

            <Calendario
              turnos={eventos}
              onSelectEvent={(e) => { setSelected(e); setOpenNew(true); }}
              onSelectSlot={onSelectSlot}
              defaultView="month"
              height={760}
              dayPropGetter={dayPropGetter}
              onRangeRequest={handleRangeRequest}
            />
          </div>
        </div>

        <aside className="space-y-4 w-full xl:w-[340px] self-start xl:top-[96px] xl:sticky">
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-slate-200 bg-white p-3 text-center">
              <div className="text-xs text-slate-500">Servicios</div>
              <div className="text-xl font-semibold">{servicios.length}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-3 text-center">
              <div className="text-xs text-slate-500">Turnos hoy</div>
              <div className="text-xl font-semibold">
                {eventos.filter((e) => {
                  const d = new Date(); const s = startOfDay(d); const ee = endOfDay(d);
                  return e.start >= s && e.start <= ee;
                }).length}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-3 text-center">
              <div className="text-xs text-slate-500">Turnos periodo</div>
              <div className="text-xl font-semibold">{eventos.length}</div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-2 font-medium text-slate-700">Acciones de turnos</div>
            <ul className="mb-3 text-xs text-slate-600 space-y-1.5">
              <li>• <b>Agregar</b>: seleccioná un bloque o usá “+ Agregar turno”.</li>
              <li>• <b>Editar / Posponer</b>: clic en un turno → “Guardar”.</li>
              <li>• <b>Cancelar</b>: seleccioná un turno y tocá “Cancelar”.</li>
            </ul>

            <div className="grid grid-cols-1 gap-2">
              <button onClick={() => { setSelected(null); setOpenNew(true); }}
                className="w-full rounded-xl bg-sky-600 px-3 py-2.5 text-sm font-semibold text-white shadow hover:bg-sky-700">
                + Agregar turno
              </button>

              <button disabled={!selected} onClick={() => setOpenNew(true)}
                className={cx("w-full rounded-xl px-3 py-2.5 text-sm font-semibold transition shadow",
                  "bg-gradient-to-r from-indigo-500 to-violet-500 text-white",
                  !selected && "opacity-50 cursor-not-allowed")}>
                Editar / Posponer
              </button>

              <button disabled={!selected} onClick={async () => await eliminarTurno()}
                className={cx("w-full rounded-xl px-3 py-2.5 text-sm font-semibold transition shadow",
                  "bg-gradient-to-r from-rose-600 to-red-500 text-white",
                  !selected && "opacity-50 cursor-not-allowed")}>
                Cancelar
              </button>
            </div>

            <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
              <span>{selected ? "Turno seleccionado listo para acciones." : "Elegí un turno del calendario para ver acciones."}</span>
              <button onClick={() => fetchTurnosRange(rStart, rEnd)} className="underline underline-offset-2 hover:text-slate-700" title="Actualizar">
                Actualizar
              </button>
            </div>

            {msg && (
              <div
                className={`mt-3 rounded-xl px-3 py-2 text-sm ${
                  /cerró|error|No se pudo|403|404|405|409|500/i.test(msg)
                    ? "bg-red-50 text-red-700 ring-1 ring-red-200"
                    : "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                }`}
              >
                {msg}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-2 font-medium text-slate-700">
              Agenda de hoy · {format(new Date(), "EEEE d 'de' MMMM", { locale: es })}
            </div>
            {eventos.filter((e) => {
              const d = new Date(); const s = startOfDay(d); const ee = endOfDay(d);
              return e.start >= s && e.start <= ee;
            }).length === 0 ? (
              <div className="text-sm text-slate-500">No hay turnos para hoy.</div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {eventos
                  .filter((e) => { const d = new Date(); const s = startOfDay(d); const ee = endOfDay(d); return e.start >= s && e.start <= ee; })
                  .sort((a, b) => a.start - b.start)
                  .map((e) => (
                    <li key={e.id} className="py-2">
                      <div className="font-medium">
                        {format(e.start, "HH:mm", { locale: es })} · {e.cliente_nombre || "Cliente"} · {e.servicio || e.title}
                      </div>
                      {e.cliente_contacto && <div className="text-slate-500 text-xs mt-0.5">Contacto: {e.cliente_contacto}</div>}
                      {e.notas && <div className="text-slate-500 text-xs mt-0.5">Notas: {e.notas}</div>}
                    </li>
                ))}
              </ul>
            )}

            {/* Sugerencias simples e intuitivas */}
            <div className="mt-3 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200/70">
              <div className="text-xs font-semibold text-slate-700 mb-1">Sugerencias</div>
              <ul className="text-xs text-slate-600 space-y-1.5">
                 <li>
      Primero cargá tus <strong>Horarios</strong>. Los días sin horario quedan grises y no se pueden reservar.
    </li>
    <li>
      La <strong>duración</strong> de cada turno se toma del <strong>Servicio</strong> que elijas.
    </li>

              </ul>
            </div>
          </div>
        </aside>
      </div>

      {/* Modal */}
      <TurnoModal
        open={openNew}
        onClose={() => { setOpenNew(false); setSelected(null); }}
        servicios={servicios}
        selected={selected}
        onCreate={crearTurno}
        onUpdate={editarTurno}
        inlineMsg={msg}
        busy={loading}
      />
    </div>
  );
}
