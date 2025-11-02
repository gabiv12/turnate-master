// src/pages/Horarios.jsx
import { useEffect, useState } from "react";
import { api } from "../services/api";

const BTN = "rounded-xl bg-sky-600 text-white px-4 py-2 text-sm font-semibold shadow hover:bg-sky-700";
const dias = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

export default function Horarios() {
  const [owner, setOwner] = useState(null);
  const [items, setItems] = useState([]); // [{ dia_semana, hora_desde, hora_hasta, intervalo_min, activo }]

  useEffect(() => {
    (async () => {
      try {
        const me = await api.get("/emprendedores/mi");
        if (me?.data?.id) setOwner({ id: me.data.id });
      } catch {}
    })();
  }, []);

  const load = async () => {
    try {
      const rh = await api.get("/horarios/mis");
      setItems(Array.isArray(rh.data) ? rh.data : []);
    } catch {
      setItems([]);
    }
  };
  useEffect(() => { load(); }, [owner?.id]);

  const onChangeField = (idx, field, value) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, [field]: value } : it)));
  };

  const addBlock = () => {
    setItems((prev) => [
      ...prev,
      { dia_semana: 1, hora_desde: "09:00", hora_hasta: "18:00", intervalo_min: 30, activo: true },
    ]);
  };

  const remove = (idx) => setItems((prev) => prev.filter((_, i) => i !== idx));

  const saveAll = async () => {
    if (!owner?.id) return alert("Activá Emprendedor desde Perfil/Emprendimiento.");
    try {
      // el back reemplaza todo el set
      await api.put(`/emprendedores/${owner.id}/horarios:replace`, {
        horarios: items.map((h) => ({
          dia_semana: Number(h.dia_semana),
          hora_desde: (h.hora_desde || "09:00").slice(0, 5),
          hora_hasta: (h.hora_hasta || "18:00").slice(0, 5),
          intervalo_min: Number(h.intervalo_min || 30),
          activo: h.activo !== false,
        })),
      });
      alert("Horarios guardados.");
      await load();
    } catch {
      alert("No se pudieron guardar los horarios.");
    }
  };

  return (
    <div className="space-y-4">
      <header className="rounded-3xl bg-gradient-to-r from-blue-600 to-cyan-400 p-5 md:p-6 text-white shadow">
        <div className="mx-auto max-w-6xl">
          <h1 className="text-2xl font-semibold">Horarios</h1>
          <p className="text-sm opacity-90">Definí tus días y bloques disponibles.</p>
        </div>
      </header>

      <div className="mx-auto max-w-6xl rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <div className="font-medium text-slate-700">Bloques</div>
          <div className="flex gap-2">
            <button onClick={addBlock} className="rounded-xl bg-white text-sky-700 px-3 py-2 text-sm font-semibold ring-1 ring-sky-200 shadow">
              + Agregar
            </button>
            <button onClick={saveAll} className={BTN}>Guardar</button>
          </div>
        </div>

        {items.length === 0 ? (
          <div className="text-sm text-slate-500">No hay bloques cargados.</div>
        ) : (
          <div className="grid gap-3">
            {items.map((h, idx) => (
              <div key={idx} className="grid grid-cols-1 md:grid-cols-[100px_120px_120px_120px_auto] items-center gap-2 rounded-xl border border-slate-200 p-3">
                <select
                  value={h.dia_semana}
                  onChange={(e) => onChangeField(idx, "dia_semana", Number(e.target.value))}
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                >
                  {dias.map((d, i) => (
                    <option key={i} value={i}>{d}</option>
                  ))}
                </select>

                <input
                  type="time"
                  value={h.hora_desde?.slice(0,5) || "09:00"}
                  onChange={(e) => onChangeField(idx, "hora_desde", e.target.value)}
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
                <input
                  type="time"
                  value={h.hora_hasta?.slice(0,5) || "18:00"}
                  onChange={(e) => onChangeField(idx, "hora_hasta", e.target.value)}
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />

                <input
                  type="number"
                  min={5}
                  max={600}
                  value={h.intervalo_min || 30}
                  onChange={(e) => onChangeField(idx, "intervalo_min", Number(e.target.value))}
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />

                <div className="flex items-center gap-2 justify-end">
                  <label className="text-sm text-slate-600 flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={h.activo !== false}
                      onChange={(e) => onChangeField(idx, "activo", e.target.checked)}
                    />
                    Activo
                  </label>
                  <button onClick={() => remove(idx)} className="rounded-lg bg-rose-600 text-white text-xs font-semibold px-3 py-1.5 shadow">
                    Eliminar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
