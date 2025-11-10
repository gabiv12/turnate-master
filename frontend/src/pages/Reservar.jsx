// src/pages/Reservar.jsx
import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, useLocation, Link } from "react-router-dom";
import { addMinutes, endOfDay, format, isSameDay, startOfDay } from "date-fns";
import es from "date-fns/locale/es";
import api from "../services/api";
import PublicCalendar from "../components/PublicCalendar";
import { useUser } from "../context/UserContext.jsx";

/* ===== Utils ===== */
const cx = (...c) => c.filter(Boolean).join(" ");
const pad = (n) => String(n).padStart(2, "0");
const toNaive = (dt) => {
  const d = new Date(dt);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
};
const sanitize = (s) => String(s || "").replace(/[<>{}[\]|\\^~`$]/g, "").slice(0, 240);
const looksLikeCode = (s) => /^[A-Z0-9]{4,12}$/.test(String(s).trim().toUpperCase());
const asArr = (x) => (Array.isArray(x) ? x : Array.isArray(x?.items) ? x.items : x ? [x] : []);
const msgFrom = (e, fb = "Ocurrió un error") => {
  const d = e?.response?.data;
  if (typeof d === "string") return d;
  if (d?.detail) return typeof d.detail === "string" ? d.detail : (d.detail[0]?.msg || fb);
  return fb;
};

const normServicio = (s) => ({ id: s?.id, nombre: s?.nombre ?? "Servicio", duracion_min: Number(s?.duracion_min ?? 30) || 30 });
const cutHHMM = (t) => String(t || "").slice(0, 5);
const normHorario = (h) => ({
  dia_semana: Number(h?.dia_semana ?? 0),
  hora_desde: cutHHMM(h?.hora_desde ?? h?.inicio ?? "08:00"),
  hora_hasta: cutHHMM(h?.hora_hasta ?? h?.fin ?? "18:00"),
  intervalo_min: Number(h?.intervalo_min ?? 30) || 30,
});
const normTurno = (t) => (t?.inicio && t?.fin ? { inicio: new Date(t.inicio), fin: new Date(t.fin) } : null);

/* ===== API ===== */
async function apiEmpByCode(codigo) { const { data } = await api.get(`/publico/emprendedores/by-codigo/${codigo}`); return data; }
async function apiServiciosByCode(codigo) { const { data } = await api.get(`/publico/servicios/${codigo}`); return asArr(data).map(normServicio); }
async function apiHorarios(empId) { const { data } = await api.get(`/publico/horarios/${empId}`); return asArr(data).map(normHorario); }
async function apiTurnos(empId, { desde, hasta }) { const { data } = await api.get(`/publico/turnos/${empId}`, { params: { desde, hasta } }); return asArr(data); }

/* ===== Overlay premium ===== */
function StatusOverlay({ show, mode = "loading", title, caption, onClose }) {
  if (!show) return null;
  const isOK = mode === "success";
  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-slate-900/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200 p-6 text-center">
        <div className={cx(
          "mx-auto mb-4 h-16 w-16 grid place-items-center rounded-full",
          isOK ? "bg-emerald-50" : "bg-slate-100"
        )}>
          {isOK ? (
            <svg viewBox="0 0 24 24" className="h-9 w-9 text-emerald-600">
              <path fill="currentColor" d="M12 22a10 10 0 1 1 0-20 10 10 0 0 1 0 20Zm4.7-12.7a1 1 0 0 0-1.4-1.4L11 12.2l-2.3-2.3a1 1 0 1 0-1.4 1.4l3 3a1 1 0 0 0 1.4 0l5-5Z"/>
            </svg>
          ) : (
            <svg className="h-7 w-7 animate-spin text-slate-600" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" className="opacity-20" />
              <path d="M21 12a9 9 0 0 1-9 9" stroke="currentColor" strokeWidth="2" className="opacity-80" />
            </svg>
          )}
        </div>
        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
        {caption && <p className="mt-1 text-sm text-slate-600">{caption}</p>}
        {isOK && (
          <button
            onClick={onClose}
            className="mt-4 rounded-xl bg-emerald-600 text-white px-4 py-2 text-sm font-semibold shadow hover:brightness-110"
          >
            Entendido
          </button>
        )}
      </div>
    </div>
  );
}

/* ===== Selector de servicio (pager) ===== */
function ServicesPager({ servicios, value, onChange, disabled }) {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 6;

  const filtered = useMemo(() => {
    const s = (q || "").toLowerCase().trim();
    const list = Array.isArray(servicios) ? servicios : [];
    return s ? list.filter(v => String(v?.nombre).toLowerCase().includes(s)) : list;
  }, [q, servicios]);

  const totalPages = Math.max(1, Math.ceil((disabled ? 0 : filtered.length) / PAGE_SIZE));
  const view = (disabled ? [] : filtered).slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  useEffect(() => { setPage(0); }, [q, disabled]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar servicio…"
          disabled={disabled}
          className={cx(
            "flex-1 rounded-xl border px-3 py-2 text-sm",
            disabled ? "border-slate-200 bg-slate-50 text-slate-400" : "border-slate-300 bg-white text-slate-800"
          )}
        />
        <div className="flex items-center gap-1">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={disabled || page === 0}
            className="h-9 w-9 grid place-items-center rounded-lg border border-slate-300 text-slate-700 disabled:opacity-40"
            title="Anterior"
          >‹</button>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={disabled || page >= totalPages - 1}
            className="h-9 w-9 grid place-items-center rounded-lg border border-slate-300 text-slate-700 disabled:opacity-40"
            title="Siguiente"
          >›</button>
        </div>
      </div>

      <div className="mt-2 grid grid-cols-1 gap-2 overflow-auto">
        {view.map((s) => {
          const sel = String(value) === String(s.id);
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onChange(s.id)}
              className={cx(
                "text-left rounded-xl border px-3 py-2 text-sm transition",
                sel ? "border-sky-600 bg-sky-50 text-sky-900" : "border-slate-300 bg-white hover:bg-slate-50"
              )}
              title={`${s.nombre} · ${Number(s.duracion_min || 30)} min`}
            >
              <div className="font-medium truncate">{s.nombre}</div>
              <div className="text-xs text-slate-500">{Number(s.duracion_min || 30)} min</div>
            </button>
          );
        })}
        {!disabled && filtered.length === 0 && (
          <div className="col-span-2 text-xs text-slate-500 py-2">Sin resultados.</div>
        )}
      </div>

      <div className="mt-2 text-xs text-slate-500 text-center">
        {disabled ? "Elegí un día." : `Página ${Math.min(page + 1, totalPages)} de ${totalPages}`}
      </div>
    </div>
  );
}

/* ===== Página ===== */
export default function Reservar() {
  const { codigo } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useUser();

  const [emp, setEmp] = useState(null);
  const [servicios, setServicios] = useState([]);
  const [horarios, setHorarios] = useState([]);
  const [turnos, setTurnos] = useState([]);

  const [fecha, setFecha] = useState(null);
  const [servicioId, setServicioId] = useState("");
  const [slot, setSlot] = useState(null);
  const [nota, setNota] = useState("");

  const [overlay, setOverlay] = useState({ show:false, mode:"loading", title:"", caption:"" });

  const isAuth =
    !!(localStorage.getItem("accessToken") ||
       localStorage.getItem("token") ||
       localStorage.getItem("access_token"));

  // Carga inicial por código
  useEffect(() => {
    (async () => {
      const code = (codigo || "").trim().toUpperCase();
      if (!looksLikeCode(code)) { navigate("/ingresar-codigo", { replace: true }); return; }
      try {
        setOverlay({ show:true, mode:"loading", title:"Cargando…", caption:"Preparando todo" });
        const e = await apiEmpByCode(code); setEmp(e);
        const svcs = await apiServiciosByCode(code); setServicios(svcs);
        const hs = await apiHorarios(e.id); setHorarios(hs);
        const now = new Date();
        const desde = toNaive(startOfDay(new Date(now.getFullYear(), now.getMonth(), 1)));
        const hasta = toNaive(endOfDay(new Date(now.getFullYear(), now.getMonth() + 1, 0)));
        const tv = await apiTurnos(e.id, { desde, hasta }); setTurnos(tv);
      } catch (err) {
        setOverlay({ show:true, mode:"success", title:"No se pudo cargar", caption: msgFrom(err, "Intentá nuevamente.") });
      } finally {
        setTimeout(() => setOverlay((o)=>({ ...o, show:false })), 500);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codigo]);

  const noHayHorarios = (horarios?.length || 0) === 0;
  const isDayEnabled = (date) => {
    if (noHayHorarios) return true;
    const day = date.getDay();
    return horarios.some((h) => (h.activo !== false) && Number(h.dia_semana) === day);
  };

  const ocupadosDelDia = useMemo(() => {
    if (!fecha) return [];
    return asArr(turnos).map(normTurno).filter(Boolean).filter((t) => isSameDay(t.inicio, fecha));
  }, [fecha, turnos]);

  const servicioSel = useMemo(
    () => (servicios || []).find((s) => String(s.id) === String(servicioId)) || null,
    [servicioId, servicios]
  );

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

  async function crearReserva() {
    if (!emp?.codigo_cliente || !servicioSel || !slot || !isAuth) return;

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
      setOverlay({ show:true, mode:"loading", title:"Procesando…", caption:"Guardando tu turno" });

      const withNota = nota ? { ...basePayload, nota: sanitize(nota) } : basePayload;
      try { await api.post("/publico/turnos", withNota); }
      catch (e) { if (e?.response?.status === 422) { await api.post("/publico/turnos", basePayload); } else { throw e; } }

      setServicioId(""); setSlot(null); setNota("");
      setOverlay({
        show:true,
        mode:"success",
        title:"¡Turno confirmado!",
        caption:`Te va a llegar un mensaje a tu correo con los detalles.`
      });
      setTimeout(() => setOverlay((o)=>({ ...o, show:false })), 2200);
    } catch (e) {
      setOverlay({
        show:true,
        mode:"success",
        title:"No se pudo crear la reserva",
        caption: msgFrom(e, "Intentá nuevamente.")
      });
      setTimeout(() => setOverlay((o)=>({ ...o, show:false })), 2200);
    }
  }

  // === Nuevo: acciones de compartir código (sutil) ===
  async function copy(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
  }
  async function shareCodigo() {
    const code = emp?.codigo_cliente;
    if (!code) return;
    const url = window.location.origin + `/reservar/${encodeURIComponent(code)}`;
    const title = `Reservá turno en ${emp?.nombre || "mi emprendimiento"}`;
    const text  = `Podés reservar un turno usando mi código: ${code}\n${url}`;
    if (navigator.share) {
      try { await navigator.share({ title, text, url }); } catch {}
    } else {
      const ok = await copy(text);
      if (ok) alert("Texto copiado para compartir 💬");
    }
  }

  const step = slot ? 4 : servicioId ? 3 : fecha ? 2 : 1;

  return (
    <div className="min-h-[100dvh] w-full overflow-hidden flex flex-col">
      <StatusOverlay
        show={overlay.show}
        mode={overlay.mode}
        title={overlay.title}
        caption={overlay.caption}
        onClose={() => setOverlay((o)=>({ ...o, show:false }))}
      />

      {/* Header premium */}
      <header className="bg-gradient-to-r from-sky-600 to-indigo-600 text-white shadow">
        <div className="mx-auto w-full max-w-7xl px-4 lg:px-6 py-3 flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-xl font-semibold truncate">{emp?.nombre || "Reservar turno"}</h1>
              <p className="text-xs opacity-90 truncate">{emp?.descripcion || "Elegí día, servicio y horario."}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold ring-1 ring-white/20 hover:bg-white/15"
              >
                Volver
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Perfil compacto + Código público (sutil) */}
      <section className="mx-auto w-full max-w-7xl px-4 lg:px-6 py-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm text-center">
          <div className="inline-flex items-center gap-3">
            <img
              src={emp?.logo_url || "/images/TurnateLogo.png"}
              alt="Logo"
              className="h-10 w-10 rounded-xl object-cover ring-1 ring-slate-200 bg-white"
            />
            <h2 className="text-lg font-bold text-slate-900">{emp?.nombre || "Emprendimiento"}</h2>
          </div>
          <p className="mt-1 text-xs text-slate-600">
            {emp?.descripcion || "Elegí el día, el servicio y el horario para reservar."}
          </p>

          {/* ——— NUEVO BLOQUE SUTIL PARA COMPARTIR CÓDIGO ——— */}
          {emp?.codigo_cliente && (
            <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-2 py-1">
              <span className="text-[11px] font-semibold text-slate-700">
                Código para reservar:
              </span>
              <code className="px-2 py-0.5 rounded-md bg-white ring-1 ring-slate-200 text-slate-900 text-xs font-bold tracking-wide">
                {emp.codigo_cliente}
              </code>
              <button
                onClick={() => navigator.clipboard.writeText(emp.codigo_cliente)}
                className="text-xs rounded-lg border border-slate-300 bg-white px-2 py-1 hover:bg-slate-50"
                title="Copiar código"
              >
                Copiar
              </button>
              <button
                onClick={shareCodigo}
                className="text-xs rounded-lg border border-slate-300 bg-white px-2 py-1 hover:bg-slate-50"
                title="Compartir"
              >
                Compartir
              </button>
            </div>
          )}
          {/* ——— FIN BLOQUE ——— */}
        </div>
      </section>

      {/* Cuatro columnas igualadas (tu layout) */}
      <main className="grow px-4 lg:px-6 pb-3">
        <div className="mx-auto w-full max-w-6xl">
          <div
            className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"
            style={{ height: "calc(100dvh - 220px)" }}
          >
            <div className="grid h-full grid-cols-1 md:grid-cols-4 gap-3 auto-rows-fr">
              {/* 1) Día */}
              <section className="h-full min-h-0 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm flex flex-col">
                <h3 className="text-sm font-semibold text-slate-900 mb-2">1) Día</h3>
                <div className="grow min-h-0 overflow-hidden">
                  <div className="origin-top-left scale-[0.96]">
                    <PublicCalendar
                      selectedDate={fecha}
                      onSelectDate={(d) => { setFecha(d); setServicioId(""); setSlot(null); }}
                      isDayEnabled={isDayEnabled}
                      initialMonth={new Date()}
                      monthsAhead={1}
                    />
                  </div>
                </div>
              </section>

              {/* 2) Servicio */}
              <section className="h-full min-h-0 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm flex flex-col">
                <h3 className="text-sm font-semibold text-slate-900 mb-2">2) Servicio</h3>
                <div className="grow min-h-0 overflow-hidden">
                  <ServicesPager
                    servicios={servicios}
                    value={servicioId}
                    onChange={(id) => { setServicioId(id); setSlot(null); }}
                    disabled={!fecha}
                  />
                </div>
              </section>

              {/* 3) Horario */}
              <section className="h-full min-h-0 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm flex flex-col">
                <h3 className="text-sm font-semibold text-slate-900 mb-2">3) Horario</h3>
                <div className="grow min-h-0 overflow-hidden">
                  {!fecha ? (
                    <div className="text-sm text-slate-500">Elegí un día.</div>
                  ) : !servicioId ? (
                    <div className="text-sm text-slate-500">Elegí un servicio.</div>
                  ) : slots.length === 0 ? (
                    <div className="text-sm text-slate-500">No hay horarios disponibles.</div>
                  ) : (
                    <div className="grid grid-cols-2 xl:grid-cols-3 gap-2">
                      {slots.slice(0, 24).map((s, i) => {
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
              <section className="h-full min-h-0 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm flex flex-col">
                <h3 className="text-sm font-semibold text-slate-900 mb-2">4) Confirmar</h3>
                <div className="grow min-h-0">
                  <p className="text-sm text-slate-600">
                    {slot
                      ? <>Turno para <b>{format(slot.start, "EEEE d 'de' MMMM", { locale: es })}</b> a las <b>{format(slot.start, "HH:mm")}</b>.</>
                      : <>Elegí día, servicio y horario.</>}
                  </p>

                  <div className="mt-3">
                    <label className="block text-sm text-slate-700">Nota (opcional)</label>
                    <input
                      value={nota}
                      onChange={(e) => setNota(sanitize(e.target.value))}
                      className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                      placeholder="Ej.: referencia breve"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  {!isAuth ? (
                    <span className="text-sm text-slate-600">
                      Iniciá sesión para confirmar.{" "}
                      <Link className="underline" to="/login" state={{ from: location }}>Ir al login</Link>
                    </span>
                  ) : servicioSel && slot ? (
                    <button
                      type="button"
                      onClick={crearReserva}
                      className="w-full rounded-xl px-5 py-3 text-sm font-semibold text-white
                                bg-gradient-to-r from-sky-600 to-indigo-600
                                shadow-md hover:brightness-110 active:scale-[0.99]
                                focus:outline-none focus:ring-2 focus:ring-sky-300"
                    >
                      Confirmar turno
                    </button>
                  ) : (
                    <div className="text-xs text-slate-500">Completá los pasos para confirmar.</div>
                  )}
                </div>
              </section>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

/* Chip premium para pasos */
function ChipStep({ n, label, active, done }) {
  return (
    <div className={cx(
      "flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ring-1",
      active ? "bg-white/15 text-white ring-white/30" :
      done   ? "bg-emerald-100 text-emerald-700 ring-emerald-200" :
               "bg-white/10 text-white/90 ring-white/20"
    )}>
      <span className={cx(
        "grid place-items-center h-5 w-5 rounded-full text-[11px] font-bold",
        active ? "bg-white/30" : done ? "bg-emerald-200 text-emerald-800" : "bg-white/20"
      )}>{n}</span>
      {label}
    </div>
  );
}
