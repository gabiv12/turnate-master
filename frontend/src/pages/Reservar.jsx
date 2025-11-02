// src/pages/Reservar.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate, useLocation, Link } from "react-router-dom";
import { format, startOfDay, endOfDay, isSameDay, addMinutes } from "date-fns";
import es from "date-fns/locale/es";
import api from "../services/api";
import PublicCalendar from "../components/PublicCalendar";

const cx = (...c) => c.filter(Boolean).join(" ");
const looksLikeCode = (s) => /^[A-Z0-9]{4,12}$/.test(String(s).trim().toUpperCase());
const pad = (n) => String(n).padStart(2, "0");
const toNaive = (dt) => {
  const d = new Date(dt);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

function FullscreenStatus({ title, caption }) {
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-900/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200 p-6 text-center">
        <div className="mx-auto mb-4 h-14 w-14 grid place-items-center rounded-full bg-slate-100">
          <svg className="h-7 w-7 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" className="opacity-20" />
            <path d="M21 12a 9 9 0 0 1-9 9" stroke="currentColor" strokeWidth="2" className="opacity-80" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
        {caption && <p className="mt-1 text-sm text-slate-600">{caption}</p>}
      </div>
    </div>
  );
}

function msg(err, fallback = "Ocurrió un error") {
  const d = err?.response?.data;
  if (typeof d === "string") return d;
  if (d?.detail) return typeof d.detail === "string" ? d.detail : (d.detail[0]?.msg || fallback);
  return fallback;
}

// === Adaptadores “públicos” ===
async function fetchEmpByCode(c) {
  // 1) endpoint público
  try {
    const r = await api.get(`/publico/emprendedores/by-codigo/${c}`);
    return r.data;
  } catch {}
  // 2) fallback no-público
  try {
    const r = await api.get(`/emprendedores/by-codigo/${c}`);
    return r.data;
  } catch (e) {
    throw e;
  }
}

async function fetchServiciosPublicos(empId) {
  try {
    const r = await api.get(`/publico/servicios/${empId}`);
    return Array.isArray(r.data) ? r.data : [];
  } catch {}
  // fallbacks
  try {
    const r = await api.get(`/servicios/by-emprendedor/${empId}`);
    return Array.isArray(r.data) ? r.data : [];
  } catch {}
  try {
    const r = await api.get(`/servicios`, { params: { emprendedor_id: empId } });
    return Array.isArray(r.data) ? r.data : [];
  } catch {
    return [];
  }
}

async function fetchAgendaSlots(empId, desde, hasta) {
  // 1) verdadero endpoint público de agenda
  try {
    const r = await api.get(`/publico/agenda`, { params: { emprendedor_id: empId, desde, hasta } });
    return Array.isArray(r?.data?.slots) ? r.data.slots : [];
  } catch {}
  // 2) si no hay agenda pública, devolvemos [] y usamos fallback con horarios/turnos
  return [];
}

export default function Reservar() {
  const { code } = useParams();             // código público
  const navigate = useNavigate();
  const location = useLocation();

  // Estado de datos
  const [emp, setEmp] = useState(null);     // { id, nombre, descripcion, codigo_cliente, ...extras }
  const [servicios, setServicios] = useState([]);
  const [horarios, setHorarios] = useState([]); // (fallback si no hay agenda)
  const [turnos, setTurnos] = useState([]);     // (solo fallback)
  const [agendaSlots, setAgendaSlots] = useState([]); // ← slots ISO desde /publico/agenda

  // Selecciones
  const [fecha, setFecha] = useState(null);
  const [slot, setSlot] = useState(null);
  const [servicioId, setServicioId] = useState("");
  const [clienteNombre, setClienteNombre] = useState("");
  const [clienteContacto, setClienteContacto] = useState(""); // tel o email
  const [nota, setNota] = useState(""); // opcional (dirección u observación para el emprendedor)

  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const isAuth =
    !!(localStorage.getItem("accessToken") ||
       localStorage.getItem("token") ||
       localStorage.getItem("access_token"));

  // refs
  const lastCodeRef = useRef("");
  const searchingRef = useRef(false);
  const debounceRef = useRef(null);
  const stepInfoRef = useRef(null);
  const stepCalRef = useRef(null);
  const stepSlotsRef = useRef(null);
  const stepDatosRef = useRef(null);
  const stepConfirmRef = useRef(null);

  // Carga inicial por código público
  useEffect(() => {
    const run = async () => {
      const c = (code || "").toUpperCase().trim();
      if (!looksLikeCode(c)) {
        navigate("/ingresar-codigo", { replace: true, state: { from: location } });
        return;
      }
      if (searchingRef.current) return;
      searchingRef.current = true;

      // reset si cambió el código
      if (lastCodeRef.current !== c) {
        setEmp(null);
        setServicios([]);
        setHorarios([]);
        setTurnos([]);
        setAgendaSlots([]);
        setFecha(null);
        setSlot(null);
        setServicioId("");
        setClienteNombre("");
        setClienteContacto("");
        setNota("");
      }

      try {
        // Emprendedor por código
        const e = await fetchEmpByCode(c);
        setEmp(e);

        // Servicios públicos por emprendedor_id
        const empId = e?.id;
        const rs = await fetchServiciosPublicos(empId);
        setServicios(rs || []);

        // Agenda (si existe endpoint público; si no, el fallback usa horarios/turnos)
        const now = new Date();
        const desde = toNaive(startOfDay(new Date(now.getFullYear(), now.getMonth(), 1)));
        const hasta = toNaive(endOfDay(new Date(now.getFullYear(), now.getMonth() + 1, 0)));
        const ag = await fetchAgendaSlots(empId, desde, hasta);
        setAgendaSlots(ag || []);

        // Fallback data
        try {
          const rh = await api.get(`/publico/horarios/${empId}`);
          if (Array.isArray(rh.data)) setHorarios(rh.data);
        } catch {}
        try {
          const rt = await api.get(`/publico/turnos/${empId}`);
          if (Array.isArray(rt.data)) setTurnos(rt.data);
        } catch {}
      } catch (err) {
        console.error("by-codigo error:", err);
      } finally {
        searchingRef.current = false;
        lastCodeRef.current = c;
        queueMicrotask(() => stepInfoRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
      }
    };

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(run, 50);
    return () => clearTimeout(debounceRef.current);
  }, [code, navigate, location]);

  // Habilita día en calendario
  const isDayEnabled = (date) => {
    if (agendaSlots?.length) {
      const dayStr = format(date, "yyyy-MM-dd");
      return agendaSlots.some((s) => String(s).startsWith(dayStr));
    }
    const day = date.getDay(); // 0=Dom
    return horarios.some((h) => h.activo && Number(h.dia_semana) === day);
  };

  // slots del día
  const slots = useMemo(() => {
    if (!fecha) return [];
    if (agendaSlots?.length) {
      const dayStr = format(fecha, "yyyy-MM-dd");
      return agendaSlots.filter((s) => String(s).startsWith(dayStr)).map((s) => new Date(s));
    }

    // Fallback (si no hay /publico/agenda)
    if (!horarios?.length) return [];
    const day = fecha.getDay();

    const ocupados = (turnos || [])
      .filter((t) => isSameDay(new Date(t.inicio || t.desde || t.datetime), fecha))
      .map((t) => ({
        inicio: new Date(t.inicio || t.desde || t.datetime),
        fin: new Date(t.fin || addMinutes(new Date(t.inicio || t.datetime), 30)),
      }));

    const list = [];
    horarios
      .filter((h) => h.activo && Number(h.dia_semana) === day)
      .forEach((h) => {
        const [hhD, mmD] = String(h.hora_desde).split(":").map(Number);
        const [hhH, mmH] = String(h.hora_hasta).split(":").map(Number);
        const base = new Date(fecha);
        base.setHours(hhD, mmD, 0, 0);
        const end = new Date(fecha);
        end.setHours(hhH, mmH, 0, 0);
        const step = Number(h.intervalo_min || 30);

        for (let d = new Date(base); d < end; d = addMinutes(d, step)) {
          const fin = addMinutes(new Date(d), step);
          const choca = ocupados.some((o) => o.inicio < fin && o.fin > d);
          if (!choca) list.push(new Date(d));
        }
      });

    return list;
  }, [fecha, horarios, turnos, agendaSlots]);

  useEffect(() => {
    if (fecha && !slot) queueMicrotask(() => stepCalRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }));
  }, [fecha]);
  useEffect(() => {
    if (slot) queueMicrotask(() => stepSlotsRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }));
  }, [slot]);
  useEffect(() => {
    if (servicioId) queueMicrotask(() => stepDatosRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }));
  }, [servicioId]);

  // Crear reserva (requiere login; si no, envío a login)
  const onConfirm = () => {
    setConfirming(true);
    if (!isAuth) {
      setBusy(true);
      setTimeout(() => {
        navigate("/login", { replace: true, state: { from: location } });
      }, 650);
    }
    queueMicrotask(() => stepConfirmRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }));
  };

  // Reintentos con / sin nota si el backend no la acepta (evita 422)
  function stripNote(obj) {
    const copy = { ...obj };
    delete copy.nota;
    delete copy.notas;
    delete copy.note;
    return copy;
  }
  const detailMentionsNote = (e) => {
    const d = e?.response?.data;
    const text = typeof d?.detail === "string" ? d.detail : JSON.stringify(d?.detail || d || "");
    return /nota|notas|extra fields/i.test(text);
  };

  async function crearReservaAdaptativa(empId, bodyBase) {
    // Intentos con y sin nota según status 422
    const tries = [
      // Público directo (si existe)
      { ep: "/publico/turnos", body: { ...bodyBase } },
      { ep: "/publico/turnos", body: stripNote(bodyBase), onlyIfNote422: true },

      // Formato privado clásico
      { ep: "/turnos", body: { ...bodyBase } },
      { ep: "/turnos", body: stripNote(bodyBase), onlyIfNote422: true },

      // Compatibilidad con otras formas
      {
        ep: "/turnos",
        body: {
          servicio: bodyBase.servicio_id,
          desde: bodyBase.inicio,
          nombre_cliente: bodyBase.cliente_nombre,
          contacto_cliente: bodyBase.cliente_contacto,
          nota: bodyBase.notas,
          emprendedor_id: empId,
        },
      },
      {
        ep: "/turnos",
        body: stripNote({
          servicio: bodyBase.servicio_id,
          desde: bodyBase.inicio,
          nombre_cliente: bodyBase.cliente_nombre,
          contacto_cliente: bodyBase.cliente_contacto,
          nota: bodyBase.notas,
          emprendedor_id: empId,
        }),
        onlyIfNote422: true,
      },

      // Ultra-compat
      {
        ep: "/turnos/compat",
        body: {
          servicio_id: bodyBase.servicio_id,
          datetime: bodyBase.inicio,
          cliente_nombre: bodyBase.cliente_nombre,
          notas: bodyBase.notas,
          cliente_contacto: bodyBase.cliente_contacto,
          emprendedor_id: empId,
        },
      },
      {
        ep: "/turnos/compat",
        body: stripNote({
          servicio_id: bodyBase.servicio_id,
          datetime: bodyBase.inicio,
          cliente_nombre: bodyBase.cliente_nombre,
          notas: bodyBase.notas,
          cliente_contacto: bodyBase.cliente_contacto,
          emprendedor_id: empId,
        }),
        onlyIfNote422: true,
      },
    ];

    let last = null;
    for (const t of tries) {
      try {
        const r = await api.post(t.ep, t.body);
        return r;
      } catch (e) {
        last = e;
        const st = e?.response?.status;
        // si es 422 y la queja menciona nota, habilitamos los intentos "onlyIfNote422"
        if (st === 422 && detailMentionsNote(e)) {
          continue; // los siguientes con onlyIfNote422 seguirán corriendo
        }
        if (![400,401,403,404,405,409,422].includes(st)) throw e;
      }
    }
    throw last;
  }

  const crearReserva = async () => {
    if (!emp?.id || !servicioId || !slot || !clienteNombre || !clienteContacto) return;
    if (!isAuth) return; // ya se redirige en onConfirm

    try {
      setBusy(true);

      const base = {
        emprendedor_id: emp.id,
        servicio_id: Number(servicioId),
        inicio: toNaive(slot),                 // naive (sin Z)
        cliente_nombre: clienteNombre.trim(),
        cliente_contacto: clienteContacto.trim(),
        notas: (nota || "").trim(),           // opcional
      };

      await crearReservaAdaptativa(emp.id, base);

      // refrescar agenda del día del turno
      const desde = toNaive(startOfDay(slot));
      const hasta = toNaive(endOfDay(slot));
      const agenda = await fetchAgendaSlots(emp.id, desde, hasta);
      setAgendaSlots(agenda || []);

      alert("¡Reserva creada! El emprendedor recibió el aviso.");
      setServicioId("");
      setSlot(null);
      setClienteNombre("");
      setClienteContacto("");
      setNota("");
      setConfirming(false);
    } catch (err) {
      alert(msg(err, "No se pudo crear la reserva."));
    } finally {
      setBusy(false);
    }
  };

  // ========= UI (manteniendo tu estética) =========
  const shareURL = emp?.codigo_cliente
    ? `${window.location.origin}/reservar/${emp.codigo_cliente}`
    : "";

  return (
    <div className="pt-24">
      {busy && <FullscreenStatus title="Procesando…" caption="Por favor, esperá unos segundos." />}

      <div className="mx-auto w-full max-w-7xl px-4 lg:px-6 space-y-10">
        {/* Ficha del negocio */}
        <section
          ref={stepInfoRef}
          className="rounded-2xl border border-slate-200 bg-white p-6 md:p-8 shadow-sm"
        >
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                {emp?.nombre || "Negocio"}
              </h1>
              {emp?.descripcion ? (
                <p className="mt-1 max-w-3xl text-sm text-slate-600">{emp.descripcion}</p>
              ) : (
                <p className="mt-1 text-sm text-slate-500">
                  Ingresá día y horario para solicitar tu turno.
                </p>
              )}
              {/* Extras (solo si existen) */}
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                {emp?.direccion && (
                  <div className="text-slate-700">
                    <span className="font-semibold">Dirección: </span>
                    <span className="text-slate-600">{emp.direccion}</span>
                  </div>
                )}
                {emp?.telefono && (
                  <div className="text-slate-700">
                    <span className="font-semibold">Teléfono: </span>
                    <span className="text-slate-600">{emp.telefono}</span>
                  </div>
                )}
                {emp?.email_contacto && (
                  <div className="text-slate-700">
                    <span className="font-semibold">Email: </span>
                    <span className="text-slate-600">{emp.email_contacto}</span>
                  </div>
                )}
                {emp?.rubro && (
                  <div className="text-slate-700">
                    <span className="font-semibold">Rubro: </span>
                    <span className="text-slate-600">{emp.rubro}</span>
                  </div>
                )}
                {emp?.web && (
                  <div className="text-slate-700">
                    <span className="font-semibold">Web: </span>
                    <a className="text-sky-600 underline" href={emp.web} target="_blank" rel="noreferrer">
                      {emp.web}
                    </a>
                  </div>
                )}
                {emp?.redes && (
                  <div className="text-slate-700">
                    <span className="font-semibold">Redes: </span>
                    <span className="text-slate-600">{emp.redes}</span>
                  </div>
                )}
                {emp?.cuit && (
                  <div className="text-slate-700">
                    <span className="font-semibold">CUIT: </span>
                    <span className="text-slate-600">{emp.cuit}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Código público + link compartible */}
            <div className="shrink-0 w-full md:w-72 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-semibold text-slate-500">Código público</div>
              <div className="mt-1 flex gap-2">
                <input
                  readOnly
                  value={emp?.codigo_cliente || ""}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(emp?.codigo_cliente || "")}
                  className="rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold hover:bg-slate-100"
                >
                  Copiar
                </button>
              </div>

              {shareURL && (
                <div className="mt-3 text-xs">
                  <div className="text-slate-500 mb-1">Link para compartir</div>
                  <div className="flex gap-2">
                    <input
                      readOnly
                      value={shareURL}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => navigator.clipboard.writeText(shareURL)}
                      className="rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold hover:bg-slate-100"
                    >
                      Copiar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Paso 1: calendario */}
        <section ref={stepCalRef} className="rounded-2xl border border-slate-200 bg-white p-6 md:p-8 shadow-sm">
          <h2 className="text-xl md:text-2xl font-semibold text-slate-900">1) Elegí un día</h2>
          <p className="mt-1 text-sm text-slate-600">Mostramos los días con disponibilidad.</p>
          <div className="mt-4">
            <PublicCalendar
              selectedDate={fecha}
              onSelectDate={setFecha}
              isDayEnabled={isDayEnabled}
              initialMonth={new Date()}
              monthsAhead={1}
            />
          </div>
        </section>

        {/* Paso 2: turnos del día */}
        <section ref={stepSlotsRef} className="rounded-2xl border border-slate-200 bg-white p-6 md:p-8 shadow-sm">
          <h2 className="text-xl md:text-2xl font-semibold text-slate-900">2) Elegí un horario</h2>
          <p className="mt-1 text-sm text-slate-600">
            Los horarios disponibles se calculan automáticamente según la agenda del emprendedor.
          </p>

          {!fecha ? (
            <div className="mt-4 text-sm text-slate-500">Primero elegí un día.</div>
          ) : slots.length === 0 ? (
            <div className="mt-4 text-sm text-slate-500">No hay horarios para este día.</div>
          ) : (
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {slots.map((d, i) => {
                const sel = slot && d.getTime() === slot.getTime();
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setSlot(d)}
                    className={cx(
                      "rounded-xl border px-3 py-2 text-sm font-medium",
                      sel
                        ? "border-sky-600 bg-sky-50 text-sky-900"
                        : "border-slate-300 bg-white text-slate-800 hover:bg-slate-50"
                    )}
                  >
                    {format(d, "HH:mm", { locale: es })}
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* Paso 3: datos y servicio */}
        <section ref={stepDatosRef} className="rounded-2xl border border-slate-200 bg-white p-6 md:p-8 shadow-sm">
          <h2 className="text-xl md:text-2xl font-semibold text-slate-900">3) Tus datos</h2>
          <p className="mt-1 text-sm text-slate-600">
            Ingresá un contacto y elegí el servicio. <b>La nota es opcional</b> (por ejemplo una dirección o preferencia) y
            queda visible para el emprendedor.
          </p>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-700">Nombre</label>
              <input
                value={clienteNombre}
                onChange={(e) => setClienteNombre(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                placeholder="Cliente X"
              />
            </div>

            <div>
              <label className="block text-sm text-slate-700">Teléfono o email</label>
              <input
                value={clienteContacto}
                onChange={(e) => setClienteContacto(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                placeholder="cliente@example.com"
              />
            </div>

            <div>
              <label className="block text-sm text-slate-700">Servicio</label>
              <select
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                value={servicioId}
                onChange={(e) => setServicioId(e.target.value)}
              >
                <option value="">Elegí un servicio</option>
                {servicios.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nombre} ({Number(s.duracion_min || s.duracion || 30)} min)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm text-slate-700">Notas (opcional)</label>
              <input
                value={nota}
                onChange={(e) => setNota(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                placeholder="Ej.: dirección o preferencia"
              />
            </div>
          </div>
        </section>

        {/* Paso 4: confirmación */}
        <section ref={stepConfirmRef} className="rounded-2xl border border-slate-200 bg-white p-6 md:p-8 shadow-sm">
          <h2 className="text-xl md:text-2xl font-semibold text-slate-900">4) Confirmar</h2>
          <p className="mt-1 text-sm text-slate-600">
            {slot ? <>Vas a reservar el <b>{format(slot, "EEEE d 'de' MMMM", { locale: es })}</b> a las <b>{format(slot, "HH:mm")}</b>.</> : <>Elegí día y horario.</>}
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onConfirm}
              disabled={!slot || !servicioId || !clienteNombre || !clienteContacto}
              className="rounded-xl bg-sky-600 px-5 py-3 text-white text-sm font-semibold shadow hover:bg-sky-700 disabled:opacity-50"
            >
              Confirmar reserva
            </button>

            {!isAuth && (
              <span className="text-sm text-slate-600">
                Necesitás iniciar sesión para completar la reserva.{" "}
                <Link className="underline" to="/login" state={{ from: location }}>Ir al login</Link>
              </span>
            )}
          </div>

          {confirming && isAuth && (
            <div className="mt-4">
              <button
                type="button"
                onClick={crearReserva}
                className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold hover:bg-slate-50"
              >
                Crear reserva
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
