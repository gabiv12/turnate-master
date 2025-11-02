// src/pages/Servicios.jsx
import { useEffect, useMemo, useState } from "react";
import api from "../services/api";
import { useUser } from "../context/UserContext.jsx";

const BTN = "rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-sky-700 disabled:opacity-60";
const BOX = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 outline-none focus:ring-2 focus:ring-sky-300";
const LABEL = "block text-xs font-semibold text-sky-700 mb-1";

function friendly(err) {
  const s = err?.response?.status;
  if (s === 401) return "Tu sesión se cerró. Iniciá sesión.";
  if (s === 403) return "No autorizado.";
  return err?.response?.data?.detail || err?.message || "No disponible por el momento.";
}

function replacePathParams(path, params = {}) {
  if (!path) return path;
  let out = path;
  Object.entries(params).forEach(([k, v]) => {
    out = out.replace(new RegExp(`{${k}}`, "g"), String(v));
  });
  return out;
}

async function discoverServicioPaths() {
  try {
    const { data } = await api.get("/openapi.json");
    const paths = data?.paths || {};
    const all = Object.entries(paths);

    const contains = (p, kw) => kw.some((k) => p.toLowerCase().includes(k));
    const ks = ["servicio", "servicios"];

    // LIST (GET)
    const listCand = all
      .filter(([p, def]) => def?.get && contains(p, ks))
      .map(([p]) => p);

    // CREATE (POST)
    const createCand = all
      .filter(([p, def]) => def?.post && contains(p, ks))
      .map(([p]) => p);

    // UPDATE (PUT/PATCH) con /{id}
    const updateCand = all
      .filter(([p, def]) => (def?.put || def?.patch) && contains(p, ks) && /{.*id.*}/i.test(p))
      .map(([p]) => p);

    // DELETE con /{id}
    const deleteCand = all
      .filter(([p, def]) => def?.delete && contains(p, ks) && /{.*id.*}/i.test(p))
      .map(([p]) => p);

    // Reordenar por preferencia “mis/…”, luego “/emprendedores/{id}/…”
    const pref = (arr) => [
      ...arr.filter((p) => /\/mis\b/i.test(p)),
      ...arr.filter((p) => /emprendedores\/{.*id.*}\//i.test(p)),
      ...arr,
    ].filter((v, i, a) => a.indexOf(v) === i);

    return {
      list: pref(listCand)[0] || null,
      create: pref(createCand)[0] || null,
      updateId: pref(updateCand)[0] || null,
      deleteId: pref(deleteCand)[0] || null,
    };
  } catch {
    return { list: null, create: null, updateId: null, deleteId: null };
  }
}

export default function Servicios() {
  const { user } = useUser() || {};
  const [emp, setEmp] = useState(null);

  const [paths, setPaths] = useState({ list: null, create: null, updateId: null, deleteId: null });
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  // Form crear / editar
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ nombre: "", duracion: 30, precio: "" });

  const canSubmit = useMemo(
    () => form.nombre.trim().length > 0 && Number(form.duracion) >= 5,
    [form]
  );

  // ---- helpers de rutas tolerantes ----
  async function getEmp() {
    try {
      const { data } = await api.get("/usuarios/me/emprendedor");
      setEmp(data);
      return data;
    } catch {
      return null;
    }
  }

  async function listServicios(empId) {
    // 1) OpenAPI si existe
    if (paths.list) {
      try {
        const path = replacePathParams(paths.list, { id: empId, emprendedor_id: empId });
        const r = await api.get(path);
        return Array.isArray(r.data) ? r.data : (r.data?.items || []);
      } catch {}
    }
    // 2) Fallbacks
    const tries = [
      () => api.get("/servicios/mis"),
      () => api.get("/mis/servicios"),
      () => api.get("/servicios/mis-servicios"),
      () => api.get("/servicios"),
      () => api.get(`/emprendedores/${empId}/servicios`),
    ];
    for (const fn of tries) {
      try { const r = await fn(); return Array.isArray(r.data) ? r.data : (r.data?.items || []); } catch {}
    }
    throw new Error("No se pudo obtener la lista.");
  }

  async function createServicio(empId, data) {
    const body = {
      nombre: data.nombre,
      duracion_minutos: Number(data.duracion),
      duracion_min: Number(data.duracion),
      precio: data.precio ? Number(data.precio) : undefined,
      emprendedor_id: empId,
    };
    if (paths.create) {
      try {
        const path = replacePathParams(paths.create, { id: empId, emprendedor_id: empId });
        return await api.post(path, body);
      } catch {}
    }
    const tries = [
      () => api.post("/servicios", body),
      () => api.post("/mis/servicios", body),
      () => api.post("/servicios/mis", body),
      () => api.post(`/emprendedores/${empId}/servicios`, body),
    ];
    for (const fn of tries) { try { return await fn(); } catch {} }
    throw new Error("No se pudo crear el servicio.");
  }

  async function updateServicio(empId, id, data) {
    const body = {
      nombre: data.nombre,
      duracion_minutos: Number(data.duracion),
      duracion_min: Number(data.duracion),
      precio: data.precio ? Number(data.precio) : undefined,
      emprendedor_id: empId,
    };
    if (paths.updateId) {
      const p = replacePathParams(paths.updateId, { id, servicio_id: id, emprendedor_id: empId });
      try { return await api.patch(p, body); } catch {}
      try { return await api.put(p, body); } catch {}
    }
    const tries = [
      () => api.patch(`/servicios/${id}`, body),
      () => api.put(`/servicios/${id}`, body),
      () => api.patch(`/emprendedores/${empId}/servicios/${id}`, body),
      () => api.put(`/emprendedores/${empId}/servicios/${id}`, body),
    ];
    for (const fn of tries) { try { return await fn(); } catch {} }
    throw new Error("No se pudo actualizar el servicio.");
  }

  async function deleteServicio(empId, id) {
    if (paths.deleteId) {
      const p = replacePathParams(paths.deleteId, { id, servicio_id: id, emprendedor_id: empId });
      try { return await api.delete(p); } catch {}
    }
    const tries = [
      () => api.delete(`/servicios/${id}`),
      () => api.delete(`/emprendedores/${empId}/servicios/${id}`),
      () => api.delete(`/mis/servicios/${id}`),
    ];
    for (const fn of tries) { try { return await fn(); } catch {} }
    throw new Error("No se pudo eliminar el servicio.");
  }

  // ---- carga inicial ----
  useEffect(() => {
    (async () => {
      setLoading(true); setMsg("");
      try {
        setPaths(await discoverServicioPaths());
        const e = await getEmp();
        const list = await listServicios(e?.id);
        setItems(list);
      } catch (e) {
        setMsg(friendly(e));
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- handlers ----
  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: name === "duracion" ? Number(value) : value }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit || !emp?.id) return;
    setLoading(true); setMsg("");
    try {
      if (editId) {
        await updateServicio(emp.id, editId, form);
      } else {
        await createServicio(emp.id, form);
      }
      const list = await listServicios(emp.id);
      setItems(list);
      setForm({ nombre: "", duracion: 30, precio: "" });
      setEditId(null);
      setMsg(editId ? "Servicio actualizado." : "Servicio creado.");
    } catch (e2) {
      setMsg(friendly(e2));
    } finally {
      setLoading(false);
      setTimeout(() => setMsg(""), 2200);
    }
  };

  const onEdit = (it) => {
    setEditId(it.id);
    setForm({
      nombre: it.nombre || "",
      duracion: Number(it.duracion_min ?? it.duracion_minutos ?? 30),
      precio: it.precio ?? "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const onDelete = async (id) => {
    if (!emp?.id) return;
    if (!confirm("¿Eliminar este servicio?")) return;
    setLoading(true); setMsg("");
    try {
      await deleteServicio(emp.id, id);
      const list = await listServicios(emp.id);
      setItems(list);
      setMsg("Servicio eliminado.");
    } catch (e2) {
      setMsg(friendly(e2));
    } finally {
      setLoading(false);
      setTimeout(() => setMsg(""), 1800);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header coherente */}
      <div className="-mx-4 lg:-mx-6 overflow-x-clip">
        <div className="rounded-3xl bg-gradient-to-r from-blue-600 to-cyan-400 p-5 md:p-6 text-white shadow">
          <div className="mx-auto max-w-7xl px-4 lg:px-6">
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Servicios</h1>
            <p className="text-sm md:text-base/relaxed opacity-90">
              Definí lo que ofrecés y la duración. Luego podrás asignar turnos.
            </p>
          </div>
        </div>
      </div>

      {/* Form alta/edición */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        {msg && (
          <div className={`mb-4 rounded-xl px-4 py-2 text-sm ${/cerró|error|No se pudo|403|404|500/.test(msg) ? "bg-red-50 text-red-700 ring-1 ring-red-200" : "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"}`}>
            {msg}
          </div>
        )}

        <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <label className={LABEL}>Nombre del servicio</label>
            <input
              name="nombre"
              value={form.nombre}
              onChange={onChange}
              placeholder="Corte de pelo"
              className={BOX}
              required
            />
          </div>

          <div>
            <label className={LABEL}>Duración (min)</label>
            <input
              type="number"
              min={5}
              step={5}
              name="duracion"
              value={form.duracion}
              onChange={onChange}
              className={BOX}
              required
            />
          </div>

          <div>
            <label className={LABEL}>Precio (opcional)</label>
            <input
              type="number"
              min={0}
              step={50}
              name="precio"
              value={form.precio}
              onChange={onChange}
              className={BOX}
              placeholder="0"
            />
          </div>

          <div className="md:col-span-2 flex items-end">
            <button type="submit" disabled={!canSubmit || loading} className={BTN}>
              {editId ? "Guardar cambios" : "Crear servicio"}
            </button>
            {editId && (
              <button
                type="button"
                onClick={() => { setEditId(null); setForm({ nombre: "", duracion: 30, precio: "" }); }}
                className="ml-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold hover:bg-slate-50"
              >
                Cancelar edición
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Lista */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 font-medium text-slate-700">Tus servicios</div>
        {items.length === 0 ? (
          <div className="text-sm text-slate-500">Aún no cargaste servicios.</div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {items.map((it) => (
              <li key={it.id} className="py-3 flex items-center justify-between gap-3">
                <div>
                  <div className="font-medium text-slate-900">{it.nombre}</div>
                  <div className="text-xs text-slate-500">
                    {Number(it.duracion_min ?? it.duracion_minutos ?? 30)} min
                    {it.precio ? ` · AR$ ${Number(it.precio)}` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => onEdit(it)} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-50">
                    Editar
                  </button>
                  <button onClick={() => onDelete(it.id)} className="rounded-xl bg-rose-600 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-700">
                    Eliminar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
