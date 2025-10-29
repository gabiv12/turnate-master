// src/pages/AdminReportes.jsx
import { useEffect, useMemo, useState } from "react";
import api from "../components/api"; // ⬅️ antes venía de "../services/api"
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
} from "recharts";
import { format } from "date-fns";
import es from "date-fns/locale/es";

// Paleta consistente con Estadísticas
const PALETTE = [
  "#2563eb", "#0ea5e9", "#22c55e", "#f59e0b", "#ef4444", "#9333ea",
  "#14b8a6", "#f97316", "#84cc16", "#8b5cf6", "#06b6d4", "#dc2626",
];

const currency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

// Helpers fechas ISO
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

export default function AdminReportes() {
  // Rango por defecto: últimos 30 días
  const now = new Date();
  const d30 = new Date(now);
  d30.setDate(now.getDate() - 30);
  const [desde, setDesde] = useState(toISODateOnly(d30));
  const [hasta, setHasta] = useState(toISODateOnly(now));

  // Datos
  const [kpis, setKpis] = useState({
    usuarios: 0, emprendedores: 0, turnos: 0, cancelados: 0, ingresos: 0,
  });
  const [servAgg, setServAgg] = useState([]);  // [{servicio, cantidad, ingresos}]
  const [turnos, setTurnos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  // Paginación
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;
  const totalPages = Math.max(1, Math.ceil(turnos.length / PAGE_SIZE));
  const pageItems = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return turnos.slice(start, start + PAGE_SIZE);
  }, [turnos, page]);
  const showingFrom = useMemo(
    () => (turnos.length ? (page - 1) * PAGE_SIZE + 1 : 0),
    [turnos.length, page]
  );
  const showingTo = useMemo(
    () => Math.min(page * PAGE_SIZE, turnos.length),
    [turnos.length, page]
  );
  const pages = useMemo(() => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const out = [1];
    if (page > 3) out.push("…");
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) out.push(i);
    if (page < totalPages - 2) out.push("…");
    out.push(totalPages);
    return out;
  }, [page, totalPages]);

  async function load() {
    setLoading(true);
    setMsg("");
    try {
      const { desdeISO, hastaISO } = spanToISOString(desde, hasta);

      // KPIs
      const kpisRes = await api.get("/admin-lite/kpis", {
        params: { desde: desdeISO, hasta: hastaISO },
      });

      // Agregados por servicio
      const aggRes = await api.get("/admin-lite/servicios-agg", {
        params: { desde: desdeISO, hasta: hastaISO },
      });

      // Turnos (máximo 200 para tabla paginada)
      const tRes = await api.get("/admin-lite/turnos", {
        params: { desde: desdeISO, hasta: hastaISO, limit: 200 },
      });

      setKpis({
        usuarios: Number(kpisRes?.data?.usuarios || 0),
        emprendedores: Number(kpisRes?.data?.emprendedores || 0),
        turnos: Number(kpisRes?.data?.turnos || 0),
        cancelados: Number(kpisRes?.data?.cancelados || 0),
        ingresos: Number(kpisRes?.data?.ingresos || 0),
      });

      const agg = Array.isArray(aggRes?.data) ? aggRes.data : [];
      // Normalizo campos esperados
      const normAgg = agg.map((x) => ({
        servicio: x.servicio || x.nombre || "Servicio",
        cantidad: Number(x.cantidad || x.count || 0),
        ingresos: Number(x.ingresos || x.amount || 0),
      }));
      setServAgg(normAgg);

      const raw = Array.isArray(tRes?.data) ? tRes.data : (Array.isArray(tRes?.data?.items) ? tRes.data.items : []);
      // Normalizo turnos para tabla
      const parsed = raw.map((t) => {
        const dt = new Date(t.inicio || t.desde || t.start || t.datetime);
        return {
          id: t.id,
          fecha: isNaN(dt) ? "—" : format(dt, "dd/MM/yyyy", { locale: es }),
          hora: isNaN(dt) ? "—" : format(dt, "HH:mm"),
          cliente: t.cliente_nombre || t.cliente || "—",
          servicio: t.servicio_nombre || t.servicio || "Servicio",
          precio: Number(t.precio || t.precio_aplicado || 0),
          estado: t.estado || "confirmado",
        };
      });
      setTurnos(parsed);
      setPage(1); // reseteo paginación al aplicar filtros
    } catch (e) {
      console.error("AdminReportes: error cargando", e);
      // Mensaje claro si el back responde 401 (solo admin)
      if (e?.response?.status === 401) {
        setMsg("Necesitás iniciar sesión con una cuenta de administrador para ver este panel.");
      } else {
        setMsg("⚠️ No se pudieron cargar los reportes. Verificá el backend /admin-lite.");
      }
      setKpis({ usuarios: 0, emprendedores: 0, turnos: 0, cancelados: 0, ingresos: 0 });
      setServAgg([]);
      setTurnos([]);
      setPage(1);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // carga inicial

  const onApplyRange = () => load();

  // Tortas (cantidad / ingresos por servicio)
  const pieCantidad = servAgg.map((x, i) => ({
    name: x.servicio,
    value: x.cantidad,
    color: PALETTE[i % PALETTE.length],
  }));
  const pieIngresos = servAgg.map((x, i) => ({
    name: x.servicio,
    value: x.ingresos,
    color: PALETTE[i % PALETTE.length],
  }));

  return (
    <div className="min-h-[100dvh] flex flex-col">
      {/* Header visual */}
      <header className="rounded-3xl bg-gradient-to-r from-blue-600 to-cyan-400 p-5 md:p-6 text-white shadow mx-4 mt-4">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-semibold">Reportes</h1>
              <p className="text-sm md:text-base/relaxed opacity-90">
                Panel de administración (solo lectura).
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-6 space-y-6">
        {/* Mensaje */}
        {msg && (
          <div
            className="rounded-xl px-4 py-2 text-sm font-medium bg-red-50 text-red-700 ring-1 ring-red-200"
          >
            {msg}
          </div>
        )}

        {/* Filtros de fecha */}
        <section className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-end gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-slate-700">Desde</label>
              <input
                type="date"
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                value={desde}
                onChange={(e) => setDesde(e.target.value)}
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-slate-700">Hasta</label>
              <input
                type="date"
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                value={hasta}
                onChange={(e) => setHasta(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={onApplyRange}
                disabled={loading}
                className="rounded-xl bg-sky-600 text-white px-4 py-2 text-sm font-semibold shadow hover:bg-sky-700 disabled:opacity-60"
              >
                {loading ? "Cargando..." : "Aplicar"}
              </button>
            </div>
          </div>
        </section>

        {/* KPIs */}
        <section className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <KPI title="Usuarios" value={kpis.usuarios} />
          <KPI title="Emprendedores" value={kpis.emprendedores} />
          <KPI title="Turnos" value={kpis.turnos} />
          <KPI title="Cancelados" value={kpis.cancelados} />
          <KPI title="Ingresos" value={currency.format(kpis.ingresos)} />
        </section>

        {/* Gráficos + leyenda */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card title="Cantidad por servicio" subtitle={`${servAgg.reduce((a, x) => a + (x.cantidad || 0), 0)} turnos`}>
            <Donut data={pieCantidad} />
          </Card>

          <Card title="Ingresos por servicio" subtitle={currency.format(servAgg.reduce((a, x) => a + (x.ingresos || 0), 0))}>
            <Donut data={pieIngresos} />
          </Card>

          {/* Leyenda */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
            <h3 className="text-base font-semibold text-slate-900 mb-2">
              Servicios (leyenda)
            </h3>
            {servAgg.length === 0 ? (
              <p className="text-sm text-slate-500">Sin datos en el período.</p>
            ) : (
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {servAgg.map((s, idx) => {
                  const total = servAgg.reduce((a, x) => a + (x.cantidad || 0), 0) || 1;
                  const pct = Math.round(((s.cantidad || 0) / total) * 100);
                  return (
                    <li
                      key={`${s.servicio}-${idx}`}
                      className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="inline-block h-3 w-3 rounded-full"
                          style={{ background: PALETTE[idx % PALETTE.length] }}
                        />
                        <span className="text-sm text-slate-800 truncate">{s.servicio}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-slate-500">{pct}%</span>
                        <span className="text-xs font-medium text-slate-700">{s.cantidad}</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        {/* Tabla turnos + paginación */}
        <section className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-semibold text-slate-900">
              Últimos turnos del período
            </h3>
            <span className="text-xs text-slate-500">
              {turnos.length ? `Mostrando ${showingFrom}–${showingTo} de ${turnos.length}` : "0 items"}
            </span>
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
                {pageItems.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="py-6 text-center text-slate-500">
                      Sin turnos en el período seleccionado.
                    </td>
                  </tr>
                ) : (
                  pageItems.map((r) => (
                    <tr key={r.id} className="border-t border-slate-100">
                      <td className="py-2 pr-4 text-slate-800">{r.fecha}</td>
                      <td className="py-2 pr-4 text-slate-800">{r.hora}</td>
                      <td className="py-2 pr-4 text-slate-800">{r.cliente}</td>
                      <td className="py-2 pr-4 text-slate-800">{r.servicio}</td>
                      <td className="py-2 pr-4 text-slate-800">
                        {r.estado === "cancelado" ? "—" : currency.format(r.precio || 0)}
                      </td>
                      <td className="py-2 pr-4">
                        <span
                          className={[
                            "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                            r.estado === "cancelado"
                              ? "bg-slate-100 text-slate-600"
                              : "bg-green-100 text-green-700",
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

          {/* Paginación */}
          <div className="mt-3 flex items-center justify-between">
            <p className="text-xs text-slate-500">
              {turnos.length ? `Mostrando ${showingFrom}–${showingTo} de ${turnos.length}` : "Sin datos"}
            </p>
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="btn-plain disabled:opacity-50"
                >
                  Anterior
                </button>

                {pages.map((p, i) =>
                  p === "…" ? (
                    <span key={`gap-${i}`} className="px-2 text-slate-500">…</span>
                  ) : (
                    <button
                      key={`p-${p}`}
                      onClick={() => setPage(Number(p))}
                      className={[
                        "px-3 py-2 rounded-xl text-sm font-medium",
                        p === page ? "bg-sky-600 text-white" : "bg-white border border-slate-300 hover:bg-slate-50",
                      ].join(" ")}
                    >
                      {p}
                    </button>
                  )
                )}

                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="btn-plain disabled:opacity-50"
                >
                  Siguiente
                </button>
              </div>
            )}
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
      <div className="w-full h-72 md:h-80">
        {children}
      </div>
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
