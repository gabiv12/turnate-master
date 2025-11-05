// src/pages/AdminReportes.jsx
import { useEffect, useMemo, useState } from "react";
import api from "../services/api";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  LineChart, Line,
} from "recharts";
import { format } from "date-fns";
import es from "date-fns/locale/es";

const PALETTE = [
  "#2563eb", "#0ea5e9", "#22c55e", "#f59e0b", "#ef4444", "#9333ea",
  "#14b8a6", "#f97316", "#84cc16", "#8b5cf6", "#06b6d4", "#dc2626",
];

const currency = new Intl.NumberFormat("es-AR", {
  style: "currency", currency: "ARS", maximumFractionDigits: 0,
});

function toLocalYMD(dateLike) {
  const d = dateLike instanceof Date ? dateLike : new Date(dateLike);
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}
function addDaysYMD(ymd, n) {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + n);
  return toLocalYMD(dt);
}
function diffDaysYMD(a, b) {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  const A = new Date(ay, am - 1, ad);
  const B = new Date(by, bm - 1, bd);
  return Math.round((B - A) / 86400000);
}
function spanToISOString(desdeYMD, hastaYMD) {
  const [y1, m1, d1] = desdeYMD.split("-").map(Number);
  const [y2, m2, d2] = hastaYMD.split("-").map(Number);
  const start = new Date(Date.UTC(y1, m1 - 1, d1, 0, 0, 0, 0));
  const end   = new Date(Date.UTC(y2, m2 - 1, d2, 23, 59, 59, 999));
  return { desdeISO: start.toISOString(), hastaISO: end.toISOString() };
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

function normList(resp) {
  if (!resp) return [];
  if (Array.isArray(resp)) return resp;
  if (Array.isArray(resp.items)) return resp.items;
  if (Array.isArray(resp.results)) return resp.results;
  if (Array.isArray(resp.data)) return resp.data;
  const onlyKey = Object.keys(resp || {}).find((k) => Array.isArray(resp[k]));
  if (onlyKey) return resp[onlyKey];
  return [];
}

function mapTurno(t) {
  const inicioRaw = t.inicio ?? t.desde ?? t.start ?? t.datetime ?? t.fecha_inicio ?? t.fecha;
  const dt = inicioRaw ? new Date(inicioRaw) : null;
  const fechaISO = dt && !isNaN(dt) ? dt.toISOString().slice(0,10) : null;
  const servicio = t.servicio_nombre ?? t.servicio ?? t?.servicio?.nombre ?? "Servicio";
  const precio = Number(t.precio || t.precio_aplicado || t.monto || 0);
  const estado = String(t.estado ?? "confirmado");

  return {
    id: String(t.id ?? t.uuid ?? `${servicio}-${inicioRaw ?? Math.random()}`),
    fechaISO,
    fecha: dt && !isNaN(dt) ? format(dt, "dd/MM/yyyy", { locale: es }) : "—",
    hora:  dt && !isNaN(dt) ? format(dt, "HH:mm") : "—",
    cliente: t.cliente_nombre || t.cliente || t?.cliente?.nombre || "—",
    servicio,
    precio,
    estado,
  };
}

export default function AdminReportes() {
  const now = new Date();
  const ymdToday = toLocalYMD(now);
  const ymd30 = addDaysYMD(ymdToday, -30 + 1);

  const [desde, setDesde] = useState(ymd30);
  const [hasta, setHasta] = useState(ymdToday);

  const [kpis, setKpis] = useState({ usuarios: 0, emprendedores: 0, turnos: 0, cancelados: 0, ingresos: 0 });
  const [prevKpis, setPrevKpis] = useState({ usuarios: 0, emprendedores: 0, turnos: 0, cancelados: 0, ingresos: 0 });
  const [servAgg, setServAgg] = useState([]);
  const [turnos, setTurnos] = useState([]);

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [info, setInfo] = useState("");

  const presets = [
    { label: "Últimos 7 días", range: () => {
      const h = toLocalYMD(new Date());
      const d = addDaysYMD(h, -6);
      return { d, h };
    }},
    { label: "Últimos 30 días", range: () => {
      const h = toLocalYMD(new Date());
      const d = addDaysYMD(h, -29);
      return { d, h };
    }},
    { label: "Este mes", range: () => {
      const base = new Date();
      const d = toLocalYMD(new Date(base.getFullYear(), base.getMonth(), 1));
      const h = toLocalYMD(new Date(base.getFullYear(), base.getMonth() + 1, 0));
      return { d, h };
    }},
    { label: "Año en curso", range: () => {
      const y = new Date().getFullYear();
      const d = toLocalYMD(new Date(y, 0, 1));
      const h = toLocalYMD(new Date(y, 11, 31));
      return { d, h };
    }},
  ];

  async function getJSON(url, params) {
    const r = await api.get(url, { params });
    return r.data;
  }

  async function tryAdminLiteOrFallback(span, prevSpan) {
    setInfo("");
    try {
      const [kpisData, aggData, tData] = await Promise.all([
        getJSON("/admin-lite/kpis", { desde: span.desdeISO, hasta: span.hastaISO }),
        getJSON("/admin-lite/servicios-agg", { desde: span.desdeISO, hasta: span.hastaISO }),
        getJSON("/admin-lite/turnos", { desde: span.desdeISO, hasta: span.hastaISO, limit: 1000 }),
      ]);
      const prevKpisData = await getJSON("/admin-lite/kpis", { desde: prevSpan.desdeISO, hasta: prevSpan.hastaISO });
      return { mode: "lite", kpisData, aggData, tData, prevKpisData };
    } catch {
      try {
        const resumen = await getJSON("/admin/resumen", {});
        const kpisData = {
          usuarios: Number(resumen.total_usuarios || 0),
          emprendedores: Number(resumen.total_emprendedores || 0),
          turnos: Number(resumen.turnos_mes || 0),
          cancelados: 0,
          ingresos: 0,
        };
        const prevKpisData = { usuarios: 0, emprendedores: 0, turnos: 0, cancelados: 0, ingresos: 0 };
        setInfo("Estás viendo un resumen mensual. Para reportes detallados, habilitá /admin-lite/* en el backend.");
        return { mode: "resumen", kpisData, aggData: [], tData: [], prevKpisData };
      } catch (e2) {
        throw e2;
      }
    }
  }

  async function load() {
    setLoading(true);
    setMsg("");
    setInfo("");
    try {
      if (!desde || !hasta) {
        setMsg("Elegí un rango de fechas válido.");
        setLoading(false);
        return;
      }
      const span = spanToISOString(desde, hasta);

      const days = Math.max(1, diffDaysYMD(desde, hasta) + 1);
      const prevHasta = addDaysYMD(desde, -1);
      const prevDesde = addDaysYMD(prevHasta, -(days - 1));
      const prevSpan = spanToISOString(prevDesde, prevHasta);

      const { kpisData, aggData, tData } = await tryAdminLiteOrFallback(span, prevSpan);

      setKpis({
        usuarios: Number(kpisData.usuarios || 0),
        emprendedores: Number(kpisData.emprendedores || 0),
        turnos: Number(kpisData.turnos || 0),
        cancelados: Number(kpisData.cancelados || 0),
        ingresos: Number(kpisData.ingresos || 0),
      });

      try {
        const prev = await getJSON("/admin-lite/kpis", { desde: prevSpan.desdeISO, hasta: prevSpan.hastaISO });
        setPrevKpis({
          usuarios: Number(prev.usuarios || 0),
          emprendedores: Number(prev.emprendedores || 0),
          turnos: Number(prev.turnos || 0),
          cancelados: Number(prev.cancelados || 0),
          ingresos: Number(prev.ingresos || 0),
        });
      } catch {
        setPrevKpis({ usuarios: 0, emprendedores: 0, turnos: 0, cancelados: 0, ingresos: 0 });
      }

      const normAgg = Array.isArray(aggData)
        ? aggData.map((x) => ({
            servicio: x.servicio || x.nombre || "Servicio",
            cantidad: Number(x.cantidad || x.count || 0),
            ingresos: Number(x.ingresos || x.amount || 0),
          }))
        : [];
      setServAgg(normAgg);

      const rawArr = Array.isArray(tData) ? tData : normList(tData);
      const parsed = rawArr.map(mapTurno);
      setTurnos(parsed);

      if (!rawArr.length) {
        setInfo((prev) => prev || "No hay turnos en el período seleccionado.");
      }
    } catch (e) {
      const st = e?.response?.status;
      if (st === 401 || st === 403) {
        setMsg("Necesitás iniciar sesión con permisos de administrador para ver este panel.");
      } else if (st === 404) {
        setMsg("No se encontraron los endpoints de reportes. Verificá /admin-lite/* o /admin/resumen en el backend.");
      } else if (st === 405) {
        setMsg("El backend respondió 405 (método no permitido). Revisá que /admin-lite/* acepten GET.");
      } else {
        setMsg("No se pudieron cargar los datos. Revisá el backend.");
      }
      setKpis({ usuarios: 0, emprendedores: 0, turnos: 0, cancelados: 0, ingresos: 0 });
      setPrevKpis({ usuarios: 0, emprendedores: 0, turnos: 0, cancelados: 0, ingresos: 0 });
      setServAgg([]); setTurnos([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);
  const onApplyRange = () => load();

  const delta = {
    usuarios: pctDiff(kpis.usuarios, prevKpis.usuarios),
    emprendedores: pctDiff(kpis.emprendedores, prevKpis.emprendedores),
    turnos: pctDiff(kpis.turnos, prevKpis.turnos),
    cancelados: pctDiff(kpis.cancelados, prevKpis.cancelados),
    ingresos: pctDiff(kpis.ingresos, prevKpis.ingresos),
  };

  const pieCantidad = servAgg.map((x, i) => ({ name: x.servicio, value: x.cantidad, color: PALETTE[i % PALETTE.length] }));
  const pieIngresos = servAgg.map((x, i) => ({ name: x.servicio, value: x.ingresos, color: PALETTE[i % PALETTE.length] }));

  const topServicios = [...servAgg]
    .sort((a, b) => (b.cantidad || 0) - (a.cantidad || 0))
    .slice(0, 8);

  const turnosPorDia = useMemo(() => {
    const map = new Map();
    for (const t of turnos) {
      const k = t.fechaISO || "—";
      const ref = map.get(k) || { fecha: k, total: 0, confirmados: 0, cancelados: 0 };
      ref.total += 1;
      if ((t.estado || "").toLowerCase() === "cancelado") ref.cancelados += 1;
      else ref.confirmados += 1;
      map.set(k, ref);
    }
    const arr = [...map.values()].sort((a, b) => (a.fecha || "").localeCompare(b.fecha || ""));
    return arr;
  }, [turnos]);

  function exportCSV() {
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
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const totalCant = servAgg.reduce((a, x) => a + (x.cantidad || 0), 0);
  const totalIng = servAgg.reduce((a, x) => a + (x.ingresos || 0), 0);

  return (
    <div className="min-h-[100dvh] flex flex-col">
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
              <button
                onClick={load}
                className="rounded-xl bg-white/10 text-white px-4 py-2 text-sm font-semibold shadow hover:bg-white/20"
                title="Recargar datos"
              >
                Actualizar
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-6 space-y-6">
        {msg && (
          <div className="rounded-xl px-4 py-2 text-sm font-medium bg-red-50 text-red-700 ring-1 ring-red-200">
            {msg}
          </div>
        )}
        {info && !msg && (
          <div className="rounded-xl px-4 py-2 text-sm font-medium bg-amber-50 text-amber-800 ring-1 ring-amber-200">
            {info}
          </div>
        )}

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

        <section className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
          <KPI title="Usuarios" value={kpis.usuarios} delta={delta.usuarios} help="Cuentas registradas en total." />
          <KPI title="Emprendedores" value={kpis.emprendedores} delta={delta.emprendedores} help="Negocios activos." />
          <KPI title="Turnos" value={kpis.turnos} delta={delta.turnos} help="Turnos creados en el período." />
          <KPI title="Cancelados" value={kpis.cancelados} delta={delta.cancelados} help="Turnos cancelados." />
          <KPI title="Ingresos" value={currency.format(kpis.ingresos)} delta={delta.ingresos} help="Total cobrado por confirmados." />
        </section>

        <section className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <h3 className="text-base font-semibold text-slate-900 mb-2">Guía rápida</h3>
          <ul className="text-sm text-slate-700 list-disc pl-5 space-y-1">
            <li><b>Turnos</b> suma confirmados y cancelados. <b>Ingresos</b> usa solo confirmados.</li>
            <li>La flecha verde/roja compara con el <b>período anterior</b> (misma duración).</li>
            <li>Las <b>tortas</b> y <b>barras</b> muestran los servicios que más se usan/venden.</li>
            <li>El <b>gráfico de línea</b> muestra la actividad por día.</li>
          </ul>
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <Card title="Cantidad por servicio" subtitle={`${totalCant} turnos`}>
            <Donut data={pieCantidad} />
          </Card>
          <Card title="Ingresos por servicio" subtitle={currency.format(totalIng)}>
            <Donut data={pieIngresos} />
          </Card>
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
                      {info || "Sin turnos en el período seleccionado."}
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
                        {String(r.estado).toLowerCase() === "cancelado" ? "—" : currency.format(r.precio || 0)}
                      </td>
                      <td className="py-2 pr-4">
                        <span
                          className={[
                            "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                            String(r.estado).toLowerCase() === "cancelado"
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
  const safe = Array.isArray(data) ? data : [];
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
          {safe.map((entry, idx) => <Cell key={`slice-${idx}`} fill={entry.color || PALETTE[idx % PALETTE.length]} />)}
        </Pie>
        <Tooltip
          formatter={(v, n) => [typeof v === "number" ? v : 0, n]}
          contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0" }}
        />
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
