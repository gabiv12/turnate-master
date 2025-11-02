// src/pages/Turnos.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Calendario from "../components/Calendario.jsx";
import api from "../services/api";
import { useUser } from "../context/UserContext.jsx";
import { isEmprendedor as empCheck } from "../utils/roles";
import { format, startOfMonth, endOfMonth, startOfDay, endOfDay } from "date-fns";
import es from "date-fns/locale/es";

const cx = (...c) => c.filter(Boolean).join(" ");

// =============== Helpers ===============
function friendly(err) {
  const s = err?.response?.status;
  if (s === 401) return "Tu sesión se cerró. Iniciá sesión.";
  if (s === 403) return "No autorizado.";
  const d = err?.response?.data;
  if (typeof d === "string") return d;
  if (d?.detail) return typeof d.detail === "string" ? d.detail : "Ocurrió un error.";
  return err?.message || "No disponible por el momento.";
}
const toDate = (v) => (v ? new Date(v) : null);
const iso = (d) => (d instanceof Date ? d.toISOString() : new Date(d).toISOString());
const toLocalNaive = (date) => {
  const d = new Date(date);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}:${pad(d.getSeconds())}`;
};

// =============== Descubrimiento de rutas ===============
function replacePathParams(path, params = {}) {
  if (!path) return path;
  let out = path;
  Object.entries(params).forEach(([k, v]) => {
    out = out.replace(new RegExp(`{${k}}`, "g"), String(v));
  });
  return out;
}
async function discoverTurnoPaths() {
  try {
    const { data } = await api.get("/openapi.json");
    const paths = data?.paths || {};
    const entries = Object.entries(paths);
    const kws = ["turno", "turnos", "reserva", "reservas"];
    const hasKW = (p) => kws.some((k) => p.toLowerCase().includes(k));

    const pick = (arr) =>
      [
        ...arr.filter(([p, _]) => /emprendedores\/{.*id.*}\/turnos\b/i.test(p)),
        ...arr.filter(([p, _]) => /\/turnos\/?\b/i.test(p)),
        ...arr.filter(([p, _]) => /\/reservas\/?\b/i.test(p)),
        ...arr.filter(([p, _]) => /\/mis\b/i.test(p) || /mis-?turnos/i.test(p)),
        ...arr,
      ]
        .map(([p]) => p)
        .filter((v, i, a) => a.indexOf(v) === i)[0] || null;

    const list = pick(entries.filter(([p, def]) => def?.get && hasKW(p)));
    const create = pick(entries.filter(([p, def]) => def?.post && hasKW(p)));
    const upd = pick(entries.filter(([p, def]) => (def?.put || def?.patch) && hasKW(p)));
    const del = pick(entries.filter(([p, def]) => def?.delete && hasKW(p)));

    const updMethod = paths[upd]?.put ? "put" : paths[upd]?.patch ? "patch" : "put";
    return { list, create, upd, updMethod, del };
  } catch {
    return { list: null, create: null, upd: null, updMethod: "put", del: null };
  }
}

// =============== Adaptadores ===============
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
    raw: t,
  };
}

// =============== Modales ===============
function TurnoModal({ open, onClose, servicios, selected, onCreate, onUpdate }) {
  const isEdit = !!selected;

  const toLocalInput = (d) => {
    const x = new Date(d || Date.now());
    x.setSeconds(0, 0);
    const mins = x.getMinutes();
    x.setMinutes(mins - (mins % 5));
    const pad = (n) => String(n).padStart(2, "0");
    return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}T${pad(x.getHours())}:${pad(
      x.getMinutes()
    )}`;
  };

  const defaultSvcId = isEdit ? selected?.servicio_id ?? "" : servicios?.[0]?.id ?? "";
  const [servicioId, setServicioId] = useState(defaultSvcId || "");
  const [dtLocal, setDtLocal] = useState(toLocalInput(isEdit ? selected?.start : new Date()));
  const [cliente, setCliente] = useState(isEdit ? selected?.cliente_nombre || "" : "");
  const [notas, setNotas] = useState(isEdit ? selected?.notas || "" : "");

  useEffect(() => {
    if (!open) return;
    const dId = isEdit ? selected?.servicio_id ?? "" : servicios?.[0]?.id ?? "";
    setServicioId(dId || "");
    setDtLocal(toLocalInput(isEdit ? selected?.start : new Date()));
    setCliente(isEdit ? selected?.cliente_nombre || "" : "");
    setNotas(isEdit ? selected?.notas || "" : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isEdit, selected?.id]);

  const duracionServicioMin = () => {
    const s = servicios.find((x) => Number(x.id) === Number(servicioId));
    return Number(s?.duracion_min ?? s?.duracion_minutos ?? s?.duracion ?? 30) || 30;
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-900/50 backdrop-blur-sm px-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200">
        <div className="border-b px-5 py-4">
          <h3 className="text-lg font-semibold text-slate-900">{isEdit ? "Editar turno" : "Nuevo turno"}</h3>
        </div>

        <div className="p-5 grid gap-4">
          <div>
            <label className="block text-xs font-semibold text-sky-700 mb-1">Servicio</label>
            <select className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 outline-none focus:ring-2 focus:ring-sky-300"
              value={servicioId} onChange={(e) => setServicioId(e.target.value)}>
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
              onChange={(e) => setCliente(e.target.value)}
              placeholder="Cliente X"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-sky-700 mb-1">Notas (opcional)</label>
            <input
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 outline-none focus:ring-2 focus:ring-sky-300"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Dirección / referencia, etc."
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t">
          <button type="button" onClick={onClose}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold hover:bg-slate-50">
            Cancelar
          </button>

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
                  cliente_nombre: (cliente || "").trim(),
                  notas: (notas || "").trim(),
                });
              }}
              className="rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-sky-700"
              disabled={!servicioId || !dtLocal}
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
                  cliente_nombre: (cliente || "").trim(),
                  notas: (notas || "").trim(),
                });
              }}
              className="rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-sky-700"
              disabled={!servicioId || !dtLocal}
            >
              Guardar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// =============== Página ===============
export default function Turnos() {
  const navigate = useNavigate();
  const { user } = useUser();
  const isEmp = empCheck(user);

  const [servicios, setServicios] = useState([]);
  const [horarios, setHorarios] = useState([]);

  const [eventos, setEventos] = useState([]);
  const [rawTurnos, setRawTurnos] = useState([]);

  const [paths, setPaths] = useState({ list: null, create: null, upd: null, updMethod: "put", del: null });

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

  // Catálogos
  useEffect(() => {
    (async () => {
      if (!isEmp) {
        setServicios([]); setHorarios([]); return;
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

  // Descubrir rutas + primera carga
  const firstRef = useRef(false);
  useEffect(() => {
    (async () => {
      if (firstRef.current) return;
      firstRef.current = true;
      try {
        setPaths(await discoverTurnoPaths());
      } catch {}
      await fetchTurnosRange(rStart, rEnd);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Remap si cambian servicios
  useEffect(() => {
    setEventos(rawTurnos.map((t) => mapTurnoParaCalendario(t, servicios)));
  }, [servicios, rawTurnos]);

  // ==== Lister tolerante
  async function listTurnos(start, end, empId = null) {
    // 1) OpenAPI (si existe)
    if (paths.list) {
      const p = replacePathParams(paths.list, { id: empId, emprendedor_id: empId });
      try {
        const r = await api.get(p, { params: { desde: iso(start), hasta: iso(end) } });
        const arr = Array.isArray(r.data?.items) ? r.data.items : Array.isArray(r.data) ? r.data : [];
        return arr.map((t) => mapTurnoParaCalendario(t, servicios));
      } catch {}
    }
    // 2) Fallbacks
    const tries = [
      () => api.get("/turnos/mis", { params: { desde: iso(start), hasta: iso(end) } }),
      () => api.get("/turnos", { params: { desde: iso(start), hasta: iso(end), mine: true } }),
      () => api.get(`/emprendedores/${empId || 0}/turnos`, { params: { desde: iso(start), hasta: iso(end) } }),
      () => api.get("/reservas/mis", { params: { desde: iso(start), hasta: iso(end) } }),
    ];
    for (const fn of tries) {
      try {
        const r = await fn();
        const arr = Array.isArray(r.data?.items) ? r.data.items : Array.isArray(r.data) ? r.data : [];
        return arr.map((t) => mapTurnoParaCalendario(t, servicios));
      } catch {}
    }
    return [];
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

  // ==== CRUD tolerante
  async function createTurno(payload) {
    const bodyStd = {
      servicio_id: Number(payload.servicio_id),
      inicio: payload.inicio,
      fin: payload.fin,
      cliente_nombre: payload.cliente_nombre || undefined,
      notas: payload.notas || undefined,
    };
    const empId = null; // si luego necesitas, podés traer /usuarios/me/emprendedor
    // 1) OpenAPI
    if (paths.create) {
      const p = replacePathParams(paths.create, { id: empId, emprendedor_id: empId });
      try { await api.post(p, bodyStd); return; } catch {}
    }
    // 2) Fallbacks + variantes de payload
    const tries = [
      () => api.post("/turnos", bodyStd),
      () => api.post("/turnos", { ...bodyStd, datetime: bodyStd.inicio, fin: undefined }),
      () => api.post("/turnos", { ...bodyStd, desde: bodyStd.inicio, hasta: bodyStd.fin }),
      () => api.post(`/emprendedores/${empId || 0}/turnos`, bodyStd),
      () => api.post("/reservas", { ...bodyStd }),
    ];
    for (const fn of tries) { try { await fn(); return; } catch {} }
    throw new Error("No se pudo crear el turno.");
  }

  async function updateTurno(id, payload) {
    const bodyStd = {
      servicio_id: Number(payload.servicio_id),
      inicio: payload.inicio,
      fin: payload.fin,
      cliente_nombre: payload.cliente_nombre || undefined,
      notas: payload.notas || undefined,
    };
    const empId = null;

    if (paths.upd) {
      const p = replacePathParams(paths.upd, { id, turno_id: id, emprendedor_id: empId });
      try { return paths.updMethod === "patch" ? await api.patch(p, bodyStd) : await api.put(p, bodyStd); } catch {}
    }
    const tries = [
      () => api.patch(`/turnos/${id}`, bodyStd),
      () => api.put(`/turnos/${id}`, bodyStd),
      () => api.patch(`/turnos/${id}`, { ...bodyStd, datetime: bodyStd.inicio, fin: undefined }),
      () => api.patch(`/turnos/${id}`, { ...bodyStd, desde: bodyStd.inicio, hasta: bodyStd.fin }),
      () => api.patch(`/emprendedores/${empId || 0}/turnos/${id}`, bodyStd),
    ];
    for (const fn of tries) { try { await fn(); return; } catch {} }
    throw new Error("No se pudo actualizar el turno.");
  }

  async function deleteTurno(id) {
    const empId = null;
    if (paths.del) {
      const p = replacePathParams(paths.del, { id, turno_id: id, emprendedor_id: empId });
      try { await api.delete(p); return; } catch {}
    }
    const tries = [
      () => api.delete(`/turnos/${id}`),
      () => api.delete(`/emprendedores/${empId || 0}/turnos/${id}`),
    ];
    for (const fn of tries) { try { await fn(); return; } catch {} }
    throw new Error("No se pudo eliminar el turno.");
  }

  // ===== Calendario handlers
  const handleRangeRequest = async (start, end) => {
    setRStart(start); setREnd(end);
    await fetchTurnosRange(start, end);
  };
  const onSelectEvent = (evt) => { setSelected(evt); setOpenNew(true); };
  const onSelectSlot = () => { setSelected(null); setOpenNew(true); };

  // ===== Días hábiles (gris en no activos)
  const enabledWeekdays = useMemo(() => {
    const set = new Set(
      (horarios || []).filter((h) => h.activo !== false).map((h) => Number(h.dia_semana))
    );
    return set;
  }, [horarios]);
  const dayPropGetter = (date) => {
    const wd = date.getDay();
    if (!enabledWeekdays.has(wd)) {
      return { style: { backgroundColor: "#f3f4f6", color: "#9ca3af" } };
    }
    return {};
  };

  // ===== Acciones botón modal
  const crearTurno = async (payload) => {
    try {
      setLoading(true); setMsg("");
      // convertir a formato local (por si el backend lo espera así)
      const inicioISO = payload.inicio;
      const finISO = payload.fin;
      try {
        await createTurno({ ...payload, inicio: inicioISO, fin: finISO });
      } catch (e1) {
        // reintento con naive local
        await createTurno({
          ...payload,
          inicio: toLocalNaive(inicioISO),
          fin: toLocalNaive(finISO),
        });
      }
      await fetchTurnosRange(rStart, rEnd);
      setOpenNew(false); setSelected(null);
    } catch (e) {
      setMsg(friendly(e));
    } finally {
      setLoading(false);
      setTimeout(() => setMsg(""), 2600);
    }
  };

  const editarTurno = async (payload) => {
    if (!selected?.id) return;
    try {
      setLoading(true); setMsg("");
      const inicioISO = payload.inicio;
      const finISO = payload.fin;
      try {
        await updateTurno(selected.id, { ...payload, inicio: inicioISO, fin: finISO });
      } catch {
        await updateTurno(selected.id, { ...payload, inicio: toLocalNaive(inicioISO), fin: toLocalNaive(finISO) });
      }
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
      setLoading(true); setMsg("");
      await deleteTurno(selected.id);
      await fetchTurnosRange(rStart, rEnd);
      setSelected(null);
    } catch (e) {
      setMsg(friendly(e));
    } finally {
      setLoading(false);
      setTimeout(() => setMsg(""), 2600);
    }
  };

  // ===== Agenda de hoy
  const agendaDeHoy = useMemo(() => {
    const d = new Date();
    const s = startOfDay(d);
    const e = endOfDay(d);
    return eventos.filter((ev) => ev.start >= s && ev.start <= e).sort((a, b) => a.start - b.start);
  }, [eventos]);

  // ===== Render
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
            <ul className="mb-3 text-xs text-slate-500 space-y-1.5">
              <li>• Para <b>agregar</b>, seleccioná un bloque en el calendario o usá el botón.</li>
              <li>• Para <b>editar</b> o <b>posponer</b>, hacé click en un turno y luego “Guardar”.</li>
              <li>• Para <b>cancelar</b>, seleccioná un turno y tocá “Cancelar”.</li>
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
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-2 font-medium text-slate-700">
              Agenda de hoy · {format(new Date(), "EEEE d 'de' MMMM", { locale: es })}
            </div>
            {agendaDeHoy.length === 0 ? (
              <div className="text-sm text-slate-500">No hay turnos para hoy.</div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {agendaDeHoy.map((e) => (
                  <li key={e.id} className="py-2">
                    <div className="font-medium">
                      {format(e.start, "HH:mm", { locale: es })} · {e.cliente_nombre || "Cliente"} · {e.servicio || e.title}
                    </div>
                    {e.notas && <div className="text-slate-500 text-xs mt-0.5">Notas: {e.notas}</div>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>

      {msg && (
        <div
          className={`rounded-xl px-4 py-2 text-sm ${
            /cerró|error|No se pudo|403|404|405|500/i.test(msg)
              ? "bg-red-50 text-red-700 ring-1 ring-red-200"
              : "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
          }`}
        >
          {msg}
        </div>
      )}

      <TurnoModal
        open={openNew}
        onClose={() => { setOpenNew(false); setSelected(null); }}
        servicios={servicios}
        selected={selected}
        onCreate={crearTurno}
        onUpdate={editarTurno}
      />
    </div>
  );
}
