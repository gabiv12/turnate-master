// src/pages/Horarios.jsx
import { useEffect, useState } from "react";
import api from "../services/api";
import { useUser } from "../context/UserContext.jsx";

const BTN =
  "rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-sky-700 disabled:opacity-60";
const BOX =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 outline-none focus:ring-2 focus:ring-sky-300";
const LABEL = "block text-xs font-semibold text-sky-700 mb-1";

const DAYS = [
  { i: 1, name: "Lunes" },
  { i: 2, name: "Martes" },
  { i: 3, name: "Miércoles" },
  { i: 4, name: "Jueves" },
  { i: 5, name: "Viernes" },
  { i: 6, name: "Sábado" },
  { i: 0, name: "Domingo" },
];

function friendly(err) {
  const s = err?.response?.status;
  if (s === 401) return "Tu sesión se cerró. Iniciá sesión.";
  if (s === 403) return "No autorizado.";
  return err?.response?.data?.detail || err?.message || "No disponible por el momento.";
}

function hhmm(v) {
  if (!v) return "09:00";
  const [h = "09", m = "00"] = String(v).split(":");
  return `${h.padStart(2, "0")}:${m.padStart(2, "0")}`;
}

// ==== Normalización desde el backend (GET /horarios/mis) ====
function normalizeIn(data) {
  const items = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
  const grouped = new Map();

  items.forEach((h) => {
    const d = Number(h.dia_semana);
    const row = grouped.get(d) || {
      dia_semana: d,
      activo: false,
      intervalo_min: Number(h.intervalo_min ?? h.intervalo ?? 30),
      bloques: [],
    };
    row.activo = row.activo || h.activo !== false;
    row.intervalo_min = Number(h.intervalo_min ?? h.intervalo ?? row.intervalo_min ?? 30);
    row.bloques.push({ desde: hhmm(h.desde), hasta: hhmm(h.hasta) });
    grouped.set(d, row);
  });

  // Si un día no viene en la respuesta -> inactivo por defecto
  return DAYS.map((d) =>
    grouped.get(d.i) || {
      dia_semana: d.i,
      activo: false,
      intervalo_min: 30,
      bloques: [], // sin bloques => cerrado
    }
  );
}

// ==== Normalización para guardar (POST /horarios/mis) ====
function normalizeOut(rows) {
  // Formato agrupado { items: [ { dia_semana, activo, intervalo_min, bloques:[{desde,hasta}] } ] }
  const items = rows.map((r) => ({
    dia_semana: Number(r.dia_semana),
    activo: r.activo !== false,
    intervalo_min: Number(r.intervalo_min ?? 30),
    bloques: (r.bloques || []).map((b) => ({
      desde: hhmm(b.desde),
      hasta: hhmm(b.hasta),
    })),
  }));
  return { items };
}

export default function Horarios() {
  const { user } = useUser() || {};
  const [rows, setRows] = useState(() =>
    DAYS.map((d) => ({
      dia_semana: d.i,
      activo: false,
      intervalo_min: 30,
      bloques: [],
    }))
  );

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  // ====== Carga inicial ======
  useEffect(() => {
    (async () => {
      setLoading(true);
      setMsg("");
      try {
        // Garantiza que el usuario tenga emprendedor (opcional; si no, el GET /horarios/mis igual fallaría)
        try {
          await api.get("/usuarios/me/emprendedor");
        } catch {}
        const { data } = await api.get("/horarios/mis");
        setRows(normalizeIn(data));
      } catch (e) {
        setMsg(friendly(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ====== Helpers UI ======
  const setRow = (idx, patch) =>
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));

  const addBlock = (idx) =>
    setRows((prev) =>
      prev.map((r, i) =>
        i === idx
          ? { ...r, bloques: [...(r.bloques || []), { desde: "09:00", hasta: "12:00" }] }
          : r
      )
    );

  const removeBlock = (idx, bIdx) =>
    setRows((prev) =>
      prev.map((r, i) =>
        i === idx ? { ...r, bloques: (r.bloques || []).filter((_, j) => j !== bIdx) } : r
      )
    );

  // ====== Validaciones simples antes de guardar ======
  function validateRows(rs) {
    for (const r of rs) {
      if (r.activo && (!r.bloques || r.bloques.length === 0)) {
        return `En ${DAYS.find((d) => d.i === r.dia_semana)?.name}: agregá al menos un bloque.`;
      }
      for (const b of r.bloques || []) {
        const [h1, m1] = hhmm(b.desde).split(":").map(Number);
        const [h2, m2] = hhmm(b.hasta).split(":").map(Number);
        const a = h1 * 60 + m1;
        const z = h2 * 60 + m2;
        if (a >= z) {
          return `En ${DAYS.find((d) => d.i === r.dia_semana)?.name}: la hora "Desde" debe ser menor que "Hasta".`;
        }
      }
    }
    return null;
  }

  // ====== Guardar ======
  const onSave = async () => {
    setLoading(true);
    setMsg("");
    try {
      const v = validateRows(rows);
      if (v) {
        setMsg(v);
        setLoading(false);
        return;
      }
      const payload = normalizeOut(
        rows.map((r) => ({
          ...r,
          // si está inactivo, no mandamos bloques (queda cerrado)
          bloques: r.activo ? r.bloques : [],
        }))
      );
      await api.post("/horarios/mis", payload);
      setMsg("Horarios guardados.");
      // refrescar para ver lo que quedó efectivamente persistido
      const { data } = await api.get("/horarios/mis");
      setRows(normalizeIn(data));
    } catch (e) {
      setMsg(friendly(e));
    } finally {
      setLoading(false);
      setTimeout(() => setMsg(""), 2500);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header coherente con el resto */}
      <div className="-mx-4 lg:-mx-6 overflow-x-clip">
        <div className="rounded-3xl bg-gradient-to-r from-blue-600 to-cyan-400 p-5 md:p-6 text-white shadow">
          <div className="mx-auto max-w-7xl px-4 lg:px-6">
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Horarios</h1>
            <p className="text-sm md:text-base/relaxed opacity-90">
              Activá los días laborales y agregá uno o más bloques (por ejemplo, mañana y tarde). Elegí el
              intervalo para generar turnos dentro de cada bloque.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        {msg && (
          <div
            className={`mb-4 rounded-xl px-4 py-2 text-sm ${
              /cerró|error|No se pudo|403|404|405|422|500/i.test(msg)
                ? "bg-red-50 text-red-700 ring-1 ring-red-200"
                : "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
            }`}
          >
            {msg}
          </div>
        )}

        {/* Dos columnas en escritorio, una en móvil */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {rows.map((r, idx) => {
            const d = DAYS.find((x) => x.i === r.dia_semana);
            return (
              <div key={r.dia_semana} className="rounded-xl border border-slate-200 p-4">
                {/* Fila superior: nombre del día + interruptor */}
                <div className="flex items-center justify-between">
                  <div className="font-medium text-slate-900">{d?.name}</div>
                  <label className="inline-flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={r.activo !== false}
                      onChange={(e) => {
                        const activo = e.target.checked;
                        setRow(idx, {
                          activo,
                          // si se activa y no hay bloques, agregamos uno por defecto
                          bloques:
                            activo && (!r.bloques || r.bloques.length === 0)
                              ? [{ desde: "09:00", hasta: "13:00" }]
                              : r.bloques || [],
                        });
                      }}
                    />
                    <span>Activo</span>
                  </label>
                </div>

                {/* Intervalo */}
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className={LABEL}>Intervalo (min)</label>
                    <input
                      type="number"
                      min={5}
                      step={5}
                      value={Number(r.intervalo_min ?? 30)}
                      onChange={(e) =>
                        setRow(idx, { intervalo_min: Math.max(5, Number(e.target.value) || 30) })
                      }
                      className={BOX}
                    />
                  </div>
                </div>

                {/* Bloques (solo si el día está activo) */}
                {r.activo && (
                  <div className="mt-3 space-y-2">
                    <div className="text-xs font-semibold text-slate-700">Bloques</div>

                    {(r.bloques || []).map((b, bIdx) => (
                      <div key={bIdx} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className={LABEL}>Desde</label>
                          <input
                            type="time"
                            value={hhmm(b.desde)}
                            onChange={(e) => {
                              const bloques = [...(r.bloques || [])];
                              bloques[bIdx] = { ...bloques[bIdx], desde: e.target.value };
                              setRow(idx, { bloques });
                            }}
                            className={BOX}
                          />
                        </div>
                        <div>
                          <label className={LABEL}>Hasta</label>
                          <input
                            type="time"
                            value={hhmm(b.hasta)}
                            onChange={(e) => {
                              const bloques = [...(r.bloques || [])];
                              bloques[bIdx] = { ...bloques[bIdx], hasta: e.target.value };
                              setRow(idx, { bloques });
                            }}
                            className={BOX}
                          />
                        </div>
                        <div className="flex items-end">
                          <button
                            type="button"
                            onClick={() => removeBlock(idx, bIdx)}
                            className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold hover:bg-slate-50"
                          >
                            Quitar
                          </button>
                        </div>
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={() => addBlock(idx)}
                      className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold hover:bg-slate-50"
                    >
                      Agregar bloque
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Guardar */}
        <div className="mt-4">
          <button onClick={onSave} disabled={loading} className={BTN}>
            {loading ? "Guardando…" : "Guardar horarios"}
          </button>
        </div>
      </div>
    </div>
  );
}
