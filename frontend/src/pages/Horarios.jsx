// src/pages/Horarios.jsx
import { useEffect, useState } from "react";
import api, { errorMessage } from "../services/api";

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

// === helpers de tiempo/validación ===
function hhmm(v) {
  if (!v) return "09:00";
  const s = String(v);
  const [h = "09", m = "00"] = s.split(":"); // soporta "HH:MM" o "HH:MM:SS"
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
const validBlock = (b) => {
  const [h1, m1] = hhmm(b?.desde).split(":").map(Number);
  const [h2, m2] = hhmm(b?.hasta).split(":").map(Number);
  return h1 * 60 + m1 < h2 * 60 + m2;
};

function friendly(err) {
  if (typeof err === "string") return err;
  const s = err?.response?.status;
  if (s === 401) return "Tu sesión se cerró. Iniciá sesión.";
  if (s === 403) return "No autorizado.";
  return err?.response?.data?.detail || err?.message || "No disponible por el momento.";
}

// ==== Normalización robusta del GET /horarios/mis ====
function normalizeIn(data) {
  let rows;
  if (Array.isArray(data?.items)) rows = data.items;
  else if (Array.isArray(data)) rows = data;
  else if (data && typeof data === "object") {
    // también acepta objetos { "1": {...}, "2": {...} }
    const keys = Object.keys(data);
    const isMap = keys.length > 0 && keys.every((k) => !isNaN(Number(k)));
    if (isMap) rows = keys.map((k) => ({ dia_semana: Number(k), ...(data[k] || {}) }));
  }
  if (!Array.isArray(rows)) rows = [];

  const byDay = new Map();

  for (const r of rows) {
    const day = Number(r?.dia_semana ?? r?.dia ?? r?.day ?? 0);
    const interval = Number(r?.intervalo_min ?? r?.intervalo ?? 30) || 30;

    const blocks = [];
    if (Array.isArray(r?.bloques)) {
      for (const b of r.bloques) {
        blocks.push({
          desde: hhmm(b?.desde ?? b?.inicio ?? b?.start),
          hasta: hhmm(b?.hasta ?? b?.fin ?? b?.end),
        });
      }
    }
    // fila plana con tiempos
    if ((r?.desde || r?.inicio || r?.start) || (r?.hasta || r?.fin || r?.end)) {
      blocks.push({
        desde: hhmm(r?.desde ?? r?.inicio ?? r?.start ?? "09:00"),
        hasta: hhmm(r?.hasta ?? r?.fin ?? r?.end ?? "13:00"),
      });
    }

    const prev = byDay.get(day) || { dia_semana: day, intervalo_min: 30, bloques: [], _flags: [] };
    prev.intervalo_min = Number(interval ?? prev.intervalo_min ?? 30);
    prev.bloques.push(...blocks);
    const flag = r?.activo ?? r?.enabled ?? r?.is_active ?? r?.habilitado;
    if (flag !== undefined) prev._flags.push(Boolean(flag));
    byDay.set(day, prev);
  }

  // salida 0..6 con ‘activo’ calculado por bloques válidos o flags = true
  const out = [];
  for (let d = 0; d < 7; d++) {
    const row = byDay.get(d) || { dia_semana: d, intervalo_min: 30, bloques: [], _flags: [] };
    const hasValid = (row.bloques || []).some(validBlock);
    const flagTrue = (row._flags || []).some(Boolean);
    out.push({
      dia_semana: d,
      intervalo_min: Number(row.intervalo_min ?? 30) || 30,
      bloques: (row.bloques || []).map((b) => ({ desde: hhmm(b.desde), hasta: hhmm(b.hasta) })),
      activo: hasValid || flagTrue,
    });
  }
  return out;
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
        if (!validBlock(b)) {
          return `En ${DAYS.find((d) => d.i === r.dia_semana)?.name}: "Desde" debe ser menor que "Hasta".`;
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
      if (v) { setMsg(v); setLoading(false); return; }

      // si está inactivo, mandamos bloques vacíos (el back limpia)
      const payload = normalizeOut(
        rows.map((r) => ({ ...r, bloques: r.activo ? r.bloques : [] }))
      );

      await api.post("/horarios/mis", payload);

      // refrescar para ver lo persistido
      const { data } = await api.get("/horarios/mis");
      setRows(normalizeIn(data));
      setMsg("Horarios guardados.");
    } catch (e) {
      setMsg(errorMessage(e));
    } finally {
      setLoading(false);
      setTimeout(() => setMsg(""), 2500);
    }
  };

  return (
    <div className="space-y-4">
      {/* Encabezado consistente (no cambia estilos globales) */}
      <div className="-mx-4 lg:-mx-6 overflow-x-clip">
        <div className="rounded-3xl bg-gradient-to-r from-blue-600 to-cyan-400 p-5 md:p-6 text-white shadow">
          <div className="mx-auto max-w-7xl px-4 lg:px-6">
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Horarios</h1>
            <p className="text-sm md:text-base/relaxed opacity-90">
              Activá los días laborales y agregá uno o más bloques (por ejemplo, mañana y tarde).
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        {/* grilla de días */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {rows.map((r, idx) => {
            const d = DAYS.find((x) => x.i === r.dia_semana);
            return (
              <div key={r.dia_semana} className="rounded-xl border border-slate-200 p-4">
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

        {/* Guardar + mensaje al lado */}
        <div className="mt-4 flex items-center gap-3">
          <button onClick={onSave} disabled={loading} className={BTN}>
            {loading ? "Guardando…" : "Guardar horarios"}
          </button>

          {msg && (
            <div
              className={`rounded-xl px-3 py-2 text-sm ${
                /cerró|error|No se pudo|403|404|405|422|500/i.test(msg)
                  ? "bg-red-50 text-red-700 ring-1 ring-red-200"
                  : "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
              }`}
            >
              {msg}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
