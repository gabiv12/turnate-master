// src/pages/Servicios.jsx
import { useEffect, useMemo, useState } from "react";
import api from "../services/api";

const money = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

const normSvc = (it = {}) => ({
  id: it.id,
  nombre: it.nombre ?? "",
  duracion_min:
    Number(it.duracion_min ?? it.duracion ?? it.duracionMinutos ?? 30) || 30,
  precio: Number(it.precio ?? 0) || 0,
});

// ---- Helpers de compatibilidad de endpoints ----
async function tryEndpoints(fns) {
  let lastErr;
  for (const fn of fns) {
    try {
      return await fn();
    } catch (e) {
      // Solo seguimos probando si es 404/405 (no existe/no permitido aquí)
      const st = e?.response?.status;
      if (st !== 404 && st !== 405) throw e;
      lastErr = e;
    }
  }
  if (lastErr) throw lastErr;
}

// Listar servicios (devuelve array)
async function listServicios() {
  const r = await tryEndpoints([
    () => api.get("/servicios/mis"),
    () => api.get("/mis/servicios"),
    () => api.get("/emprendedores/mi/servicios"),
  ]);
  const data = Array.isArray(r?.data) ? r.data : Array.isArray(r?.data?.items) ? r.data.items : [];
  return data.map(normSvc);
}

// Crear servicio
async function createServicio(payload) {
  const body = {
    nombre: payload.nombre,
    duracion_min: Number(payload.duracion_min),
    duracion: Number(payload.duracion_min), // compat
    precio: Number(payload.precio),
  };
  await tryEndpoints([
    () => api.post("/servicios", body),
    () => api.post("/mis/servicios", body),
    () => api.post("/emprendedores/mi/servicios", body),
  ]);
}

// Actualizar servicio
async function updateServicio(id, payload) {
  const body = {
    nombre: payload.nombre,
    duracion_min: Number(payload.duracion_min),
    duracion: Number(payload.duracion_min), // compat
    precio: Number(payload.precio),
  };
  await tryEndpoints([
    () => api.put(`/servicios/${id}`, body),
    () => api.put(`/mis/servicios/${id}`, body),
    () => api.put(`/emprendedores/mi/servicios/${id}`, body),
    // fallback PATCH si algún router viejo no acepta PUT
    () => api.patch(`/servicios/${id}`, body),
    () => api.patch(`/mis/servicios/${id}`, body),
    () => api.patch(`/emprendedores/mi/servicios/${id}`, body),
  ]);
}

// Eliminar servicio
async function deleteServicio(id) {
  await tryEndpoints([
    () => api.delete(`/servicios/${id}`),
    () => api.delete(`/mis/servicios/${id}`),
    () => api.delete(`/emprendedores/mi/servicios/${id}`),
  ]);
}

export default function Servicios() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [form, setForm] = useState({ nombre: "", duracion_min: 30, precio: 0 });
  const [editing, setEditing] = useState(null); // {id,...} o null
  const [saving, setSaving] = useState(false);

  const totalServicios = useMemo(() => items.length, [items]);
  const precioPromedio = useMemo(() => {
    if (!items.length) return 0;
    const s = items.reduce((acc, it) => acc + (Number(it.precio) || 0), 0);
    return Math.round(s / items.length);
  }, [items]);

  async function load() {
    try {
      setErr("");
      setOk("");
      setLoading(true);
      const arr = await listServicios();
      setItems(arr);
    } catch (e) {
      setErr(
        e?.response?.data?.detail || "No se pudieron cargar los servicios."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const resetForm = () =>
    setForm({ nombre: "", duracion_min: 30, precio: 0 });

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((p) => {
      if (name === "duracion_min" || name === "precio") {
        const n = Number(value);
        return { ...p, [name]: Number.isFinite(n) ? n : 0 };
      }
      return { ...p, [name]: value };
    });
  };

  const onEdit = (svc) => {
    const n = normSvc(svc);
    setEditing(n);
    setForm({ nombre: n.nombre, duracion_min: n.duracion_min, precio: n.precio });
    setErr("");
    setOk("");
  };

  const onCancelEdit = () => {
    setEditing(null);
    resetForm();
  };

  const onDelete = async (svc) => {
    if (!svc?.id) return;
    if (!confirm(`¿Eliminar el servicio "${svc.nombre}"?`)) return;
    try {
      setSaving(true);
      setErr("");
      setOk("");
      await deleteServicio(svc.id);
      setOk("Servicio eliminado.");
      await load();
    } catch (e) {
      setErr(
        e?.response?.data?.detail ||
          "No se pudo eliminar el servicio. Si persiste, contactá al administrador."
      );
    } finally {
      setSaving(false);
    }
  };

  const validate = () => {
    if (!form.nombre?.trim()) return "Ingresá el nombre del servicio.";
    if (!Number.isFinite(form.duracion_min) || form.duracion_min <= 0)
      return "Ingresá una duración válida (minutos).";
    if (!Number.isFinite(form.precio) || form.precio < 0)
      return "Ingresá un precio válido (>= 0).";
    return null;
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;

    const v = validate();
    if (v) {
      setErr(v);
      setTimeout(() => setErr(""), 2200);
      return;
    }

    const payload = {
      nombre: form.nombre.trim(),
      duracion_min: Number(form.duracion_min),
      precio: Number(form.precio),
    };

    try {
      setSaving(true);
      setErr("");
      setOk("");
      if (editing?.id) {
        await updateServicio(editing.id, payload);
        setOk("Servicio actualizado.");
      } else {
        await createServicio(payload);
        setOk("Servicio creado.");
      }
      await load();
      onCancelEdit();
      setTimeout(() => setOk(""), 2000);
    } catch (e) {
      const msg =
        e?.response?.data?.detail ||
        e?.response?.data?.message ||
        (e?.response?.status === 401
          ? "Tu sesión expiró. Volvé a iniciar sesión."
          : e?.response?.status === 422
          ? "Datos inválidos. Revisá los campos."
          : "No se pudo guardar el servicio.");
      setErr(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-6">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Servicios</h1>
          <p className="text-sm text-slate-500">
            Gestioná los servicios que ofrecés y sus duraciones/precios.
          </p>
        </div>
        <div className="text-sm text-slate-600">
          Total: <b>{totalServicios}</b> &middot; Promedio:{" "}
          <b>{money.format(precioPromedio)}</b>
        </div>
      </header>

      {/* Formulario */}
      <form
        onSubmit={onSubmit}
        className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5 grid gap-3"
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-1">
            <label className="block text-xs font-semibold text-sky-700 mb-1">
              Nombre
            </label>
            <input
              type="text"
              name="nombre"
              value={form.nombre}
              onChange={onChange}
              placeholder="Ej: Corte + lavado"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 outline-none focus:ring-2 focus:ring-sky-300"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-sky-700 mb-1">
              Duración (min)
            </label>
            <input
              type="number"
              min={5}
              max={600}
              step={5}
              name="duracion_min"
              value={form.duracion_min}
              onChange={onChange}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 outline-none focus:ring-2 focus:ring-sky-300"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-sky-700 mb-1">
              Precio (ARS)
            </label>
            <input
              type="number"
              min={0}
              step={100}
              name="precio"
              value={form.precio}
              onChange={onChange}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 outline-none focus:ring-2 focus:ring-sky-300"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          {editing ? (
            <>
              <button
                type="button"
                onClick={onCancelEdit}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-emerald-600 px-5 py-2 text-white text-sm font-semibold shadow hover:bg-emerald-700 disabled:opacity-60"
              >
                {saving ? "Guardando…" : "Guardar cambios"}
              </button>
            </>
          ) : (
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-sky-600 px-5 py-2 text-white text-sm font-semibold shadow hover:bg-sky-700 disabled:opacity-60"
            >
              {saving ? "Guardando…" : "Agregar servicio"}
            </button>
          )}
        </div>

        {ok && (
          <div className="rounded-xl bg-emerald-50 text-emerald-700 text-sm px-4 py-2 ring-1 ring-emerald-200">
            {ok}
          </div>
        )}
        {err && (
          <div className="rounded-xl bg-rose-50 text-rose-700 text-sm px-4 py-2 ring-1 ring-rose-200">
            {err}
          </div>
        )}
      </form>

      {/* Lista */}
      <div className="rounded-2xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="text-left px-3 py-2.5">Servicio</th>
              <th className="text-left px-3 py-2.5">Duración</th>
              <th className="text-left px-3 py-2.5">Precio</th>
              <th className="px-3 py-2.5 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-slate-500">
                  Cargando…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-slate-500">
                  Aún no cargaste servicios.
                </td>
              </tr>
            ) : (
              items.map((it) => (
                <tr key={it.id}>
                  <td className="px-3 py-2.5 font-medium text-slate-800">
                    {it.nombre}
                  </td>
                  <td className="px-3 py-2.5">{it.duracion_min} min</td>
                  <td className="px-3 py-2.5">{money.format(it.precio)}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex justify-end gap-2">
                      <button
                        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 hover:bg-slate-50"
                        onClick={() => onEdit(it)}
                      >
                        Editar
                      </button>
                      <button
                        className="rounded-lg bg-rose-600 text-white px-3 py-1.5 hover:bg-rose-700"
                        onClick={() => onDelete(it)}
                      >
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
