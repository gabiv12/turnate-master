// src/pages/Reservar.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { format, startOfDay, endOfDay, isSameDay, addMinutes } from "date-fns";
import es from "date-fns/locale/es";
import api from "../services/api";
import PublicCalendar from "../components/PublicCalendar";

const cx = (...c) => c.filter(Boolean).join(" ");
const looksLikeCode = (s) => /^[A-Z0-9]{4,12}$/.test(String(s).trim().toUpperCase());

function msg(err, fallback = "Ocurrió un error") {
  const d = err?.response?.data;
  if (typeof d === "string") return d;
  if (d?.detail) return typeof d.detail === "string" ? d.detail : (d.detail[0]?.msg || fallback);
  return err?.message || fallback;
}

// Fallback POST: intenta varias rutas compatibles con distintos backends
async function postFirst(paths, payload) {
  let lastErr;
  for (const p of paths) {
    try {
      const r = await api.post(p, payload);
      return r?.data ?? {};
    } catch (e) {
      lastErr = e;
      // si es 404/405/501 seguimos probando, si es 5xx cortamos
      const s = e?.response?.status;
      if (s >= 500) break;
    }
  }
  throw lastErr;
}

export default function Reservar() {
  const { codigo: codigoParam } = useParams(); // /reservar/:codigo (opcional)
  const navigate = useNavigate();
  const location = useLocation();

  const [codigo, setCodigo] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [error, setError] = useState("");
  const [okMsg, setOkMsg] = useState("");

  const [emp, setEmp] = useState(null);
  const [servicios, setServicios] = useState([]);
  const [horarios, setHorarios] = useState([]);
  const [turnos, setTurnos] = useState([]);

  // flujo paso a paso
  const [fecha, setFecha] = useState(null);
  const [slot, setSlot] = useState(null);
  const [servicioId, setServicioId] = useState("");

  // datos cliente + nota (aparecen al final)
  const [clienteNombre, setClienteNombre] = useState("");
  const [clienteContacto, setClienteContacto] = useState(""); // tel o email
  const [nota, setNota] = useState("");

  const [confirming, setConfirming] = useState(false);
  const [showLoginAsk, setShowLoginAsk] = useState(false);

  // refs: guards y focos
  const autoOnceRef = useRef(false);
  const lastCodeRef = useRef("");
  const searchingRef = useRef(false);
  const debounceRef = useRef(null);

  const stepCalRef = useRef(null);
  const stepSlotsRef = useRef(null);
  const stepServicioRef = useRef(null);
  const stepDatosRef = useRef(null);

  // ------------ Buscar por código (usa /publico/*) ------------
  const buscar = async (force = false) => {
    setError("");
    setOkMsg("");

    const code = (codigo || "").trim().toUpperCase();
    if (!looksLikeCode(code)) {
      setError("Ingresá un código válido.");
      return;
    }
    if (!force) {
      if (searchingRef.current) return;
      if (lastCodeRef.current === code && emp) return;
    }

    // reset de flujo
    if (lastCodeRef.current !== code) {
      setEmp(null);
      setServicios([]);
      setHorarios([]);
      setTurnos([]);
      setFecha(null);
      setSlot(null);
      setServicioId("");
      setClienteNombre("");
      setClienteContacto("");
      setNota("");
    }

    searchingRef.current = true;
    setBuscando(true);
    try {
      const e = await api.get(`/emprendedores/by-codigo/${code}`);
      setEmp(e.data);

      const [rs, rh] = await Promise.all([
        api.get(`/publico/servicios/${code}`),
        api.get(`/publico/horarios/${code}`),
      ]);
      setServicios(rs.data || []);
      setHorarios(rh.data || []);

      // turnos del mes en curso (para bloquear slots)
      const now = new Date();
      const desde = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1)).toISOString();
      const hasta = endOfDay(new Date(now.getFullYear(), now.getMonth() + 1, 0)).toISOString();
      const t = await api.get(`/publico/turnos/${code}`, { params: { desde, hasta, limit: 500 } });
      setTurnos(t.data || []);

      lastCodeRef.current = code;

      // foco al paso 1 (calendario)
      queueMicrotask(() =>
        stepCalRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
      );
    } catch (err) {
      setError(msg(err, "No se pudo cargar la agenda"));
    } finally {
      searchingRef.current = false;
      setBuscando(false);
    }
  };

  // auto /reservar/:codigo (una vez)
  useEffect(() => {
    if (!codigoParam || autoOnceRef.current) return;
    autoOnceRef.current = true;
    const c = String(codigoParam).trim().toUpperCase();
    setCodigo(c);
    queueMicrotask(() => buscar(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codigoParam]);

  // debounce al tipear
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    if (looksLikeCode(codigo) && lastCodeRef.current !== codigo.trim().toUpperCase()) {
      debounceRef.current = setTimeout(() => buscar(true), 450);
    }
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codigo]);

  // días habilitados por horarios
  const isDayEnabled = (date) => {
    const day = date.getDay(); // 0=Dom
    return horarios.some((h) => h.activo && Number(h.dia_semana) === day);
  };

  // slots del día (filtra ocupados)
  const slots = useMemo(() => {
    if (!fecha || !horarios?.length) return [];
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
  }, [fecha, horarios, turnos]);

  // foco al pasar de paso
  useEffect(() => {
    if (fecha && !slot) {
      queueMicrotask(() =>
        stepSlotsRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
      );
    }
  }, [fecha]);

  useEffect(() => {
    if (slot && !servicioId) {
      queueMicrotask(() =>
        stepServicioRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
      );
    }
  }, [slot]);

  useEffect(() => {
    if (servicioId) {
      queueMicrotask(() =>
        stepDatosRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
      );
    }
  }, [servicioId]);

  // confirmar: si no hay sesión, pedí login
  const onConfirm = () => {
    const hasToken =
      localStorage.getItem("token") ||
      sessionStorage.getItem("token") ||
      localStorage.getItem("accessToken");
    if (!hasToken) {
      setShowLoginAsk(true);
      return;
    }
    setConfirming(true);
  };

  // reservar (payload completo)
  const confirmarReserva = async () => {
    if (!emp || !slot || !servicioId) return;
    try {
      setBuscando(true);
      setError("");
      const payload = {
        datetime: slot.toISOString(),
        servicio_id: Number(servicioId),
        cliente_nombre: (clienteNombre || "").trim(),
        cliente_contacto: (clienteContacto || "").trim(), // tel o email
        notas: (nota || "").trim(),
      };

      await postFirst(
        [
          `/turnos/compat/${emp.codigo_cliente}`,      // preferido (compat)
          `/publico/reservar/${emp.codigo_cliente}`,   // alternativa pública
          `/reservas/public/${emp.codigo_cliente}`,    // alternativa pública 2
          `/turnos/reservar/${emp.codigo_cliente}`,    // alternativa
        ],
        payload
      );

      setOkMsg("¡Listo! Tu reserva fue creada.");
      setConfirming(false);

      // refrescar ocupados del día
      const desde = startOfDay(new Date(slot)).toISOString();
      const hasta = endOfDay(new Date(slot)).toISOString();
      const t = await api.get(`/publico/turnos/${emp.codigo_cliente}`, { params: { desde, hasta } });
      setTurnos(t.data || []);

      // limpiar sólo la parte final para poder reservar otro horario
      setSlot(null);
      setServicioId("");
      setClienteNombre("");
      setClienteContacto("");
      setNota("");
      // volver a foco en los horarios
      queueMicrotask(() =>
        stepSlotsRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
      );
    } catch (err) {
      setError(msg(err, "No se pudo crear la reserva"));
      setConfirming(false);
    } finally {
      setBuscando(false);
    }
  };

  // helpers display
  const servicioSel = servicios.find((s) => s.id === Number(servicioId));

  return (
    <div className="container-page py-4 md:py-6 space-y-4">
      {/* Hero / info emprendimiento */}
      <div className="booking-hero">
        <div className="booking-hero__media">
          <img src="/images/ReservaCodigo.png" alt="Reservá tu turno" />
        </div>
        <div className="booking-hero__body">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <div className="booking-hero__title">
                {emp ? (emp.nombre || emp.negocio || "Emprendimiento") : "Reservá tu turno"}
              </div>
              <div className="booking-hero__meta">
                {emp
                  ? (emp.descripcion || "Elegí fecha y hora para reservar")
                  : "Ingresá el código del emprendimiento para continuar"}
              </div>
            </div>

            {/* Buscar por código */}
            <div className="flex gap-2">
              <input
                value={codigo}
                onChange={(e) => {
                  setCodigo(e.target.value.toUpperCase());
                  setError("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") buscar();
                }}
                placeholder="Código (p.ej. BL8B7Q)"
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm w-44"
              />
              <button
                onClick={() => buscar()}
                disabled={buscando || !looksLikeCode(codigo)}
                className="btn-primary disabled:opacity-60"
              >
                {buscando ? "Buscando..." : "Buscar"}
              </button>
            </div>
          </div>

          {/* Tarjeta breve con datos del emprendimiento */}
          {emp && (
            <>
              <hr className="my-4 hr-soft" />
              <div className="card bg-white/90 p-3 md:p-4">
                <div className="flex items-start gap-3">
                  {/* logo */}
                  <div className="h-14 w-14 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 shrink-0">
                    {emp.foto_url || emp.logo_url ? (
                      <img
                        src={emp.foto_url || emp.logo_url}
                        alt="Logo"
                        className="h-full w-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="h-full w-full grid place-items-center text-slate-400 text-xs">
                        LOGO
                      </div>
                    )}
                  </div>

                  <div className="min-w-0">
                    {/* descripción */}
                    {emp.descripcion && (
                      <div className="text-sm text-slate-700">{emp.descripcion}</div>
                    )}

                    {/* contacto compacto */}
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
                      {emp.direccion && <span>📍 {emp.direccion}</span>}
                      {emp.telefono || emp.telefono_contacto ? (
                        <span>📞 {emp.telefono || emp.telefono_contacto}</span>
                      ) : null}
                      {emp.web && (
                        <a
                          className="link-soft"
                          href={/^https?:\/\//i.test(emp.web) ? emp.web : `https://${emp.web}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          🌐 Sitio
                        </a>
                      )}
                      {emp.instagram && (
                        <a
                          className="link-soft"
                          href={
                            emp.instagram.startsWith("http")
                              ? emp.instagram
                              : `https://instagram.com/${emp.instagram.replace(/^@/, "")}`
                          }
                          target="_blank"
                          rel="noreferrer"
                        >
                          📸 Instagram
                        </a>
                      )}
                      {emp.email_contacto && <span>✉️ {emp.email_contacto}</span>}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          <div className="mt-3 text-sm text-slate-700">
            1) Elegí un <b>día</b> &nbsp;•&nbsp; 2) Elegí un <b>horario</b> &nbsp;•&nbsp; 3) Elegí un <b>servicio</b> &nbsp;•&nbsp; 4) Completá tus <b>datos</b> y confirmá.
          </div>
        </div>
      </div>

      {/* Bloques paso a paso (sin scroll largo; cada bloque es compacto) */}
      {emp && (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-4">
          {/* principal */}
          <div className="space-y-4">
            {/* Paso 1: Calendario */}
            <div ref={stepCalRef} className="card p-4">
              <div className="mb-2 font-medium text-slate-800">1) Elegí un día</div>
              <PublicCalendar
                selectedDate={fecha}
                onSelectDate={(d) => {
                  setFecha(d);
                  setSlot(null);
                  setServicioId("");
                  setClienteNombre("");
                  setClienteContacto("");
                  setNota("");
                }}
                isDayEnabled={isDayEnabled}
              />
            </div>

            {/* Paso 2: Horarios */}
            {fecha && (
              <div ref={stepSlotsRef} className="card p-4">
                <div className="mb-2 font-medium text-slate-800">
                  2) Elegí un horario —{" "}
                  {format(fecha, "EEEE d 'de' MMMM", { locale: es })}
                </div>
                {slots.length === 0 ? (
                  <div className="text-sm text-slate-500">No hay horarios para este día.</div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {slots.map((d, i) => {
                      const sel = slot && d.getTime() === slot.getTime();
                      return (
                        <button
                          key={i}
                          className={cx(
                            "rounded-xl px-3 py-2 text-sm border",
                            sel
                              ? "bg-blue-600 text-white border-blue-600"
                              : "bg-white border-slate-300 hover:bg-slate-50"
                          )}
                          onClick={() => {
                            setSlot(d);
                            setServicioId("");
                            setClienteNombre("");
                            setClienteContacto("");
                            setNota("");
                          }}
                        >
                          {format(d, "HH:mm")}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Paso 3: Servicio */}
            {slot && (
              <div ref={stepServicioRef} className="card p-4">
                <div className="mb-2 font-medium text-slate-800">3) Elegí un servicio</div>
                <select
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                  value={servicioId}
                  onChange={(e) => setServicioId(e.target.value)}
                >
                  <option value="">Elegí…</option>
                  {servicios.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nombre} · {s.duracion_min} min
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Paso 4: Datos del cliente + Nota (opcional) */}
            {slot && servicioId && (
              <div ref={stepDatosRef} className="card p-4">
                <div className="mb-2 font-medium text-slate-800">
                  4) Tus datos (para confirmar)
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input
                    className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                    placeholder="Tu nombre y apellido"
                    value={clienteNombre}
                    onChange={(e) => setClienteNombre(e.target.value)}
                  />
                  <input
                    className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                    placeholder="Tu contacto (teléfono o email)"
                    value={clienteContacto}
                    onChange={(e) => setClienteContacto(e.target.value)}
                  />
                </div>
                <textarea
                  className="mt-3 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                  rows={3}
                  placeholder="Nota para el emprendimiento (opcional)"
                  value={nota}
                  onChange={(e) => setNota(e.target.value)}
                />
                <div className="mt-3 text-xs text-slate-600">
                  Estos datos sólo se usan para esta reserva.
                </div>
              </div>
            )}
          </div>

          {/* sidebar: resumen + confirmar */}
          {emp && (
            <aside className="card p-4 lg:sticky lg:top-24 h-fit">
              <div className="font-medium text-slate-800 mb-2">Resumen</div>

              <div className="space-y-2 text-sm">
                <div>
                  <div className="text-slate-500">Emprendimiento</div>
                  <div className="font-medium">{emp?.nombre || emp?.negocio || "-"}</div>
                </div>
                <div>
                  <div className="text-slate-500">Fecha</div>
                  <div className="font-medium">
                    {fecha ? format(fecha, "EEEE d 'de' MMMM", { locale: es }) : "—"}
                  </div>
                </div>
                <div>
                  <div className="text-slate-500">Horario</div>
                  <div className="font-medium">{slot ? format(slot, "HH:mm") : "—"}</div>
                </div>
                <div>
                  <div className="text-slate-500">Servicio</div>
                  <div className="font-medium">
                    {servicioSel ? `${servicioSel.nombre} · ${servicioSel.duracion_min} min` : "—"}
                  </div>
                </div>

                {servicioId && (
                  <>
                    <div>
                      <div className="text-slate-500">Tu nombre</div>
                      <div className="font-medium">{clienteNombre || "—"}</div>
                    </div>
                    <div>
                      <div className="text-slate-500">Contacto</div>
                      <div className="font-medium">{clienteContacto || "—"}</div>
                    </div>
                    {nota && (
                      <div>
                        <div className="text-slate-500">Nota</div>
                        <div className="font-medium">{nota}</div>
                      </div>
                    )}
                  </>
                )}
              </div>

              <button
                className="mt-4 w-full btn-primary disabled:opacity-60"
                onClick={onConfirm}
                disabled={!slot || !servicioId}
              >
                Confirmar reserva
              </button>

              {error && (
                <div className="mt-3 rounded-xl bg-rose-50 text-rose-700 text-sm px-3 py-2 border border-rose-100">
                  {error}
                </div>
              )}
              {okMsg && (
                <div className="mt-3 rounded-xl bg-emerald-50 text-emerald-700 text-sm px-3 py-2 border border-emerald-100">
                  {okMsg}
                </div>
              )}
            </aside>
          )}
        </div>
      )}

      {/* Modal: pedir login */}
      {showLoginAsk && (
        <div className="fixed inset-0 z-[60]">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setShowLoginAsk(false)} />
          <div className="absolute inset-0 grid place-items-center p-4">
            <div className="w-full max-w-md rounded-2xl bg-white shadow-xl ring-1 ring-slate-200">
              <div className="px-5 py-4 border-b border-slate-100 font-semibold">
                Necesitás iniciar sesión
              </div>
              <div className="p-5 text-sm text-slate-700">
                Para reservar un turno primero tenés que iniciar sesión.
              </div>
              <div className="px-5 pb-5 flex gap-2">
                <button className="btn-plain" onClick={() => setShowLoginAsk(false)}>Cancelar</button>
                <button
                  className="btn-primary"
                  onClick={() => navigate(`/login?next=${encodeURIComponent(location.pathname)}`)}
                >
                  Ir a iniciar sesión
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmación */}
      {confirming && (
        <div className="fixed inset-0 z-[60]">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setConfirming(false)} />
          <div className="absolute inset-0 grid place-items-center p-4">
            <div className="w-full max-w-md rounded-2xl bg-white shadow-xl ring-1 ring-slate-200">
              <div className="px-5 py-4 border-b border-slate-100 font-semibold">
                Confirmar reserva
              </div>
              <div className="p-5 text-sm space-y-2">
                <div>Emprendimiento: <b>{emp?.nombre || emp?.negocio}</b></div>
                <div>Fecha: <b>{fecha ? format(fecha, "EEEE d 'de' MMMM", { locale: es }) : "-"}</b></div>
                <div>Hora: <b>{slot ? format(slot, "HH:mm") : "-"}</b></div>
                <div>Servicio: <b>{servicioSel?.nombre || "-"}</b></div>
                {clienteNombre && <div>Nombre: <b>{clienteNombre}</b></div>}
                {clienteContacto && <div>Contacto: <b>{clienteContacto}</b></div>}
                {nota && <div>Nota: <b>{nota}</b></div>}
              </div>
              <div className="px-5 pb-5 flex gap-2">
                <button className="btn-plain" onClick={() => setConfirming(false)}>Volver</button>
                <button className="btn-primary" onClick={confirmarReserva}>Confirmar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
