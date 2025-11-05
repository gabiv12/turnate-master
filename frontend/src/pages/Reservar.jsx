// src/pages/Reservar.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate, useLocation, Link } from "react-router-dom";
import { addMinutes, endOfDay, format, isSameDay, startOfDay } from "date-fns";
import es from "date-fns/locale/es";
import api from "../services/api";
import PublicCalendar from "../components/PublicCalendar";
import { useUser } from "../context/UserContext.jsx";

/* ================= Helpers ================= */
const cx = (...c) => c.filter(Boolean).join(" ");
const pad = (n) => String(n).padStart(2, "0");
const toNaive = (dt) => {
  const d = new Date(dt);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
};
const sanitize = (s) =>
  String(s || "")
    .replace(/[<>{}[\]|\\^~`$]/g, "")
    .slice(0, 240);
const looksLikeCode = (s) => /^[A-Z0-9]{4,12}$/.test(String(s).trim().toUpperCase());
const asArr = (x) => (Array.isArray(x) ? x : Array.isArray(x?.items) ? x.items : x ? [x] : []);
const msgFrom = (e, fb = "Ocurrió un error") => {
  const d = e?.response?.data;
  if (typeof d === "string") return d;
  if (d?.detail) return typeof d.detail === "string" ? d.detail : (d.detail[0]?.msg || fb);
  return fb;
};

/* ===== Normalizadores robustos ===== */
const normServicio = (s) => ({
  id: s?.id,
  nombre: s?.nombre ?? "Servicio",
  duracion_min: Number(s?.duracion_min ?? 30) || 30,
});

const cutHHMM = (t) => String(t || "").slice(0, 5);
const normHorario = (h) => ({
  dia_semana: Number(h?.dia_semana ?? 0),
  hora_desde: cutHHMM(h?.hora_desde ?? h?.inicio ?? "08:00"),
  hora_hasta: cutHHMM(h?.hora_hasta ?? h?.fin ?? "18:00"),
  intervalo_min: Number(h?.intervalo_min ?? 30) || 30,
});

const normTurno = (t) => (t?.inicio && t?.fin ? { inicio: new Date(t.inicio), fin: new Date(t.fin) } : null);

/* ===== API ===== */
async function apiEmpByCode(codigo) {
  const { data } = await api.get(`/publico/emprendedores/by-codigo/${codigo}`);
  return data;
}
async function apiServiciosByCode(codigo) {
  const { data } = await api.get(`/publico/servicios/${codigo}`);
  return asArr(data).map(normServicio);
}
async function apiHorarios(empId) {
  const { data } = await api.get(`/publico/horarios/${empId}`);
  return asArr(data).map(normHorario);
}
async function apiTurnos(empId, { desde, hasta }) {
  const { data } = await api.get(`/publico/turnos/${empId}`, { params: { desde, hasta } });
  return asArr(data);
}

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

export default function Reservar() {
  const { codigo } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useUser();

  const [emp, setEmp] = useState(null);
  const [servicios, setServicios] = useState([]);
  const [horarios, setHorarios] = useState([]);
  const [turnos, setTurnos] = useState([]);

  // Paso 1: día
  const [fecha, setFecha] = useState(null);
  // Paso 2: servicio
  const [servicioId, setServicioId] = useState("");
  // Paso 3: horario
  const [slot, setSlot] = useState(null);

  // Único campo opcional
  const [nota, setNota] = useState("");

  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const isAuth =
    !!(localStorage.getItem("accessToken") ||
       localStorage.getItem("token") ||
       localStorage.getItem("access_token"));

  const refTop = useRef(null);
  const refPaso2 = useRef(null);
  const refPaso3 = useRef(null);
  const refPaso4 = useRef(null);

  /* ===== Carga inicial ===== */
  useEffect(() => {
    (async () => {
      const code = (codigo || "").trim().toUpperCase();
      if (!looksLikeCode(code)) { navigate("/reservar", { replace: true }); return; }
      try {
        setBusy(true);
        const e = await apiEmpByCode(code); setEmp(e);
        const svcs = await apiServiciosByCode(code); setServicios(svcs);
        const hs = await apiHorarios(e.id); setHorarios(hs);

        const now = new Date();
        const desde = toNaive(startOfDay(new Date(now.getFullYear(), now.getMonth(), 1)));
        const hasta = toNaive(endOfDay(new Date(now.getFullYear(), now.getMonth() + 1, 0)));
        const tv = await apiTurnos(e.id, { desde, hasta }); setTurnos(tv);
      } catch (err) {
        alert(msgFrom(err, "No se pudo cargar el emprendimiento."));
        navigate("/reservar", { replace: true });
      } finally {
        setBusy(false);
        refTop.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codigo]);

  /* ===== Días habilitados ===== */
  const noHayHorarios = (horarios?.length || 0) === 0;
  const isDayEnabled = (date) => {
    if (noHayHorarios) return true;
    const day = date.getDay(); // 0=Dom .. 6=Sáb
    return horarios.some((h) => (h.activo !== false) && Number(h.dia_semana) === day);
  };

  /* ===== Ocupados del día ===== */
  const ocupadosDelDia = useMemo(() => {
    if (!fecha) return [];
    return asArr(turnos).map(normTurno).filter(Boolean).filter((t) => isSameDay(t.inicio, fecha));
  }, [fecha, turnos]);

  /* ===== Servicio seleccionado ===== */
  const servicioSel = useMemo(
    () => (servicios || []).find((s) => String(s.id) === String(servicioId)) || null,
    [servicioId, servicios]
  );

  /* ===== Slots (requiere fecha + servicio, evita solapamientos) ===== */
  const slots = useMemo(() => {
    if (!fecha || !servicioSel) return [];

    const day = fecha.getDay();
    const bloques = noHayHorarios
      ? [{ dia_semana: day, hora_desde: "08:00", hora_hasta: "18:00", intervalo_min: 30, activo: true }]
      : (horarios || []).filter((h) => (h.activo !== false) && Number(h.dia_semana) === day);

    const dur = Number(servicioSel.duracion_min || 30) || 30;
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
  }, [fecha, horarios, noHayHorarios, servicioSel, ocupadosDelDia]);

  /* ===== Scroll por pasos ===== */
  useEffect(() => { if (fecha) { setSlot(null); refPaso2.current?.scrollIntoView({ behavior: "smooth" }); } }, [fecha]);
  useEffect(() => { if (servicioId) { setSlot(null); refPaso3.current?.scrollIntoView({ behavior: "smooth" }); } }, [servicioId]);
  useEffect(() => { if (slot) { refPaso4.current?.scrollIntoView({ behavior: "smooth" }); } }, [slot]);

  /* ===== Confirmar ===== */
  const onConfirm = () => {
    if (!isAuth) {
      navigate("/login", { replace: true, state: { from: location } });
      return;
    }
  };

  async function crearReserva() {
    if (!emp?.codigo_cliente || !servicioSel || !slot) return;
    if (!isAuth) return;

    const cliente_nombre = sanitize(user?.nombre || user?.username || (user?.email || "Cliente").split("@")[0]);
    const cliente_contacto = sanitize(user?.email || user?.telefono || "-");

    const basePayload = {
      codigo: emp.codigo_cliente,
      servicio_id: Number(servicioSel.id),
      inicio: toNaive(slot.start),
      cliente_nombre,
      cliente_contacto,
    };

    try {
      setBusy(true);
      const withNota = nota ? { ...basePayload, nota: sanitize(nota) } : basePayload;

      try {
        await api.post("/publico/turnos", withNota);
      } catch (e) {
        if (e?.response?.status === 422) {
          await api.post("/publico/turnos", basePayload);
        } else {
          throw e;
        }
      }

      // refrescamos turnos del día
      const desde = toNaive(startOfDay(slot.start));
      const hasta = toNaive(endOfDay(slot.start));
      const tv = await apiTurnos(emp.id, { desde, hasta });
      setTurnos((prev) => {
        const otros = asArr(prev).filter((t) => {
          const nt = normTurno(t);
          return nt ? !isSameDay(nt.inicio, slot.start) : true;
        });
        return [...otros, ...tv];
      });

      alert("¡Reserva creada!");
      setServicioId("");
      setSlot(null);
      setNota("");
    } catch (e) {
      alert(msgFrom(e, "No se pudo crear la reserva."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div ref={refTop} className="pt-24">
      {busy && <FullscreenStatus title="Procesando…" caption="Guardando tu turno" />}

      <div className="mx-auto w-full max-w-7xl px-4 lg:px-6 space-y-10">
        {/* Emprendimiento */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 md:p-8 shadow-sm">
          <div className="flex items-start gap-4">
            <img
              src={emp?.logo_url || "/images/TurnateLogo.png"}
              alt="Logo"
              className="h-16 w-16 rounded-xl object-cover ring-1 ring-slate-200 bg-white"
            />
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{emp?.nombre || "Emprendimiento"}</h1>
              {emp?.descripcion ? (
                <p className="mt-1 max-w-3xl text-sm text-slate-600">{emp.descripcion}</p>
              ) : (
                <p className="mt-1 text-sm text-slate-500">Elegí el día, el servicio y el horario para reservar.</p>
              )}
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                {emp?.direccion && (<div><span className="font-semibold">Dirección: </span><span className="text-slate-600">{emp.direccion}</span></div>)}
                {emp?.telefono && (<div><span className="font-semibold">Teléfono: </span><span className="text-slate-600">{emp.telefono}</span></div>)}
                {emp?.email_contacto && (<div><span className="font-semibold">Email: </span><span className="text-slate-600">{emp.email_contacto}</span></div>)}
                {emp?.rubro && (<div><span className="font-semibold">Rubro: </span><span className="text-slate-600">{emp.rubro}</span></div>)}
                {emp?.web && (<div><span className="font-semibold">Web: </span><a className="text-sky-600 underline break-all" href={emp.web} target="_blank" rel="noreferrer">{emp.web}</a></div>)}
                {emp?.redes && (<div><span className="font-semibold">Redes: </span><span className="text-slate-600 break-all">{Array.isArray(emp.redes) ? emp.redes.join(" · ") : String(emp.redes)}</span></div>)}
                {emp?.cuit && (<div><span className="font-semibold">CUIT: </span><span className="text-slate-600">{emp.cuit}</span></div>)}
              </div>
            </div>
          </div>
        </section>

        {/* Paso 1: Día */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 md:p-8 shadow-sm">
          <h2 className="text-xl md:text-2xl font-semibold text-slate-900">1) Elegí un día</h2>
          <p className="mt-1 text-sm text-slate-600">
            {noHayHorarios
              ? "Sin horarios cargados: se usa el horario por defecto 08:00–18:00."
              : "Sólo se habilitan los días configurados por el emprendedor."}
          </p>
          <div className="mt-4" ref={refPaso2}>
            <PublicCalendar
              selectedDate={fecha}
              onSelectDate={(d) => setFecha(d)}
              isDayEnabled={isDayEnabled}
              initialMonth={new Date()}
              monthsAhead={1}
            />
          </div>
        </section>

        {/* Paso 2: Servicio */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 md:p-8 shadow-sm">
          <h2 className="text-xl md:text-2xl font-semibold text-slate-900">2) Elegí un servicio</h2>
          <div className="mt-4">
            <select
              className="w-full md:w-1/2 rounded-xl border border-slate-300 px-3 py-2 text-sm"
              value={servicioId}
              onChange={(e) => setServicioId(e.target.value)}
              disabled={!fecha}
              title={!fecha ? "Primero elegí un día" : undefined}
            >
              <option value="">{fecha ? "Seleccioná un servicio…" : "Primero elegí un día"}</option>
              {(fecha ? asArr(servicios) : []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre} ({Number(s.duracion_min || 30)} min)
                </option>
              ))}
            </select>
          </div>
        </section>

        {/* Paso 3: Horario */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 md:p-8 shadow-sm">
          <h2 className="text-xl md:text-2xl font-semibold text-slate-900">3) Elegí un horario</h2>

          {!fecha ? (
            <div className="mt-4 text-sm text-slate-500">Primero elegí un día.</div>
          ) : !servicioId ? (
            <div className="mt-4 text-sm text-slate-500">Ahora elegí un servicio.</div>
          ) : slots.length === 0 ? (
            <div className="mt-4 text-sm text-slate-500">No hay horarios disponibles para este día.</div>
          ) : (
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2" ref={refPaso3}>
              {slots.map((s, i) => {
                const sel = slot && s.start.getTime() === slot.start.getTime();
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setSlot(s)}
                    className={cx(
                      "rounded-xl border px-3 py-2 text-sm font-medium",
                      sel ? "border-sky-600 bg-sky-50 text-sky-900" : "border-slate-300 bg-white text-slate-800 hover:bg-slate-50"
                    )}
                    title={`Bloque hasta ${format(s.blockEnd, "HH:mm")}`}
                  >
                    {format(s.start, "HH:mm", { locale: es })}
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* Paso 4: Confirmar (solo nota opcional) */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 md:p-8 shadow-sm" ref={refPaso4}>
          <h2 className="text-xl md:text-2xl font-semibold text-slate-900">4) Confirmar</h2>
          <p className="mt-1 text-sm text-slate-600">
            {slot ? <>Vas a reservar el <b>{format(slot.start, "EEEE d 'de' MMMM", { locale: es })}</b> a las <b>{format(slot.start, "HH:mm")}</b>.</> : <>Elegí día y horario.</>}
          </p>

          {isAuth && (
            <div className="mt-3 text-xs text-slate-600">
              Se guardará a nombre de <b>{user?.nombre || user?.username || user?.email}</b> ({user?.email || "sin email"}).
            </div>
          )}

          <div className="mt-4">
            <label className="block text-sm text-slate-700">Nota (opcional)</label>
            <input
              value={nota}
              onChange={(e) => setNota(sanitize(e.target.value))}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              placeholder="Ej.: referencia breve"
            />
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            {!isAuth && (
              <span className="text-sm text-slate-600">
                Necesitás iniciar sesión. <Link className="underline" to="/login" state={{ from: location }}>Ir al login</Link>
              </span>
            )}
          </div>

          {isAuth && servicioSel && slot && (
            <button
              type="button"
              onClick={crearReserva}
              className="rounded-xl px-5 py-3 text-sm font-semibold text-white
                         bg-gradient-to-r from-sky-600 to-indigo-600
                         shadow-md hover:brightness-110 active:scale-[0.99]
                         focus:outline-none focus:ring-2 focus:ring-sky-300 flex items-center gap-2"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
              Crear reserva
            </button>
          )}
        </section>
      </div>
    </div>
  );
}
