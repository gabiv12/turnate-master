// src/pages/Estadisticas.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useUser } from "../context/UserContext.jsx";
import api from "../services/api";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { format } from "date-fns";
import es from "date-fns/locale/es";
import { listarTurnosOwner } from "../services/turnos";
import { isEmprendedor as empCheck } from "../utils/roles";

/* ===== Colores y formato ===== */
const PALETTE = [
  "#2563eb", "#0ea5e9", "#22c55e", "#f59e0b", "#ef4444", "#9333ea",
  "#14b8a6", "#f97316", "#84cc16", "#8b5cf6", "#06b6d4", "#dc2626",
];

const currency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

/* ===== Helpers ===== */
function toISODate(d) {
  if (!d) return null;
  const dt = new Date(d);
  // mediodía local para evitar saltos por huso
  dt.setHours(12, 0, 0, 0);
  return dt.toISOString().slice(0, 10); // YYYY-MM-DD
}

function normList(resp) {
  if (!resp) return [];
  if (Array.isArray(resp)) return resp;
  if (Array.isArray(resp.items)) return resp.items;
  if (Array.isArray(resp.results)) return resp.results;
  if (Array.isArray(resp.data)) return resp.data;
  if (Array.isArray(resp.turnos)) return resp.turnos;
  if (resp.data && Array.isArray(resp.data.items)) return resp.data.items;
  if (resp.data && Array.isArray(resp.data.results)) return resp.data.results;
  const onlyKey = Object.keys(resp || {}).find((k) => Array.isArray(resp[k]));
  if (onlyKey) return resp[onlyKey];
  return [];
}

/* ===== Mapper TOLERANTE (incluye desde/hasta) ===== */
function mapTurno(t) {
  const servicioId =
    t.servicio_id ?? t.servicioId ?? t?.servicio?.id ?? t?.servicio?.ID ?? "";

  const servicioNombre =
    t.servicio_nombre ??
    t.servicioNombre ??
    t?.servicio?.nombre ??
    t?.servicio?.Nombre ??
    "Servicio";

  const inicioRaw =
    t.inicio ?? t.desde ?? t.start ?? t.fecha_inicio ?? t.startTime ?? t.fecha;
  const finRaw =
    t.fin ?? t.hasta ?? t.end ?? t.fecha_fin ?? t.endTime;

  const precioRaw = t.precio_aplicado ?? t.precioAplicado ?? t.precio ?? t.monto ?? 0;
  const estadoRaw = (t.estado ?? t.state ?? "confirmado");

  const dIni = inicioRaw ? new Date(inicioRaw) : null;
  const dFin = finRaw ? new Date(finRaw) : (dIni ? new Date(dIni.getTime() + 30 * 60000) : null);

  return {
    id: String(t.id ?? t.uuid ?? `${servicioId}-${inicioRaw ?? Math.random()}`),
    servicio_id: String(servicioId || ""),
    servicio_nombre: servicioNombre,
    inicio: dIni && !isNaN(dIni) ? dIni.toISOString() : null,
    fin: dFin && !isNaN(dFin) ? dFin.toISOString() : null,
    estado: String(estadoRaw).toLowerCase(),
    precio_aplicado: Number(precioRaw) || 0,
    cliente_nombre:
      t.cliente_nombre ?? t.clienteNombre ?? t?.cliente?.nombre ?? t?.cliente?.Nombre ?? "—",
  };
}

/* ===== Presentacional ===== */
function Card({ title, subtitle, children }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        {subtitle && <span className="text-xs text-slate-500">{subtitle}</span>}
      </div>
      <div className="w-full h-72 md:h-80">{children}</div>
    </div>
  );
}

function Donut({ data }) {
  const safe = Array.isArray(data) ? data.filter((d) => Number(d.value) > 0) : [];
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={safe}
          dataKey="value"
          nameKey="name"
          innerRadius="55%"
          outerRadius="85%"
          paddingAngle={2}
          isAnimationActive
          labelLine={false}
          label={({ percent }) => `${Math.round((percent || 0) * 100)}%`}
        >
          {safe.map((entry, idx) => (
            <Cell key={`slice-${idx}`} fill={entry.color || PALETTE[idx % PALETTE.length]} />
          ))}
        </Pie>
        <Tooltip
          formatter={(v, n) => [typeof v === "number" ? v : 0, n]}
          contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0" }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

function KPI({ title, value }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs text-slate-500">{title}</div>
      <div className="mt-1 text-xl font-semibold text-slate-900">{value}</div>
    </div>
  );
}

/* ===== Página ===== */
export default function Estadisticas() {
  const { user } = useUser();
  const emprendedor = empCheck(user);

  // RANGO POR DEFECTO: MES ACTUAL
  const now = new Date();
  const defaultDesde = new Date(now.getFullYear(), now.getMonth(), 1);
  const defaultHasta = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const [desde, setDesde] = useState(toISODate(defaultDesde));
  const [hasta, setHasta] = useState(toISODate(defaultHasta));

  const [servicios, setServicios] = useState([]);
  const [turnos, setTurnos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [emptyMsg, setEmptyMsg] = useState(""); // para distinguir “sin datos” de “error”

  // paginación
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const fetchedOnceRef = useRef(false);

  // ===== Carga principal =====
  async function loadData() {
    if (!emprendedor) return;
    setEmptyMsg("");
    if (!desde || !hasta || new Date(desde) > new Date(hasta)) {
      setServicios([]); setTurnos([]); setEmptyMsg("Rango inválido."); return;
    }
    setLoading(true);
    try {
      const dIniLocal = new Date(`${desde}T00:00:00`);
      const dFinLocal = new Date(`${hasta}T23:59:59`);
      const params = { desde: dIniLocal.toISOString(), hasta: dFinLocal.toISOString() };

      // 1) Turnos
      let tv = [];
      try {
        const arr = await listarTurnosOwner(params);
        tv = Array.isArray(arr) ? arr.map(mapTurno) : normList(arr).map(mapTurno);
      } catch (e) {
        console.warn("[Estadísticas] listarTurnosOwner falló, intento fallback /turnos/mis", e);
        try {
          const raw = await api.get("/turnos/mis");
          const all = normList(raw?.data).map(mapTurno);
          const fromMs = dIniLocal.getTime();
          const toMs = dFinLocal.getTime();
          tv = all.filter((t) => {
            const ms = t.inicio ? new Date(t.inicio).getTime() : NaN;
            return Number.isFinite(ms) && ms >= fromMs && ms <= toMs;
          });
        } catch (e2) {
          console.error("[Estadísticas] Fallback también falló", e2);
          tv = [];
        }
      }

      // 2) Servicios
      let sv = [];
      try {
        const srv = await api.get("/servicios/mis");
        sv = normList(srv?.data);
      } catch (e) {
        console.warn("[Estadísticas] /servicios/mis falló, infiero desde turnos", e);
        sv = [];
      }

      // 3) Inferir servicios si no vinieron
      if (!sv.length && tv.length) {
        const byId = new Map();
        tv.forEach((t) => {
          const sid = String(t.servicio_id || "");
          if (!sid) return;
          if (!byId.has(sid)) {
            byId.set(sid, { id: sid, nombre: t.servicio_nombre || "Servicio", precio: t.precio_aplicado || 0 });
          }
        });
        sv = Array.from(byId.values());
      }

      setServicios(Array.isArray(sv) ? sv : []);
      setTurnos(Array.isArray(tv) ? tv : []);
      if ((Array.isArray(tv) && tv.length === 0)) {
        setEmptyMsg("No hay turnos en el período elegido.");
      }
    } catch (e) {
      console.error("[Estadísticas] Error cargando datos", e);
      setServicios([]); setTurnos([]);
      setEmptyMsg("No se pudieron cargar las estadísticas.");
    } finally {
      setLoading(false);
    }
  }

  // Carga inicial (una vez)
  useEffect(() => {
    if (!emprendedor) return;
    if (fetchedOnceRef.current) return;
    fetchedOnceRef.current = true;
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emprendedor]);

  const onApplyRange = () => loadData();

  // Mapa de servicios
  const serviciosMap = useMemo(() => {
    const m = new Map();
    (servicios || []).forEach((s) => m.set(String(s.id), s));
    return m;
  }, [servicios]);

  // Precio robusto
  function precioTurno(t) {
    if (!t) return 0;
    const p = Number(t.precio_aplicado ?? t.precio ?? t.monto ?? 0);
    if (Number.isFinite(p) && p > 0) return p;
    const s = serviciosMap.get(String(t.servicio_id));
    const sp = Number(s?.precio ?? s?.precio_base ?? s?.precioPromedio ?? 0);
    return Number.isFinite(sp) ? sp : 0;
    }

  // Estados
  const confirmados = useMemo(
    () => turnos.filter((t) => (t.estado || "confirmado").toLowerCase() !== "cancelado"),
    [turnos]
  );
  const cancelados = useMemo(
    () => turnos.filter((t) => (t.estado || "").toLowerCase() === "cancelado"),
    [turnos]
  );

  // KPIs
  const ingresosTotales = useMemo(
    () => confirmados.reduce((acc, t) => acc + (precioTurno(t) || 0), 0),
    [confirmados]
  );
  const ticketPromedio = useMemo(() => {
    const c = confirmados.length;
    return c > 0 ? Math.round(ingresosTotales / c) : 0;
  }, [ingresosTotales, confirmados]);

  // Agregados por servicio
  const agregadosServicio = useMemo(() => {
    const map = new Map(); // sid -> {count, amount, nombre}
    confirmados.forEach((t) => {
      const sid = String(t.servicio_id || "");
      const svc = serviciosMap.get(sid);
      const nombre = svc?.nombre || t.servicio_nombre || "Servicio";
      const ref = map.get(sid) || { count: 0, amount: 0, nombre };
      ref.count += 1;
      ref.amount += precioTurno(t) || 0;
      map.set(sid, ref);
    });
    const arr = [...map.entries()].map(([sid, v]) => ({ servicio_id: sid, ...v }));
    arr.sort((a, b) => b.count - a.count);
    return arr;
  }, [confirmados, serviciosMap]);

  const colorByServicio = useMemo(() => {
    const m = new Map();
    agregadosServicio.forEach((item, i) => m.set(item.servicio_id, PALETTE[i % PALETTE.length]));
    return m;
  }, [agregadosServicio]);

  // Tabla (confirmados por defecto)
  const [includeCancelled, setIncludeCancelled] = useState(false);
  const tablaTurnos = useMemo(() => {
    const base = includeCancelled ? [...turnos] : [...confirmados];
    base.sort((a, b) => {
      const da = a.inicio ? new Date(a.inicio).getTime() : 0;
      const db = b.inicio ? new Date(b.inicio).getTime() : 0;
      return da - db;
    });
    return base.map((t) => {
      const d = t.inicio ? new Date(t.inicio) : null;
      const svc = serviciosMap.get(String(t.servicio_id));
      return {
        id: t.id,
        fecha: d && !isNaN(d) ? format(d, "dd/MM/yyyy", { locale: es }) : "—",
        hora: d && !isNaN(d) ? format(d, "HH:mm") : "—",
        cliente: t.cliente_nombre || "—",
        servicio: (svc?.nombre || t.servicio_nombre || "Servicio"),
        precio: precioTurno(t) || 0,
        estado: t.estado || "confirmado",
      };
    });
  }, [turnos, confirmados, includeCancelled, serviciosMap]);

  // Paginación
  useEffect(() => setPage(1), [tablaTurnos]);
  const totalRows = tablaTurnos.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const paginatedTurnos = useMemo(() => {
    const start = (page - 1) * pageSize;
    return tablaTurnos.slice(start, start + pageSize);
  }, [tablaTurnos, page, pageSize]);
  const rangeFrom = totalRows === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeTo = Math.min(page * pageSize, totalRows);
  const goPrev = () => setPage((p) => Math.max(1, p - 1));
  const goNext = () => setPage((p) => Math.min(totalPages, p + 1));

  const Header = ({ title, subtitle, childrenRight = null }) => (
    <header className="rounded-3xl bg-gradient-to-r from-blue-600 to-cyan-400 p-5 md:p-6 text-white shadow mx-4 mt-4">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">{title}</h1>
            {subtitle && <p className="text-sm md:text-base/relaxed opacity-90">{subtitle}</p>}
          </div>
          {childrenRight}
        </div>
      </div>
    </header>
  );

  if (!emprendedor) {
    return (
      <div className="min-h-[100dvh] flex flex-col">
        <Header title="Estadísticas" subtitle="Panel disponible sólo para cuentas de Emprendedor." />
        <main className="mx-auto w-full max-w-6xl px-4 py-6 space-y-6">
          <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h3 className="text-base font-semibold text-slate-900">Acceso restringido</h3>
            <p className="mt-1 text-sm text-slate-600">Para ver tus estadísticas activá tu plan de <b>Emprendedor</b>.</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <a href="/perfil" className="rounded-xl bg-sky-600 text-white px-4 py-2 text-sm font-semibold shadow hover:bg-sky-700">Ir a Perfil</a>
              <a href="/" className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-50">Volver al inicio</a>
            </div>
          </section>
        </main>
      </div>
    );
  }

  const totalConfirmados = confirmados.length || 1;

  return (
    <div className="min-h-[100dvh] flex flex-col">
      <Header title="Estadísticas" subtitle="Desempeño, distribución por servicio e ingresos del período." />
      <main className="mx-auto w-full max-w-6xl px-4 py-6 space-y-6">
        {/* Filtros */}
        <section className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-end gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-slate-700">Desde</label>
              <input type="date" className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500" value={desde} onChange={(e) => setDesde(e.target.value)} />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-slate-700">Hasta</label>
              <input type="date" className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500" value={hasta} onChange={(e) => setHasta(e.target.value)} />
            </div>
            <div className="flex items-end gap-2">
              <button onClick={onApplyRange} disabled={loading} className="rounded-xl bg-sky-600 text-white px-4 py-2 text-sm font-semibold shadow hover:bg-sky-700 disabled:opacity-60">
                {loading ? "Cargando..." : "Aplicar"}
              </button>
              <button
                type="button"
                onClick={() => {
                  const n = new Date();
                  const d = new Date(n.getFullYear(), n.getMonth() - 1, 1);
                  const h = new Date(n.getFullYear(), n.getMonth(), 0);
                  setDesde(toISODate(d));
                  setHasta(toISODate(h));
                  setTimeout(() => onApplyRange(), 0);
                }}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-50"
              >
                Mes pasado
              </button>
            </div>
          </div>
          {emptyMsg && (
            <div className="mt-3 rounded-xl px-3 py-2 text-sm bg-amber-50 text-amber-800 ring-1 ring-amber-200">
              {emptyMsg}
            </div>
          )}
        </section>

        {/* KPIs */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPI title="Ingresos totales" value={currency.format(ingresosTotales || 0)} />
          <KPI title="Confirmados" value={confirmados.length} />
          <KPI title="Cancelados" value={cancelados.length} />
          <KPI title="Ticket promedio" value={currency.format(ticketPromedio || 0)} />
        </section>

        {/* Gráficos */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card title="Cantidad por servicio" subtitle={`${confirmados.length} turnos`}>
            <Donut data={agregadosServicio.map((x, i) => ({
              name: x.nombre,
              value: Number(x.count || 0),
              color: PALETTE[i % PALETTE.length],
            }))} />
          </Card>

          <Card title="Ingresos por servicio" subtitle={currency.format(ingresosTotales || 0)}>
            <Donut data={agregadosServicio.map((x, i) => ({
              name: x.nombre,
              value: Number(x.amount || 0),
              color: PALETTE[i % PALETTE.length],
            }))} />
          </Card>

          <Card title="Estados de turnos" subtitle={`${confirmados.length + cancelados.length} totales`}>
            <Donut data={[
              { name: "Confirmados", value: confirmados.length, color: "#16a34a" },
              { name: "Cancelados", value: cancelados.length, color: "#94a3b8" },
            ]} />
          </Card>

          {/* Leyenda */}
          <div className="bg-white rounded-2xl border border-slate-200 px-4 pt-4 pb-1 shadow-sm">
            <h3 className="text-base font-semibold text-slate-900 mb-2">Servicios (leyenda)</h3>
            {agregadosServicio.length === 0 ? (
              <p className="text-sm text-slate-500">Sin datos en el período.</p>
            ) : (
              <ul className="grid grid-cols-1 gap-2 h-72 overflow-y-auto">
                {agregadosServicio.map((s, idx) => {
                  const base = confirmados.length || 1;
                  const pct = Math.round(((s.count || 0) / base) * 100);
                  const color = PALETTE[idx % PALETTE.length];
                  return (
                    <li key={s.servicio_id + "-" + idx} className="w-full flex items-start justify-between rounded-xl border border-slate-200 px-3 py-2">
                      <div className="flex items-start gap-2 min-w-0 flex-1">
                        <span className="mt-1 inline-block h-3 w-3 rounded-full" style={{ background: color }} />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-slate-800 leading-snug break-words whitespace-normal">
                            {s.nombre}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 pl-3">
                        <span className="text-xs text-slate-500 tabular-nums">{pct}%</span>
                        <span className="text-xs font-medium text-slate-700 tabular-nums">{s.count}</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        {/* Historial */}
        <section className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-3">
            <h3 className="text-base font-semibold text-slate-900">Historial del período</h3>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300"
                  checked={includeCancelled}
                  onChange={(e) => setIncludeCancelled(e.target.checked)}
                />
                Incluir cancelados
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <span>Filas por página</span>
                <select
                  className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm"
                  value={pageSize}
                  onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                >
                  {[5, 10, 20, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
              <div className="flex items-center gap-2">
                <button
                  onClick={goPrev}
                  disabled={page <= 1 || totalRows === 0}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
                >
                  Anterior
                </button>
                <span className="text-sm text-slate-600 tabular-nums">
                  {rangeFrom}-{rangeTo} de {totalRows}
                </span>
                <button
                  onClick={goNext}
                  disabled={page >= totalPages || totalRows === 0}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
                >
                  Siguiente
                </button>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="py-2 pr-4">Fecha</th>
                  <th className="py-2 pr-4">Hora</th>
                  <th className="py-2 pr-4">Cliente</th>
                  <th className="py-2 pr-4">Servicio</th>
                  <th className="py-2 pr-4">Precio</th>
                  <th className="py-2 pr-4">Estado</th>
                </tr>
              </thead>
              <tbody>
                {paginatedTurnos.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-slate-500">
                      {emptyMsg || "Sin turnos en el período seleccionado."}
                    </td>
                  </tr>
                ) : (
                  paginatedTurnos.map((r) => (
                    <tr key={r.id} className="border-t border-slate-100">
                      <td className="py-2 pr-4 text-slate-800">{r.fecha}</td>
                      <td className="py-2 pr-4 text-slate-800">{r.hora}</td>
                      <td className="py-2 pr-4 text-slate-800">{r.cliente}</td>
                      <td className="py-2 pr-4 text-slate-800">{r.servicio}</td>
                      <td className="py-2 pr-4">
                        {r.estado === "cancelado" ? "—" : currency.format(r.precio || 0)}
                      </td>
                      <td className="py-2 pr-4">
                        <span className={[
                          "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                          r.estado === "cancelado" ? "bg-slate-100 text-slate-600" : "bg-green-100 text-green-700",
                        ].join(" ")}>
                          {r.estado}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
