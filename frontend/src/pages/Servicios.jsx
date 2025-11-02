// src/pages/Servicios.jsx
import { useEffect, useMemo, useState } from "react";
import api from "../services/api";
import { useUser } from "../context/UserContext.jsx";

const BTN =
  "rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-sky-700";
const BOX =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 outline-none focus:ring-2 focus:ring-sky-300";
const LABEL = "block text-xs font-semibold text-sky-700 mb-1";

// Mensaje corto para UI (nuestro api interceptor a veces tira string)
function friendly(err) {
  if (typeof err === "string") return err;
  const s = err?.response?.status;
  if (s === 401) return "Tu sesión se cerró. Iniciá sesión.";
  if (s === 403) return "No autorizado.";
  return err?.response?.data?.detail || err?.message || "No disponible por el momento.";
}

export default function Servicios() {
  const { user } = useUser() || {};

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  // Mensaje al lado del botón (como en Horarios)
  const [msg, setMsg] = useState("");
  const [msgKind, setMsgKind] = useState("ok"); // "ok" | "err"

  // Form crear / editar
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ nombre: "", duracion: 30, precio: "" });

  const canSubmit = useMemo(
    () => form.nombre.trim().length > 0 && Number(form.duracion) >= 5,
    [form]
  );

  // --- API helpers (sin depender de /usuarios/me/emprendedor) ---
  async function listServicios() {
    // Tu backend responde 200 a /servicios/mis
    const { data } = await api.get("/servicios/mis");
    return Array.isArray(data) ? data : (data?.items || []);
  }

  async function createServicio(payload) {
    // Backend infiere el emprendedor desde el usuario autenticado
    const body = {
      nombre: payload.nombre,
      duracion_min: Number(payload.duracion),
      duracion_minutos: Number(payload.duracion), // tolerante
      precio: payload.precio ? Number(payload.precio) : undefined,
    };
    const { data } = await api.post("/servicios", body);
    return data;
  }

  async function updateServicio(id, payload) {
    const body = {
      nombre: payload.nombre,
      duracion_min: Number(payload.duracion),
      duracion_minutos: Number(payload.duracion),
      precio: payload.precio ? Number(payload.precio) : undefined,
    };
    const { data } = await api.put(`/servicios/${id}`, body);
    return data;
  }

  async function deleteServicio(id) {
    await api.delete(`/servicios/${id}`);
    return true;
  }

  // ---- carga inicial ----
  useEffect(() => {
    (async () => {
      setLoading(true);
      setMsg("");
      try {
        const list = await listServicios();
        setItems(list);
      } catch (e) {
        setMsgKind("err");
        setMsg(friendly(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ---- handlers ----
  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: name === "duracion" ? Number(value) : value }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    // Botón SIEMPRE activo: validamos acá y mostramos chip
    if (!form.nombre.trim()) {
      setMsgKind("err");
      setMsg("El nombre es obligatorio.");
      return;
    }
    if (!(Number(form.duracion) >= 5)) {
      setMsgKind("err");
      setMsg("La duración debe ser ≥ 5 minutos.");
      return;
    }

    setLoading(true);
    setMsg("");
    try {
      if (editId) {
        await updateServicio(editId, form);
      } else {
        await createServicio(form);
      }
      const list = await listServicios();
      setItems(list);
      setForm({ nombre: "", duracion: 30, precio: "" });
      setEditId(null);
      setMsgKind("ok");
      setMsg(editId ? "Servicio actualizado." : "Servicio creado.");
    } catch (e2) {
      setMsgKind("err");
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
    if (!confirm("¿Eliminar este servicio?")) return;
    setLoading(true);
    setMsg("");
    try {
      await deleteServicio(id);
      const list = await listServicios();
      setItems(list);
      setMsgKind("ok");
      setMsg("Servicio eliminado.");
    } catch (e2) {
      setMsgKind("err");
      setMsg(friendly(e2));
    } finally {
      setLoading(false);
      setTimeout(() => setMsg(""), 1800);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
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
        <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <label className={LABEL}>Nombre del servicio</label>
            <input
              name="nombre"
              value={form.nombre}
              onChange={onChange}
              placeholder="Corte de pelo"
              className={BOX}
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

          {/* Acciones: botón SIEMPRE activo + mensaje al lado */}
          <div className="md:col-span-2 flex items-end gap-3">
            <button
              type="submit"
              className={BTN}
              data-testid="btn-guardar-servicio"
              onClick={() => console.log("[Servicios] click botón")}
            >
              {editId ? "Guardar cambios" : "Crear servicio"}
            </button>

            {editId && (
              <button
                type="button"
                onClick={() => {
                  setEditId(null);
                  setForm({ nombre: "", duracion: 30, precio: "" });
                }}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold hover:bg-slate-50"
              >
                Cancelar edición
              </button>
            )}

            {msg && (
              <span
                className={
                  "text-sm rounded-lg px-3 py-2 " +
                  (msgKind === "err"
                    ? "bg-red-50 text-red-700 ring-1 ring-red-200"
                    : "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200")
                }
                data-testid="chip-mensaje-servicio"
              >
                {String(msg)}
              </span>
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
                  <button
                    onClick={() => onEdit(it)}
                    className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-50"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => onDelete(it.id)}
                    className="rounded-xl bg-rose-600 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-700"
                  >
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
