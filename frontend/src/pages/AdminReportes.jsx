// src/pages/AdminReportes.jsx
import { useEffect, useMemo, useState } from "react";
import api from "../services/api"; // (unificado con el resto del proyecto)
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  LineChart, Line,
} from "recharts";
import { format } from "date-fns";
import es from "date-fns/locale/es";

/* ================================
   Estilo y helpers de formato
==================================*/
const PALETTE = [
  "#2563eb", "#0ea5e9", "#22c55e", "#f59e0b", "#ef4444", "#9333ea",
  "#14b8a6", "#f97316", "#84cc16", "#8b5cf6", "#06b6d4", "#dc2626",
];

const currency = new Intl.NumberFormat("es-AR", {
  style: "currency", currency: "ARS", maximumFractionDigits: 0,
});

function toISODateOnly(d) {
  if (!d) return null;
  const dt = new Date(d);
  dt.setHours(0, 0, 0, 0);
  return dt.toISOString().slice(0, 10);
}
function spanToISOString(desdeYYYYMMDD, hastaYYYYMMDD) {
  const d = new Date(`${desdeYYYYMMDD}T00:00:00.000Z`);
  const h = new Date(`${hastaYYYYMMDD}T23:59:59.999Z`);
  return { desdeISO: d.toISOString(), hastaISO: h.toISOString() };
}
function addDays(dateYYYYMMDD, num) {
  const d = new Date(`${dateYYYYMMDD}T00:00:00`);
  d.setDate(d.getDate() + num);
  return toISODateOnly(d);
}
function diffDays(aYYYYMMDD, bYYYYMMDD) {
  const a = new Date(`${aYYYYMMDD}T00:00:00`);
  const b = new Date(`${bYYYYMMDD}T00:00:00`);
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}
function pctDiff(current, previous) {
  const c = Number(current) || 0;
  const p = Number(previous) || 0;
  if (p === 0 && c === 0) return 0;
  if (p === 0) return 100;
  return Math.round(((c - p) / p) * 100);
}
function csvEscape(v) {
  return `"${String(v ?? "").replace(/"/g, '""')}"`;
}

/* ================================
   Página
==================================*/
export default function AdminReportes() {
  // Rango por defecto: últimos 30 días
  const now = new Date();
  const d30 = new Date(now); d30.setDate(now.getDate() - 30);
  const [desde, setDesde] = useState(toISODateOnly(d30));
  const [hasta, setHasta] = useState(toISODateOnly(now));

  // Datos actuales
  const [kpis, setKpis] = useState({ usuarios: 0, emprendedores: 0, turnos: 0, cancelados: 0, ingresos: 0 });
  const [servAgg, setServAgg] = useState([]);   // [{servicio, cantidad, ingresos}]
  const [turnos, setTurnos] = useState([]);

  // Datos período anterior (para comparar)
  const [prevKpis, setPrevKpis] = useState({ usuarios: 0, emprendedores: 0, turnos: 0, cancelados: 0, ingresos: 0 });

  // Estado UI
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  // Presets de fechas para “un click”
  const presets = [
    { label: "Últimos 7 días", range: () => {
      const h = toISODateOnly(now);
      const d = toISODateOnly(addDays(h, -6));
      return { d, h };
    }},
    { label: "Últimos 30 días", range: () => {
      const h = toISODateOnly(now);
      const d = toISODateOnly(addDays(h, -29));
      return { d, h };
    }},
    { label: "Este mes", range: () => {
      const y = now.getFullYear(), m = now.getMonth();
      const d = toISODateOnly(new Date(y, m, 1));
      const h = toISODateOnly(new Date(y, m + 1, 0));
      return { d, h };
    }},
    { label: "Año en curso", range: () => {
      const y = now.getFullYear();
      const d = toISODateOnly(new Date(y, 0, 1));
      const h = toISODateOnly(new Date(y, 11, 31));
      return { d, h };
    }},
  ];

  // Carga de datos
  async function load() {
    setLoading(true);
    setMsg("");
    try {
      // Período actual
      const { desdeISO, hastaISO } = spanToISOString(desde, hasta);

      // Período anterior de la misma duración
      const days = Math.max(1, diffDays(desde, hasta) + 1);
      const prevHasta = addDays(desde, -1);
      const prevDesde = addDays(prevHasta, -(days - 1));
      const prevSpan = spanToISOString(prevDesde, prevHasta);

      // Llamadas actuales
      const [kpisRes, aggRes, tRes, prevKpisRes] = await Promise.all([
        api.get("/admin-lite/kpis", { params: { desde: desdeISO, hasta: hastaISO } }),
        api.get("/admin-lite/servicios-agg", { params: { desde: desdeISO, hasta: hastaISO } }),
        api.get("/admin-lite/turnos", { params: { desde: desdeISO, hasta: hastaISO, limit: 200 } }),
        api.get("/admin-lite/kpis", { params: { desde: prevSpan.desdeISO, hasta: prevSpan.hastaISO } }),
      ]);

      // KPIs actuales y anteriores
      setKpis({
        usuarios: Number(kpisRes?.data?.usuarios || 0),
        emprendedores: Number(kpisRes?.data?.emprendedores || 0),
        turnos: Number(kpisRes?.data?.turnos || 0),
        cancelados: Number(kpisRes?.data?.cancelados || 0),
        ingresos: Number(kpisRes?.data?.ingresos || 0),
      });
      setPrevKpis({
        usuarios: Number(prevKpisRes?.data?.usuarios || 0),
        emprendedores: Number(prevKpisRes?.data?.emprendedores || 0),
        turnos: Number(prevKpisRes?.data?.turnos || 0),
        cancelados: Number(prevKpisRes?.data?.cancelados || 0),
        ingresos: Number(prevKpisRes?.data?.ingresos || 0),
      });

      // Agregados por servicio
      const agg = Array.isArray(aggRes?.data) ? aggRes.data : [];
      const normAgg = agg.map((x) => ({
        servicio: x.servicio || x.nombre || "Servicio",
        cantidad: Number(x.cantidad || x.count || 0),
        ingresos: Number(x.ingresos || x.amount || 0),
      }));
      setServAgg(normAgg);

      // Turnos tabla
      const raw = Array.isArray(tRes?.data) ? tRes.data
                 : (Array.isArray(tRes?.data?.items) ? tRes.data.items : []);
      const parsed = raw.map((t) => {
        const dt = new Date(t.inicio || t.desde || t.start || t.datetime);
        return {
          id: t.id,
          fechaISO: isNaN(dt) ? null : dt.toISOString().slice(0,10),
          fecha: isNaN(dt) ? "—" : format(dt, "dd/MM/yyyy", { locale: es }),
          hora: isNaN(dt) ? "—" : format(dt, "HH:mm"),
          cliente: t.cliente_nombre || t.cliente || "—",
          servicio: t.servicio_nombre || t.servicio || "Servicio",
          precio: Number(t.precio || t.precio_aplicado || 0),
          estado: t.estado || "confirmado",
        };
      });
      setTurnos(parsed);
    } catch (e) {
      console.error("AdminReportes: error cargando", e);
      if (e?.response?.status === 401) {
        setMsg("Necesitás iniciar sesión con una cuenta de administrador para ver este panel.");
      } else {
        setMsg("⚠️ No se pudieron cargar los datos. Verificá el backend /admin-lite.");
      }
      setKpis({ usuarios: 0, emprendedores: 0, turnos: 0, cancelados: 0, ingresos: 0 });
      setPrevKpis({ usuarios: 0, emprendedores: 0, turnos: 0, cancelados: 0, ingresos: 0 });
      setServAgg([]); setTurnos([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);
  const onApplyRange = () => load();

  // ======== Comparaciones (vs. período anterior) ========
  const delta = {
    usuarios: pctDiff(kpis.usuarios, prevKpis.usuarios),
    emprendedores: pctDiff(kpis.emprendedores, prevKpis.emprendedores),
    turnos: pctDiff(kpis.turnos, prevKpis.turnos),
    cancelados: pctDiff(kpis.cancelados, prevKpis.cancelados),
    ingresos: pctDiff(kpis.ingresos, prevKpis.ingresos),
  };

  // ======== Gráficos =========
  // Torta por cantidad / ingresos (servicios)
  const pieCantidad = servAgg.map((x, i) => ({ name: x.servicio, value: x.cantidad, color: PALETTE[i % PALETTE.length] }));
  const pieIngresos = servAgg.map((x, i) => ({ name: x.servicio, value: x.ingresos, color: PALETTE[i % PALETTE.length] }));

  // Barras: Top servicios por cantidad
  const topServicios = [...servAgg]
    .sort((a, b) => (b.cantidad || 0) - (a.cantidad || 0))
    .slice(0, 8);

  // Línea: Flujo de turnos por día (actividad)
  const turnosPorDia = useMemo(() => {
    const map = new Map(); // yyyy-mm-dd -> {fecha, total, confirmados, cancelados}
    for (const t of turnos) {
      const k = t.fechaISO || "—";
      const ref = map.get(k) || { fecha: k, total: 0, confirmados: 0, cancelados: 0 };
      ref.total += 1;
      if ((t.estado || "").toLowerCase() === "cancelado") ref.cancelados += 1;
      else ref.confirmados += 1;
      map.set(k, ref);
    }
    const arr = [...map.values()].sort((a, b) => a.fecha.localeCompare(b.fecha));
    return arr;
  }, [turnos]);

  // ======== Exportar CSV =========
  function exportCSV() {
    // encabezados claros
    const headers = [
      { key: "fecha", label: "Fecha" },
      { key: "hora", label: "Hora" },
      { key: "cliente", label: "Cliente" },
      { key: "servicio", label: "Servicio" },
      { key: "precio", label: "Precio" },
      { key: "estado", label: "Estado" },
    ];
    const head = headers.map(h => csvEscape(h.label)).join(",");
    const body = turnos.map(r =>
      headers.map(h => csvEscape(h.key === "precio" ? currency.format(r[h.key] || 0) : r[h.key])).join(",")
    ).join("\n");
    const blob = new Blob([head + "\n" + body], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `turnos_${desde}_a_${hasta}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Totales para subtítulos
  const totalCant = servAgg.reduce((a, x) => a + (x.cantidad || 0), 0);
  const totalIng = servAgg.reduce((a, x) => a + (x.ingresos || 0), 0);

  return (
    <div className="min-h-[100dvh] flex flex-col">
      {/* Header visual */}
      <header className="rounded-3xl bg-gradient-to-r from-blue-600 to-cyan-400 p-5 md:p-6 text-white shadow mx-4 mt-4">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-semibold">Panel de Administración</h1>
              <p className="text-sm md:text-base/relaxed opacity-90">
                Mirá qué está pasando en tu sistema: actividad, ingresos y servicios más usados.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={exportCSV}
                className="rounded-xl bg-white/10 text-white px-4 py-2 text-sm font-semibold shadow hover:bg-white/20"
                disabled={!turnos.length}
                title="Descargar la tabla como CSV"
              >
                Exportar CSV
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-6 space-y-6">
        {/* Mensaje */}
        {msg && (
          <div className="rounded-xl px-4 py-2 text-sm font-medium bg-red-50 text-red-700 ring-1 ring-red-200">
            {msg}
          </div>
        )}

        {/* Filtros de fecha + presets */}
        <section className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-end gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-slate-700">Desde</label>
              <input
                type="date"
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                value={desde}
                onChange={(e) => setDesde(e.target.value)}
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-slate-700">Hasta</label>
              <input
                type="date"
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                value={hasta}
                onChange={(e) => setHasta(e.target.value)}
              />
            </div>
            <div className="flex items-end gap-2">
              {presets.map((p) => (
                <button
                  key={p.label}
                  onClick={() => {
                    const r = p.range();
                    setDesde(r.d); setHasta(r.h);
                    setTimeout(onApplyRange, 0);
                  }}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold hover:bg-slate-50"
                >
                  {p.label}
                </button>
              ))}
              <button
                onClick={onApplyRange}
                disabled={loading}
                className="rounded-xl bg-blue-700 text-white px-4 py-2 text-sm font-semibold shadow hover:bg-blue-800 disabled:opacity-60"
              >
                {loading ? "Cargando..." : "Aplicar"}
              </button>
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Consejos: usá “Últimos 30 días” para ver la tendencia reciente. Probá “Año en curso” para mirar el acumulado.
          </p>
        </section>

        {/* KPIs + tendencia vs. período anterior */}
        <section className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
          <KPI title="Usuarios" value={kpis.usuarios} delta={delta.usuarios} help="Cuentas registradas en total." />
          <KPI title="Emprendedores" value={kpis.emprendedores} delta={delta.emprendedores} help="Negocios activos en la plataforma." />
          <KPI title="Turnos" value={kpis.turnos} delta={delta.turnos} help="Turnos creados en el período." />
          <KPI title="Cancelados" value={kpis.cancelados} delta={delta.cancelados} help="Turnos cancelados en el período." />
          <KPI title="Ingresos" value={currency.format(kpis.ingresos)} delta={delta.ingresos} help="Total cobrado por turnos confirmados." />
        </section>

        {/* ¿Qué estoy viendo? */}
        <section className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <h3 className="text-base font-semibold text-slate-900 mb-2">Guía rápida</h3>
          <ul className="text-sm text-slate-700 list-disc pl-5 space-y-1">
            <li><b>Turnos</b> suma confirmados y cancelados. <b>Ingresos</b> usa solo confirmados.</li>
            <li>La flecha verde/roja muestra el cambio respecto del <b>período anterior</b> (de igual duración).</li>
            <li>Las <b>tortas</b> y <b>barras</b> ayudan a detectar qué servicios se venden más.</li>
            <li>El <b>gráfico de línea</b> muestra la actividad diaria (subidas y bajadas).</li>
          </ul>
        </section>

        {/* Gráficos principales */}
        <section className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          {/* Tortas */}
          <Card title="Cantidad por servicio" subtitle={`${totalCant} turnos`}>
            <Donut data={pieCantidad} />
          </Card>
          <Card title="Ingresos por servicio" subtitle={currency.format(totalIng)}>
            <Donut data={pieIngresos} />
          </Card>
          {/* Barras: Top 8 servicios */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-base font-semibold text-slate-900">Top servicios (por cantidad)</h3>
              <span className="text-xs text-slate-500">Máx. 8</span>
            </div>
            <div className="w-full h-72 md:h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topServicios}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="servicio" tick={{ fontSize: 12 }} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="cantidad" fill="#2563eb" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>

        {/* Tendencia de actividad (línea) */}
        <section className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-base font-semibold text-slate-900">Actividad por día</h3>
            <span className="text-xs text-slate-500">Confirmados vs Cancelados</span>
          </div>
          <div className="w-full h-72 md:h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={turnosPorDia}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="fecha" tick={{ fontSize: 12 }} />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="confirmados" name="Confirmados" stroke="#22c55e" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="cancelados" name="Cancelados" stroke="#94a3b8" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Tabla turnos */}
        <section className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-semibold text-slate-900">Turnos del período</h3>
            <button
              onClick={exportCSV}
              className="rounded-xl bg-blue-700 text-white px-3 py-2 text-xs font-semibold shadow hover:bg-blue-800 disabled:opacity-60"
              disabled={!turnos.length}
            >
              Exportar CSV
            </button>
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
                {turnos.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="py-6 text-center text-slate-500">
                      Sin turnos en el período seleccionado.
                    </td>
                  </tr>
                ) : (
                  turnos.map((r) => (
                    <tr key={r.id} className="border-t border-slate-100">
                      <td className="py-2 pr-4 text-slate-800">{r.fecha}</td>
                      <td className="py-2 pr-4 text-slate-800">{r.hora}</td>
                      <td className="py-2 pr-4 text-slate-800">{r.cliente}</td>
                      <td className="py-2 pr-4 text-slate-800">{r.servicio}</td>
                      <td className="py-2 pr-4 text-slate-800">
                        {r.estado.toLowerCase() === "cancelado" ? "—" : currency.format(r.precio || 0)}
                      </td>
                      <td className="py-2 pr-4">
                        <span
                          className={[
                            "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                            r.estado.toLowerCase() === "cancelado"
                              ? "bg-slate-200 text-slate-700"
                              : "bg-emerald-100 text-emerald-700",
                          ].join(" ")}
                        >
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

/* ================================
   Subcomponentes
==================================*/
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
          {data.map((entry, idx) => <Cell key={`slice-${idx}`} fill={entry.color} />)}
        </Pie>
        <Tooltip formatter={(v, n) => [typeof v === "number" ? v : 0, n]} contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0" }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

function KPI({ title, value, delta = 0, help }) {
  const isUp = delta >= 0;
  const color = isUp ? "text-emerald-600" : "text-red-600";
  const bg = isUp ? "bg-emerald-50" : "bg-red-50";
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs text-slate-500">{title}</div>
      <div className="mt-1 text-xl font-semibold text-slate-900">{value}</div>
      <div className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${bg} ${color}`}>
        <span>{isUp ? "▲" : "▼"}</span>
        <span>{Math.abs(delta)}%</span>
      </div>
      {help && <div className="mt-1 text-xs text-slate-500">{help}</div>}
    </div>
  );
}
