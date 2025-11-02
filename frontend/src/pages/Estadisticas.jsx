// src/pages/Estadisticas.jsx
import { useEffect, useMemo, useState } from "react";
import { useUser } from "../context/UserContext.jsx";
import api from "../services/api";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { format } from "date-fns";
import es from "date-fns/locale/es";

const PALETTE = [
  "#2563eb", "#0ea5e9", "#22c55e", "#f59e0b", "#ef4444", "#9333ea",
  "#14b8a6", "#f97316", "#84cc16", "#8b5cf6", "#06b6d4", "#dc2626",
];

const currency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

function toISODate(d) {
  if (!d) return null;
  const dt = new Date(d);
  dt.setHours(0, 0, 0, 0);
  return dt.toISOString().slice(0, 10);
}

// Normaliza roles
function isUserEmprendedor(user) {
  if (!user) return false;
  const roles = Array.isArray(user.roles)
    ? user.roles.map((r) =>
        typeof r === "string" ? r.toLowerCase() : String(r?.nombre || "").toLowerCase()
      )
    : [];
  const rolCompat = String(user.rol || "").toLowerCase();
  return (
    roles.includes("emprendedor") ||
    rolCompat === "emprendedor" ||
    !!user.is_emprendedor ||
    !!user.es_emprendedor
  );
}

function arr(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.results)) return data.results;
  return [];
}

function safeNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export default function Estadisticas() {
  const { user } = useUser();

  // Rango por defecto: mes actual
  const now = new Date();
  const defaultDesde = new Date(now.getFullYear(), now.getMonth(), 1);
  const defaultHasta = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const [desde, setDesde] = useState(toISODate(defaultDesde));
  const [hasta, setHasta] = useState(toISODate(defaultHasta));

  const [servicios, setServicios] = useState([]);
  const [turnos, setTurnos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [includeCancelled, setIncludeCancelled] = useState(false);
  const [debugMsg, setDebugMsg] = useState("");

  const emprendedor = isUserEmprendedor(user);

  async function loadData() {
    if (!emprendedor) return;
    setLoading(true);
    setDebugMsg("");

    // Tu back acepta /turnos/mis con params desde/hasta (ISO)
    const p = {
      desde: new Date(`${desde}T00:00:00.000Z`).toISOString(),
      hasta: new Date(`${hasta}T23:59:59.999Z`).toISOString(),
    };

    try {
      const [servRes, turRes] = await Promise.all([
        api.get("/servicios/mis"),
        api.get("/turnos/mis", { params: p }),
      ]);
      const sv = arr(servRes.data);
      const tv = arr(turRes.data);
      setServicios(sv);
      setTurnos(tv);
      setDebugMsg(`OK /servicios/mis -> ${sv.length} · OK /turnos/mis -> ${tv.length}`);
    } catch (e) {
      console.error(e);
      setServicios([]);
      setTurnos([]);
      setDebugMsg("Error cargando /servicios/mis o /turnos/mis");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emprendedor]);

  const onApplyRange = () => loadData();

  // Map de servicios
  const serviciosMap = useMemo(() => {
    const m = new Map();
    servicios.forEach((s) => m.set(Number(s.id), s));
    return m;
  }, [servicios]);

  // Precio (para ingresos consideramos solo confirmados)
  function precioTurno(t) {
    if ((t.estado || "confirmado") !== "confirmado") return 0;
    const p = t?.precio_aplicado;
    if (typeof p === "number" && p > 0) return p;
    const s = serviciosMap.get(Number(t.servicio_id));
    return safeNum(s?.precio ?? 0);
  }

  // Estados
  const confirmados = useMemo(
    () => turnos.filter((t) => (t.estado || "confirmado") === "confirmado"),
    [turnos]
  );
  const cancelados = useMemo(
    () => turnos.filter((t) => (t.estado || "") === "cancelado"),
    [turnos]
  );

  // KPIs
  const ingresosTotales = useMemo(
    () => confirmados.reduce((acc, t) => acc + precioTurno(t), 0),
    [confirmados]
  );
  const ticketPromedio = useMemo(() => {
    const c = confirmados.length;
    return c > 0 ? Math.round(ingresosTotales / c) : 0;
  }, [ingresosTotales, confirmados]);

  // Agregados por servicio
  const agregadosServicio = useMemo(() => {
    const map = new Map();
    confirmados.forEach((t) => {
      const sid = Number(t.servicio_id) || 0;
      const svc = serviciosMap.get(sid);
      const ref = map.get(sid) || { count: 0, amount: 0, nombre: svc?.nombre || "Servicio" };
      ref.count += 1;
      ref.amount += precioTurno(t);
      map.set(sid, ref);
    });
    const arr = [...map.entries()].map(([sid, v]) => ({ servicio_id: sid, ...v }));
    arr.sort((a, b) => b.count - a.count);
    return arr;
  }, [confirmados, serviciosMap]);

  // Colores consistentes
  const colorByServicio = useMemo(() => {
    const m = new Map();
    agregadosServicio.forEach((item, i) => {
      m.set(item.servicio_id, PALETTE[i % PALETTE.length]);
    });
    return m;
  }, [agregadosServicio]);

  // Donuts
  const pieCantidad = agregadosServicio.map((x) => ({
    name: x.nombre,
    value: x.count,
    color: colorByServicio.get(x.servicio_id),
  }));
  const pieIngresos = agregadosServicio.map((x) => ({
    name: x.nombre,
    value: x.amount,
    color: colorByServicio.get(x.servicio_id),
  }));
  const totalConfirmados = confirmados.length || 1;

  const pieEstados = [
    { name: "Confirmados", value: confirmados.length, color: "#16a34a" },
    { name: "Cancelados", value: cancelados.length, color: "#94a3b8" },
  ];

  // Tabla
  const tablaTurnos = useMemo(() => {
    const base = includeCancelled ? [...confirmados, ...cancelados] : confirmados;
    const sorted = [...base].sort(
      (a, b) =>
        new Date(a.inicio || a.desde || a.datetime) - new Date(b.inicio || b.desde || b.datetime)
    );
    return sorted.map((t) => {
      const d = new Date(t.inicio || t.desde || t.datetime);
      const svc = serviciosMap.get(Number(t.servicio_id));
      return {
        id: t.id ?? t.turno_id ?? t.uuid,
        fecha: isNaN(d) ? "—" : format(d, "dd/MM/yyyy", { locale: es }),
        hora: isNaN(d) ? "—" : format(d, "HH:mm"),
        cliente: t.cliente_nombre || t?.cliente?.nombre || "—",
        servicio: svc?.nombre || t?.servicio?.nombre || "Servicio",
        precio: precioTurno(t),
        estado: t.estado || "confirmado",
      };
    });
  }, [confirmados, cancelados, includeCancelled, serviciosMap]);

  // UI
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
            <p className="mt-1 text-sm text-slate-600">
              Para ver tus estadísticas activá tu plan de <b>Emprendedor</b>.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <a href="/perfil" className="rounded-xl bg-sky-600 text-white px-4 py-2 text-sm font-semibold shadow hover:bg-sky-700">Ir a Perfil</a>
              <a href="/" className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-50">Volver al inicio</a>
            </div>
          </section>
        </main>
      </div>
    );
  }

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
            <div className="flex items-end">
              <button onClick={onApplyRange} disabled={loading} className="rounded-xl bg-sky-600 text-white px-4 py-2 text-sm font-semibold shadow hover:bg-sky-700 disabled:opacity-60">
                {loading ? "Cargando..." : "Aplicar"}
              </button>
            </div>
          </div>
          {debugMsg && <p className="mt-2 text-[11px] text-slate-500 break-words">{debugMsg}</p>}
        </section>

        {/* KPIs */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPI title="Ingresos totales" value={currency.format(ingresosTotales)} />
          <KPI title="Confirmados" value={confirmados.length} />
          <KPI title="Cancelados" value={cancelados.length} />
          <KPI title="Ticket promedio" value={currency.format(ticketPromedio)} />
        </section>

        {/* Donuts */}
        <section className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-4">
          <Card title="Cantidad por servicio" subtitle={`${confirmados.length} turnos`}>
            <Donut data={pieCantidad} />
          </Card>
          <Card title="Ingresos por servicio" subtitle={currency.format(ingresosTotales)}>
            <Donut data={pieIngresos} />
          </Card>
          <Card title="Estados de turnos" subtitle={`${confirmados.length + cancelados.length} totales`}>
            <Donut data={pieEstados} />
          </Card>

          {/* Leyenda */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
            <h3 className="text-base font-semibold text-slate-900 mb-2">Servicios (leyenda)</h3>
            {agregadosServicio.length === 0 ? (
              <p className="text-sm text-slate-500">Sin datos en el período.</p>
            ) : (
              <ul className="grid grid-cols-1 gap-2">
                {agregadosServicio.map((s, idx) => {
                  const pct = Math.round((s.count / (totalConfirmados || 1)) * 100);
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
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-semibold text-slate-900">Historial del período</h3>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" className="h-4 w-4 rounded border-slate-300" checked={includeCancelled} onChange={(e) => setIncludeCancelled(e.target.checked)} />
              Incluir cancelados
            </label>
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
                {tablaTurnos.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="py-6 text-center text-slate-500">
                      Sin turnos en el período seleccionado.
                    </td>
                  </tr>
                ) : (
                  tablaTurnos.map((r) => (
                    <tr key={r.id} className="border-t border-slate-100">
                      <td className="py-2 pr-4 text-slate-800">{r.fecha}</td>
                      <td className="py-2 pr-4 text-slate-800">{r.hora}</td>
                      <td className="py-2 pr-4 text-slate-800">{r.cliente}</td>
                      <td className="py-2 pr-4 text-slate-800">{r.servicio}</td>
                      <td className="py-2 pr-4">
                        {r.estado === "cancelado" ? "—" : currency.format(r.precio || 0)}
                      </td>
                      <td className="py-2 pr-4">
                        <span className={["inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", r.estado === "cancelado" ? "bg-slate-100 text-slate-600" : "bg-green-100 text-green-700"].join(" ")}>
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

        {/* Recomendaciones */}
        <section className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <h3 className="text-base font-semibold text-slate-900 mb-2">Recomendaciones</h3>
          <ul className="list-disc pl-5 text-sm text-slate-700 space-y-1">
            <li><strong>Ticket promedio</strong> = promedio cobrado por turno confirmado del período.</li>
            <li>Los gráficos por servicio usan sólo confirmados. El de <em>Estados</em> incluye cancelados.</li>
            <li>Si tus precios vienen en centavos desde el back, avisame y ajusto la conversión.</li>
          </ul>
        </section>
      </main>
    </div>
  );
}

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
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius="55%"
          outerRadius="85%"
          paddingAngle={2}
          isAnimationActive
          labelLine={false}
          label={({ percent }) => `${Math.round((percent || 0) * 100)}%`}
        >
          {data.map((entry, idx) => (
            <Cell key={`slice-${idx}`} fill={entry.color} />
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
